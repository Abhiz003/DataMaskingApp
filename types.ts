export interface MaskingRule {
  id: string;
  keywords: string[]; // e.g., ['firstname', 'fname', 'first_name']
  prefix: string;     // e.g., 'fname'
}

export interface ProcessedResult {
  maskedData: any;
  javaCode: string;
  sqlCode: string;
  logs: string[];
}

export interface GeneratorConfig {
  sourceApiUrl: string;
  targetTableName: string;
  packageName: string;
}