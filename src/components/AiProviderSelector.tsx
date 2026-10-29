import React, { useState } from 'react';
import { Cpu, Sparkles, ChevronDown, Check, AlertCircle, Info, Shield } from 'lucide-react';
import { AiProvider, AiProviderInfo } from '../types/index.ts';

interface AiProviderSelectorProps {
  currentProvider: AiProvider;
  onSelectProvider: (provider: AiProvider) => void;
  providers?: AiProviderInfo[];
  compact?: boolean;
  className?: string;
}

export const AiProviderSelector: React.FC<AiProviderSelectorProps> = ({
  currentProvider,
  onSelectProvider,
  providers = [],
  compact = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Fallback defaults if status hasn't loaded yet
  const nebiusInfo = providers.find((p) => p.id === 'nebius') || {
    id: 'nebius' as AiProvider,
    name: 'NVIDIA Nemotron (Nebius Token Factory)',
    model: 'nvidia/nemotron-3-nano-30b-a3b',
    configured: false,
    active: false,
    badge: 'NVIDIA Nemotron',
    description: 'NVIDIA Nemotron-3-Nano-30B-A3B inference via official Nebius Token Factory API.',
  };

  const geminiInfo = providers.find((p) => p.id === 'gemini') || {
    id: 'gemini' as AiProvider,
    name: 'Google Gemini',
    model: 'gemini-flash-latest',
    configured: true,
    active: true,
    badge: 'Google Gemini',
    description: 'Gemini Flash model for AST verification and code triage.',
  };

  const activeInfo = currentProvider === 'nebius' ? nebiusInfo : geminiInfo;

  if (compact) {
    return (
      <div className={`relative inline-block text-left ${className}`}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
            currentProvider === 'nebius'
              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/60 shadow-sm shadow-emerald-500/10'
              : 'bg-indigo-950/60 text-indigo-300 border-indigo-500/40 hover:bg-indigo-900/60 shadow-sm shadow-indigo-500/10'
          }`}
          title="Switch AI Inference Provider"
        >
          {currentProvider === 'nebius' ? (
            <Cpu className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          )}
          <span className="truncate max-w-[140px] sm:max-w-none">{activeInfo.badge}</span>
          <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl z-50 p-2 space-y-1 text-xs">
              <div className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800/80">
                Select AI Inference Engine
              </div>

              {/* Nebius NVIDIA Nemotron option */}
              <button
                type="button"
                onClick={() => {
                  onSelectProvider('nebius');
                  setIsOpen(false);
                }}
                className={`w-full text-left p-2.5 rounded-xl transition flex items-start space-x-2.5 ${
                  currentProvider === 'nebius'
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-white'
                    : 'hover:bg-slate-800/70 text-slate-300 border border-transparent'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/30">
                  <Cpu className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-300">NVIDIA Nemotron</span>
                    {currentProvider === 'nebius' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">nvidia/nemotron-3-nano-30b-a3b</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Nebius Token Factory API</div>
                  {!nebiusInfo.configured && (
                    <div className="text-[10px] text-amber-300 mt-1 flex items-center space-x-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>Set NEBIUS_API_KEY in server .env</span>
                    </div>
                  )}
                </div>
              </button>

              {/* Google Gemini option */}
              <button
                type="button"
                onClick={() => {
                  onSelectProvider('gemini');
                  setIsOpen(false);
                }}
                className={`w-full text-left p-2.5 rounded-xl transition flex items-start space-x-2.5 ${
                  currentProvider === 'gemini'
                    ? 'bg-indigo-500/15 border border-indigo-500/30 text-white'
                    : 'hover:bg-slate-800/70 text-slate-300 border border-transparent'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 border border-indigo-500/30">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-300">Google Gemini</span>
                    {currentProvider === 'gemini' && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">gemini-flash-latest</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Google AI Studio API</div>
                </div>
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // Full Card Mode (for Workspace, Analysis, Settings)
  return (
    <div className={`bg-slate-950/80 border border-slate-800/90 rounded-2xl p-3.5 sm:p-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center space-x-2 text-xs font-bold text-white">
          <Shield className="w-4 h-4 text-slate-400" />
          <span>Active AI Inference Engine</span>
        </div>
        <span className="text-[11px] text-slate-400 font-medium">
          Hackathon &amp; Dual-Engine Support
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* NVIDIA Nemotron Card */}
        <div
          onClick={() => onSelectProvider('nebius')}
          className={`cursor-pointer rounded-xl p-3 border transition-all text-left ${
            currentProvider === 'nebius'
              ? 'bg-emerald-950/30 border-emerald-500/50 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-500/30'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center space-x-2">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                  currentProvider === 'nebius'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-xs text-white flex items-center space-x-1.5">
                  <span>NVIDIA Nemotron-3</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase bg-emerald-500/20 text-emerald-300">
                    Nebius
                  </span>
                </div>
                <div className="text-[10px] font-mono text-emerald-400/90">
                  nvidia/nemotron-3-nano-30b-a3b
                </div>
              </div>
            </div>
            {currentProvider === 'nebius' && (
              <span className="w-4 h-4 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-[10px] shrink-0">
                ✓
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
            Official Nebius Token Factory inference with NVIDIA Nemotron-3-Nano for deep AST analysis and code fixes.
          </p>
          {!nebiusInfo.configured && (
            <div className="mt-2 text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1 flex items-center space-x-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>Requires NEBIUS_API_KEY in server env</span>
            </div>
          )}
        </div>

        {/* Google Gemini Card */}
        <div
          onClick={() => onSelectProvider('gemini')}
          className={`cursor-pointer rounded-xl p-3 border transition-all text-left ${
            currentProvider === 'gemini'
              ? 'bg-indigo-950/30 border-indigo-500/50 shadow-md shadow-indigo-500/10 ring-1 ring-indigo-500/30'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center space-x-2">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                  currentProvider === 'gemini'
                    ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-xs text-white flex items-center space-x-1.5">
                  <span>Google Gemini</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase bg-indigo-500/20 text-indigo-300">
                    Flash
                  </span>
                </div>
                <div className="text-[10px] font-mono text-indigo-400/90">
                  gemini-flash-latest
                </div>
              </div>
            </div>
            {currentProvider === 'gemini' && (
              <span className="w-4 h-4 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                ✓
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
            Google AI Studio Flash model providing high-speed analysis and code diagnosis.
          </p>
          {!geminiInfo.configured && (
            <div className="mt-2 text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1 flex items-center space-x-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>Requires GEMINI_API_KEY in server env</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const AiProviderBadge: React.FC<{
  provider?: AiProvider | string;
  model?: string;
  className?: string;
}> = ({ provider, model, className = '' }) => {
  const isNebius = provider === 'nebius' || model?.includes('nemotron') || model?.includes('nebius');

  if (isNebius) {
    return (
      <span
        className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 ${className}`}
        title={`Inference executed via Nebius Token Factory (Model: ${model || 'nvidia/nemotron-3-nano-30b-a3b'})`}
      >
        <Cpu className="w-3 h-3 text-emerald-400 shrink-0" />
        <span>NVIDIA Nemotron (Nebius)</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 ${className}`}
      title={`Inference executed via Google AI Studio (Model: ${model || 'gemini-flash-latest'})`}
    >
      <Sparkles className="w-3 h-3 text-indigo-400 shrink-0" />
      <span>Google Gemini</span>
    </span>
  );
};
