import React from 'react';
import { Copy } from 'lucide-react';

interface CodeBlockProps {
  title: string;
  code: string;
  language?: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ title, code, language = 'text' }) => {
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
  };

  return (
    <div className="flex flex-col h-full border border-gray-700 rounded-lg overflow-hidden bg-slate-900 shadow-lg">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-gray-700">
        <span className="text-sm font-medium text-gray-300">{title}</span>
        <button
          onClick={handleCopy}
          className="p-1.5 hover:bg-slate-700 rounded-md text-gray-400 hover:text-white transition-colors"
          title="Copy to clipboard"
        >
          <Copy size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4 relative">
        <pre className="text-xs sm:text-sm font-mono text-blue-100 whitespace-pre">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
};

export default CodeBlock;