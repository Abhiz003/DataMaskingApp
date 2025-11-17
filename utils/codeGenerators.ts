import { GeneratorConfig, MaskingRule } from '../types';

// Helper to detect type for SQL
const getSqlType = (value: any): string => {
  if (typeof value === 'number') return 'NUMBER';
  if (typeof value === 'boolean') return 'NUMBER(1)';
  if (value instanceof Date) return 'TIMESTAMP';
  return 'VARCHAR2(4000)'; // Default safely
};

// Helper to detect type for Java
const getJavaType = (value: any): string => {
  if (typeof value === 'number') return 'BigDecimal';
  if (typeof value === 'boolean') return 'Boolean';
  return 'String';
};

// Core Masking Logic
export const processJsonData = (
  json: any,
  rules: MaskingRule[]
): { masked: any; logs: string[] } => {
  const logs: string[] = [];
  const counters: Record<string, number> = {};

  // Initialize counters for each rule prefix
  rules.forEach((rule) => {
    counters[rule.prefix] = 1;
  });

  const maskValue = (key: string, value: any): any => {
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        return value.map((item) => maskValue(key, item));
      }
      const newObj: any = {};
      for (const k in value) {
        newObj[k] = maskValue(k, value[k]);
      }
      return newObj;
    }

    // Check if key matches any rule
    const lowerKey = key.toLowerCase();
    for (const rule of rules) {
      if (rule.keywords.some((kw) => lowerKey.includes(kw.toLowerCase()))) {
        const newVal = `${rule.prefix}${String(counters[rule.prefix]).padStart(3, '0')}`;
        counters[rule.prefix]++;
        logs.push(`Masked key '${key}': '${value}' -> '${newVal}'`);
        return newVal;
      }
    }

    return value;
  };

  const masked = maskValue('root', json);
  return { masked, logs };
};

export const generateJavaCode = (
  config: GeneratorConfig,
  rules: MaskingRule[]
): string => {
  const ruleMapJava = rules
    .map(
      (r) =>
        `        // Rule: ${r.keywords.join(', ')} -> ${r.prefix}001...\n` +
        `        Set<String> ${r.prefix}Keywords = Set.of("${r.keywords.join('", "')}");`
    )
    .join('\n');

  return `package ${config.packageName};

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class DataImportService {

    @Autowired
    private RestTemplate restTemplate;

    @Autowired
    private JdbcTemplate jdbcTemplate;
    
    @Autowired
    private ObjectMapper objectMapper;

    private static final String MANIFEST_URL = "${config.sourceApiUrl}";

    public void fetchAndImportManifest() {
        try {
            // 1. Fetch Data
            JsonNode rootNode = restTemplate.getForObject(MANIFEST_URL, JsonNode.class);
            
            // 2. Transform/Mask Data
            JsonNode maskedNode = maskSensitiveData(rootNode);
            
            // 3. Insert into Oracle DB via SP
            String jsonString = objectMapper.writeValueAsString(maskedNode);
            callImportStoredProcedure(jsonString);
            
        } catch (Exception e) {
            e.printStackTrace();
            // Handle exception (log, alert, etc.)
        }
    }

    private JsonNode maskSensitiveData(JsonNode node) {
        // Define Rules
${ruleMapJava}
        
        // Counters for sequences
        Map<String, AtomicInteger> counters = new HashMap<>();
${rules.map(r => `        counters.put("${r.prefix}", new AtomicInteger(1));`).join('\n')}

        return recursiveMask(node, counters);
    }

    private JsonNode recursiveMask(JsonNode node, Map<String, AtomicInteger> counters) {
        if (node.isObject()) {
            ObjectNode objectNode = (ObjectNode) node;
            Iterator<Map.Entry<String, JsonNode>> fields = objectNode.fields();
            
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> field = fields.next();
                String key = field.getKey().toLowerCase();
                
                // Apply Masking Logic
                boolean masked = false;
${rules.map(r => `                if (isKeywordMatch(key, Set.of("${r.keywords.join('", "')}"))) {
                    int seq = counters.get("${r.prefix}").getAndIncrement();
                    objectNode.put(field.getKey(), "${r.prefix}" + String.format("%03d", seq));
                    masked = true;
                }`).join('\n')}
                
                if (!masked) {
                    recursiveMask(field.getValue(), counters);
                }
            }
        } else if (node.isArray()) {
            ArrayNode arrayNode = (ArrayNode) node;
            for (JsonNode item : arrayNode) {
                recursiveMask(item, counters);
            }
        }
        return node;
    }
    
    private boolean isKeywordMatch(String key, Set<String> keywords) {
         // Exact match or contains logic depending on requirements
         return keywords.contains(key) || keywords.stream().anyMatch(key::contains);
    }

    private void callImportStoredProcedure(String jsonPayload) {
        String sql = "{call ${config.targetTableName}_IMPORT_PKG.IMPORT_MANIFEST(?)}";
        jdbcTemplate.update(sql, jsonPayload);
        System.out.println("Data successfully pushed to Oracle.");
    }
}`;
};

