import React, { useState } from 'react';
import { Check, Copy, FileText, ArrowRight } from 'lucide-react';

interface DiffViewerProps {
  filePath: string;
  oldContent: string;
  newContent: string;
  onApply?: () => void;
  isApplied?: boolean;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  filePath,
  oldContent,
  newContent,
  onApply,
  isApplied = false,
}) => {
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('unified');
  const [copied, setCopied] = useState(false);

  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(newContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-2xl min-w-0">
      {/* Diff Header */}
      <div className="bg-slate-900/90 px-3 sm:px-4 py-3 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center space-x-2 min-w-0">
          <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="font-mono text-xs sm:text-sm font-semibold text-slate-200 truncate">
            {filePath}
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono shrink-0">
            {newLines.length} lines
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 shrink-0">
          <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setViewMode('unified')}
              className={`px-2.5 py-1 rounded font-medium transition ${
                viewMode === 'unified' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Unified
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`px-2.5 py-1 rounded font-medium transition ${
                viewMode === 'split' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Side-by-Side
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 border border-slate-800 transition"
              title="Copy new code"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>

            {onApply && (
              <button
                onClick={onApply}
                disabled={isApplied}
                className={`flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition whitespace-nowrap ${
                  isApplied
                    ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 cursor-default'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {isApplied ? (
                  <>
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>Applied</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                    <span>Apply Changes</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Diff Content Body */}
      <div className="max-h-[500px] overflow-auto font-mono text-xs leading-relaxed p-2">
        {viewMode === 'unified' ? (
          <div className="space-y-0.5">
            {/* Simple unified display */}
            {newLines.map((line, idx) => {
              const oldLine = oldLines[idx];
              const isDifferent = oldLine !== line;
              const isAdded = !oldLine && line;

              return (
                <div
                  key={idx}
                  className={`flex items-start px-2 py-0.5 rounded ${
                    isDifferent || isAdded
                      ? 'bg-emerald-950/40 text-emerald-300 border-l-2 border-emerald-500'
                      : 'text-slate-300 hover:bg-slate-900/60'
                  }`}
                >
                  <span className="w-8 sm:w-10 shrink-0 select-none text-slate-600 text-right pr-2 sm:pr-3">
                    {idx + 1}
                  </span>
                  <span className="shrink-0 select-none text-slate-500 mr-2">{isDifferent ? '+' : ' '}</span>
                  <span className="flex-1 min-w-0 whitespace-pre-wrap break-all">{line || ' '}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-2">
            {/* Original Column */}
            <div className="border-b md:border-b-0 md:border-r border-slate-800 pb-3 md:pb-0 md:pr-2 min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-rose-400 mb-2 px-2">
                Original Code
              </div>
              <div className="space-y-0.5">
                {oldLines.map((line, idx) => (
                  <div key={idx} className="flex items-start px-2 py-0.5 text-slate-400 hover:bg-slate-900/50 rounded">
                    <span className="w-8 shrink-0 select-none text-slate-600 text-right pr-2">{idx + 1}</span>
                    <span className="flex-1 min-w-0 whitespace-pre-wrap break-all">{line || ' '}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Proposed Column */}
            <div className="md:pl-2 min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-2 px-2">
                AI Proposed Fix
              </div>
              <div className="space-y-0.5">
                {newLines.map((line, idx) => {
                  const isDiff = oldLines[idx] !== line;
                  return (
                    <div
                      key={idx}
                      className={`flex items-start px-2 py-0.5 rounded ${
                        isDiff
                          ? 'bg-emerald-950/40 text-emerald-300 border-l-2 border-emerald-500'
                          : 'text-slate-300 hover:bg-slate-900/50'
                      }`}
                    >
                      <span className="w-8 shrink-0 select-none text-slate-600 text-right pr-2">{idx + 1}</span>
                      <span className="flex-1 min-w-0 whitespace-pre-wrap break-all">{line || ' '}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
