import React, { useState, useCallback } from 'react';
import { ShieldCheck, Database, Server, Settings, Play, RefreshCw, Code2 } from 'lucide-react';
import { MaskingRule, GeneratorConfig, ProcessedResult } from './types';
import { processJsonData, generateJavaCode, generateSqlCode } from './utils/codeGenerators';
import CodeBlock from './components/CodeBlock';

const DEFAULT_JSON = JSON.stringify([
  {
    "id": 101,
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "details": {
      "f_name": "Johnny",
      "age": 30
    }
  },
  {
    "id": 102,
    "first_name": "Alice",
    "lastname": "Smith",
    "email": "alice@example.com"
  }
], null, 2);

const App: React.FC = () => {
  // --- State ---
  const [inputJson, setInputJson] = useState<string>(DEFAULT_JSON);
  const [activeTab, setActiveTab] = useState<'masked' | 'java' | 'sql' | 'logs'>('masked');
  
  const [config, setConfig] = useState<GeneratorConfig>({
    sourceApiUrl: 'https://api.partner-manifest.com/v1/export',
    targetTableName: 'EXT_MANIFEST_DATA',
    packageName: 'com.enterprise.manifest'
  });

  const [rules, setRules] = useState<MaskingRule[]>([
    { id: '1', keywords: ['firstName', 'first_name', 'f_name', 'fname'], prefix: 'fname' },
    { id: '2', keywords: ['lastName', 'last_name', 'lname', 'surname'], prefix: 'lname' }
  ]);

  const [result, setResult] = useState<ProcessedResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- Handlers ---
  const handleAddRule = () => {
    setRules([...rules, { id: Date.now().toString(), keywords: ['new_key'], prefix: 'dummy' }]);
  };

  const handleRemoveRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
  };

  const handleRuleChange = (id: string, field: keyof MaskingRule, value: any) => {
    setRules(rules.map(r => {
      if (r.id === id) {
        if (field === 'keywords' && typeof value === 'string') {
           return { ...r, keywords: value.split(',').map(k => k.trim()) };
        }
        return { ...r, [field]: value };
      }
      return r;
    }));
  };

  const handleProcess = useCallback(() => {
    setError(null);
    try {
      const parsedJson = JSON.parse(inputJson);
      
      // 1. Execute JS-based masking simulation
      const { masked, logs } = processJsonData(parsedJson, rules);
      
      // 2. Generate Java Code
      const javaCode = generateJavaCode(config, rules);

      // 3. Generate SQL Code
      const sqlCode = generateSqlCode(config, masked);

      setResult({
        maskedData: masked,
        javaCode,
        sqlCode,
        logs
      });
      
    } catch (e: any) {
      setError("Invalid JSON format. Please check your input.");
    }
  }, [inputJson, rules, config]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Database className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Data Bridge Prototyper</h1>
            <p className="text-xs text-slate-400">Masking Logic Simulator & Code Generator</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleProcess}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
          >
            <Play size={18} />
            Simulate & Generate
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Left Panel: Configuration & Input */}
        <div className="w-full lg:w-1/3 border-r border-slate-800 flex flex-col bg-slate-900/50 overflow-y-auto">
          <div className="p-6 space-y-8">
            
            {/* Section: Config */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-blue-400 mb-2">
                <Settings size={18} />
                <h2 className="font-semibold uppercase tracking-wider text-sm">API & DB Config</h2>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">External API URL (Source)</label>
                  <input 
                    type="text" 
                    value={config.sourceApiUrl}
                    onChange={e => setConfig({...config, sourceApiUrl: e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Target Oracle Table</label>
                  <input 
                    type="text" 
                    value={config.targetTableName}
                    onChange={e => setConfig({...config, targetTableName: e.target.value.toUpperCase()})}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm focus:border-blue-500 focus:outline-none uppercase"
                  />
                </div>
                 <div>
                  <label className="block text-xs text-slate-400 mb-1">Java Package Name</label>
                  <input 
                    type="text" 
                    value={config.packageName}
                    onChange={e => setConfig({...config, packageName: e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section: Rules */}
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-blue-400">
                  <ShieldCheck size={18} />
                  <h2 className="font-semibold uppercase tracking-wider text-sm">Masking Rules</h2>
                </div>
                <button onClick={handleAddRule} className="text-xs bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded text-slate-300">
                  + Add Rule
                </button>
              </div>

              <div className="space-y-3">
                {rules.map((rule) => (
                  <div key={rule.id} className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg relative group">
                    <button 
                      onClick={() => handleRemoveRule(rule.id)}
                      className="absolute top-2 right-2 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      &times;
                    </button>
                    <div className="grid grid-cols-1 gap-2">
                      <div>
                        <label className="text-xs text-slate-500">Keywords (comma separated)</label>
                        <input 
                          type="text" 
                          value={rule.keywords.join(', ')}
                          onChange={(e) => handleRuleChange(rule.id, 'keywords', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-green-400 focus:border-green-500 focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                         <span className="text-xs text-slate-500">Replace with:</span>
                         <div className="flex items-center bg-slate-900 border border-slate-700 rounded px-2 py-1">
                            <span className="text-sm text-yellow-400 font-mono">{rule.prefix}</span>
                            <span className="text-sm text-slate-500 font-mono">001...</span>
                         </div>
                         <input 
                            type="text"
                            value={rule.prefix}
                            onChange={(e) => handleRuleChange(rule.id, 'prefix', e.target.value)}
                            className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-yellow-400 focus:border-yellow-500 focus:outline-none"
                            placeholder="prefix"
                         />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section: Source Data */}
            <div className="space-y-4 flex-1 flex flex-col">
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2 text-blue-400">
                  <Server size={18} />
                  <h2 className="font-semibold uppercase tracking-wider text-sm">Input JSON (Manifest)</h2>
                </div>
                <button 
                  onClick={() => setInputJson(DEFAULT_JSON)}
                  className="text-xs text-slate-500 hover:text-white flex items-center gap-1"
                >
                  <RefreshCw size={12} /> Reset
                </button>
               </div>
              <textarea
                className="w-full h-64 bg-slate-800 border border-slate-700 rounded-lg p-4 font-mono text-xs sm:text-sm leading-relaxed focus:border-blue-500 focus:outline-none text-slate-300 resize-none"
                value={inputJson}
                onChange={(e) => setInputJson(e.target.value)}
                placeholder="Paste your API response JSON here..."
                spellCheck={false}
              />
              {error && <p className="text-red-400 text-xs">{error}</p>}
            </div>

          </div>
        </div>

        {/* Right Panel: Output */}
        <div className="flex-1 bg-slate-950 flex flex-col overflow-hidden">
          {!result ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-600 space-y-4">
              <Code2 size={64} className="opacity-20" />
              <p className="text-lg">Configure rules and click "Simulate & Generate"</p>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex border-b border-slate-800 bg-slate-900">
                <button
                  onClick={() => setActiveTab('masked')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'masked' 
                      ? 'border-blue-500 text-white' 
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Simulation Result
                </button>
                <button
                  onClick={() => setActiveTab('java')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'java' 
                      ? 'border-blue-500 text-white' 
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Spring Boot Service
                </button>
                <button
                  onClick={() => setActiveTab('sql')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'sql' 
                      ? 'border-blue-500 text-white' 
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Oracle PL/SQL
                </button>
                <button
                  onClick={() => setActiveTab('logs')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'logs' 
                      ? 'border-blue-500 text-white' 
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Process Logs
                </button>
              </div>

              {/* Content Area */}
              <div className="flex-1 p-6 overflow-hidden relative bg-slate-950">
                {activeTab === 'masked' && (
                   <CodeBlock 
                    title="Masked JSON Payload (Ready for DB Import)" 
                    code={JSON.stringify(result.maskedData, null, 2)} 
                    language="json" 
                  />
                )}
                {activeTab === 'java' && (
                  <CodeBlock 
                    title="DataImportService.java" 
                    code={result.javaCode} 
                    language="java" 
                  />
                )}
                {activeTab === 'sql' && (
                  <CodeBlock 
                    title="oracle_import_script.sql" 
                    code={result.sqlCode} 
                    language="sql" 
                  />
                )}
                {activeTab === 'logs' && (
                   <div className="h-full border border-gray-700 rounded-lg overflow-hidden bg-slate-900 shadow-lg flex flex-col">
                     <div className="px-4 py-2 bg-slate-800 border-b border-gray-700">
                        <span className="text-sm font-medium text-gray-300">Masking Operation Logs</span>
                     </div>
                     <div className="flex-1 overflow-auto p-4 font-mono text-sm text-slate-400 space-y-1">
                        {result.logs.length === 0 ? (
                          <span className="italic opacity-50">No fields matched the masking rules.</span>
                        ) : (
                          result.logs.map((log, idx) => (
                            <div key={idx} className="flex gap-2">
                              <span className="text-slate-600">[{new Date().toLocaleTimeString()}]</span>
                              <span>{log}</span>
                            </div>
                          ))
                        )}
                     </div>
                   </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;