export const generateSqlCode = (
  config: GeneratorConfig,
  sampleJson: any
): string => {
  // Flatten simple keys for the sample table definition
  const keys: string[] = [];
  let columnsDef = '';
  let jsonTableColumns = '';

  if (sampleJson && typeof sampleJson === 'object' && !Array.isArray(sampleJson)) {
    Object.keys(sampleJson).forEach((key) => {
      const type = getSqlType(sampleJson[key]);
      keys.push(key);
      columnsDef += `    ${key.toUpperCase()} ${type},\n`;
      jsonTableColumns += `            ${key.toUpperCase()} ${type} PATH '$.${key}',\n`;
    });
  } else if (Array.isArray(sampleJson) && sampleJson.length > 0) {
      // If array, take first item for schema
      const firstItem = sampleJson[0];
      Object.keys(firstItem).forEach((key) => {
      const type = getSqlType(firstItem[key]);
      keys.push(key);
      columnsDef += `    ${key.toUpperCase()} ${type},\n`;
      jsonTableColumns += `            ${key.toUpperCase()} ${type} PATH '$.${key}',\n`;
    });
  }

  // Clean up trailing commas
  columnsDef = columnsDef.replace(/,\n$/, '');
  jsonTableColumns = jsonTableColumns.replace(/,\n$/, '');

  return `
-- 1. Create Target Table (inferred from JSON structure)
CREATE TABLE ${config.targetTableName} (
    ID NUMBER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
${columnsDef},
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create Import Package/Procedure
CREATE OR REPLACE PACKAGE ${config.targetTableName}_IMPORT_PKG AS
    PROCEDURE IMPORT_MANIFEST(p_json_payload IN CLOB);
END ${config.targetTableName}_IMPORT_PKG;
/

CREATE OR REPLACE PACKAGE BODY ${config.targetTableName}_IMPORT_PKG AS

    PROCEDURE IMPORT_MANIFEST(p_json_payload IN CLOB) IS
    BEGIN
        -- Check if valid JSON
        IF p_json_payload IS NULL OR LENGTH(p_json_payload) = 0 THEN
            RETURN;
        END IF;

        -- Insert using JSON_TABLE (Oracle 12c+)
        -- Assuming the input is either a single object or an array of objects
        
        INSERT INTO ${config.targetTableName} (
            ${keys.map(k => k.toUpperCase()).join(', ')}
        )
        SELECT 
            ${keys.map(k => k.toUpperCase()).join(', ')}
        FROM JSON_TABLE(p_json_payload, '$[*]' 
            COLUMNS (
${jsonTableColumns}
            )
        );
        
        COMMIT;
        
    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            -- Log error to an error table here
            RAISE_APPLICATION_ERROR(-20001, 'Error importing manifest: ' || SQLERRM);
    END IMPORT_MANIFEST;

END ${config.targetTableName}_IMPORT_PKG;
/
`;
};
