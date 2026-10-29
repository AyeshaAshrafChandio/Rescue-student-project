import React from 'react';
import {
  CheckCircle2,
  AlertOctagon,
  HelpCircle,
  Clock,
  Code2,
  ArrowRight,
  RotateCcw,
  AlertTriangle,
  Sparkles,
  Cpu,
} from 'lucide-react';
import { Project, AnalysisReport, AiProvider, AiProviderInfo } from '../types/index.ts';
import { HealthGauge } from '../components/HealthGauge.tsx';
import { RetryStatusInfo } from '../lib/project-service.ts';
import { AiProviderSelector, AiProviderBadge } from '../components/AiProviderSelector.tsx';

interface AnalysisViewProps {
  project: Project;
  report: AnalysisReport | null;
  onProceedToPlan: () => void;
  isAnalyzing?: boolean;
  retryStatus?: RetryStatusInfo | null;
  analysisError?: string | null;
  onRetryAnalysis?: () => void;
  selectedAiProvider?: AiProvider;
  onSelectAiProvider?: (provider: AiProvider) => void;
  aiProviders?: AiProviderInfo[];
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({
  project,
  report,
  onProceedToPlan,
  isAnalyzing = false,
  retryStatus = null,
  analysisError = null,
  onRetryAnalysis,
  selectedAiProvider = 'nebius',
  onSelectAiProvider,
  aiProviders = [],
}) => {
  const isNebiusSelected = selectedAiProvider === 'nebius';

  if (!report) {
    const showErrorState = !isAnalyzing && (Boolean(analysisError) || project.status === 'failed');

    if (showErrorState) {
      return (
        <div className="max-w-2xl mx-auto my-10 bg-slate-900/90 rounded-3xl border border-amber-500/30 p-6 sm:p-10 text-center shadow-2xl space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <div className="flex justify-center">
              <AiProviderBadge provider={selectedAiProvider} />
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white">
              Codebase Analysis Failed
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto leading-relaxed break-words">
              {analysisError ||
                `Inference failed on ${isNebiusSelected ? 'NVIDIA Nemotron via Nebius Token Factory' : 'Google Gemini'}. Automatic retries were attempted.`}
            </p>
          </div>

          {onSelectAiProvider && (
            <div className="text-left max-w-xl mx-auto pt-2">
              <AiProviderSelector
                currentProvider={selectedAiProvider}
                onSelectProvider={onSelectAiProvider}
                providers={aiProviders}
              />
            </div>
          )}

          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 text-left text-xs text-slate-400 space-y-1.5">
            <div className="font-semibold text-slate-200">Zero Synthetic Fallback Guarantee</div>
            <p>
              Student Project Rescue strictly analyzes your real source files using verified AST inspection.
              We never fabricate dummy findings when an AI provider is unavailable. You can retry with the current provider or switch providers above.
            </p>
          </div>

          {onRetryAnalysis && (
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={onRetryAnalysis}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-xl shadow-lg shadow-rose-500/20 transition transform hover:-translate-y-0.5"
              >
                <RotateCcw className="w-4 h-4 shrink-0" />
                <span>
                  Retry Analysis with {isNebiusSelected ? 'NVIDIA Nemotron' : 'Google Gemini'}
                </span>
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="text-center py-16 sm:py-20 bg-slate-900/60 rounded-3xl border border-slate-800 p-6 sm:p-10 space-y-5 max-w-2xl mx-auto my-8">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto animate-spin border ${
          isNebiusSelected ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
        }`}>
          {isNebiusSelected ? <Cpu className="w-7 h-7" /> : <Code2 className="w-7 h-7" />}
        </div>

        <div className="space-y-2">
          <div className="flex justify-center">
            <AiProviderBadge provider={selectedAiProvider} />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-white">
            Generating Deep Codebase Rescue Report...
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            {isNebiusSelected ? 'NVIDIA Nemotron-3-Nano-30B-A3B via Nebius Token Factory' : 'Google Gemini'}{' '}
            is inspecting the AST, checking dependencies, syntax, and comparing{' '}
            <strong className="text-slate-200">{project.title}</strong> against requirements.
          </p>
        </div>

        {retryStatus && (
          <div className="max-w-lg mx-auto p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2">
            <div className="flex items-center justify-center space-x-2 font-bold text-amber-300">
              <RotateCcw className="w-4 h-4 animate-spin shrink-0" />
              <span>Automatic Exponential Backoff Active</span>
            </div>
            <p className="leading-relaxed break-words">{retryStatus.message}</p>
          </div>
        )}

        {!isAnalyzing && onRetryAnalysis && (
          <div className="pt-2">
            <button
              onClick={onRetryAnalysis}
              className={`inline-flex items-center space-x-2 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition ${
                isNebiusSelected ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-500'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Start Analysis Now ({isNebiusSelected ? 'NVIDIA Nemotron' : 'Google Gemini'})</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      {/* Top Banner & Health Score */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-8 shadow-xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl min-w-0 w-full">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                Rescue Report
              </span>
              <AiProviderBadge provider={report.aiProvider} model={report.modelUsed} />
              <span className="text-xs text-slate-400 font-mono">
                {new Date(report.createdAt).toLocaleString()}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight break-words">
              Codebase Diagnosis: {project.title}
            </h1>

            <p className="text-sm text-slate-300 leading-relaxed break-words">
              {report.overallSummary}
            </p>

            {/* Detected Tech */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="text-slate-400 font-semibold">Detected Stack:</span>
              <span className="bg-slate-800 text-indigo-300 px-3 py-1 rounded-lg font-mono border border-slate-700 break-words max-w-full">
                {report.techDetected}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 shrink-0 w-full lg:w-auto">
            <HealthGauge
              score={report.healthScore}
              status="in_rescue"
              size="lg"
              label="Initial Code Health"
            />

            <div className="flex flex-col space-y-2 w-full sm:w-auto">
              <button
                onClick={onProceedToPlan}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-semibold text-xs px-5 py-3 rounded-xl shadow-lg shadow-rose-500/20 transition transform hover:-translate-y-0.5"
              >
                <span>View Rescue Plan</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>

              {onRetryAnalysis && (
                <button
                  onClick={onRetryAnalysis}
                  disabled={isAnalyzing}
                  className="w-full sm:w-auto flex items-center justify-center space-x-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 font-semibold text-xs px-4 py-2 rounded-xl border border-slate-700 transition"
                >
                  <RotateCcw className={`w-3.5 h-3.5 shrink-0 ${isAnalyzing ? 'animate-spin' : ''}`} />
                  <span>{isAnalyzing ? 'Re-analyzing…' : 'Re-run Analysis'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* AI Provider Switcher Card */}
      {onSelectAiProvider && (
        <AiProviderSelector
          currentProvider={selectedAiProvider}
          onSelectProvider={onSelectAiProvider}
          providers={aiProviders}
        />
      )}

      {/* 4 Quadrants Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. What's DONE */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-md min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-emerald-400 mb-4 pb-2 border-b border-slate-800">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <h2 className="font-bold text-base text-white">
              What's DONE ({report.featuresDone.length})
            </h2>
            <span className="text-xs text-slate-400 ml-auto">Working Evidence</span>
          </div>

          <div className="space-y-3">
            {report.featuresDone.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No fully working features verified yet.</p>
            ) : (
              report.featuresDone.map((item, idx) => (
                <div key={idx} className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 space-y-1 min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-1.5">
                    <h3 className="text-xs font-bold text-emerald-300 break-words">{item.title}</h3>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 break-all">
                      {item.fileEvidence}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 break-words">{item.description}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 2. What's BROKEN */}
        <div className="bg-slate-900/90 border border-rose-900/30 rounded-2xl p-4 sm:p-6 shadow-md bg-gradient-to-b from-rose-950/10 to-transparent min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-rose-400 mb-4 pb-2 border-b border-slate-800">
            <AlertOctagon className="w-5 h-5 shrink-0" />
            <h2 className="font-bold text-base text-white">
              What's BROKEN ({report.featuresBroken.length})
            </h2>
            <span className="text-xs text-rose-400/80 ml-auto">Critical Blockers</span>
          </div>

          <div className="space-y-3">
            {report.featuresBroken.length === 0 ? (
              <p className="text-xs text-emerald-400 font-semibold">No critical errors or syntax crashes detected.</p>
            ) : (
              report.featuresBroken.map((item, idx) => (
                <div key={idx} className="bg-slate-950/80 p-3.5 rounded-xl border border-rose-500/20 space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-1.5">
                    <h3 className="text-xs font-bold text-rose-300 break-words">{item.title}</h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 shrink-0">
                      {item.severity}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 break-words">{item.errorExplanation}</p>
                  <div className="text-[11px] text-amber-300/90 font-mono bg-amber-950/20 p-2 rounded border border-amber-500/20 break-words">
                    <strong>Root Cause:</strong> {item.rootCause}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono break-all">
                    File: {item.fileEvidence}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 3. What's MISSING */}
        <div className="bg-slate-900/90 border border-amber-900/30 rounded-2xl p-4 sm:p-6 shadow-md bg-gradient-to-b from-amber-950/10 to-transparent min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-amber-400 mb-4 pb-2 border-b border-slate-800">
            <Clock className="w-5 h-5 shrink-0" />
            <h2 className="font-bold text-base text-white">
              What's MISSING ({report.featuresMissing.length})
            </h2>
            <span className="text-xs text-amber-400/80 ml-auto">Unimplemented Requirements</span>
          </div>

          <div className="space-y-3">
            {report.featuresMissing.length === 0 ? (
              <p className="text-xs text-emerald-400 font-semibold">All specified requirements appear implemented!</p>
            ) : (
              report.featuresMissing.map((item, idx) => (
                <div key={idx} className="bg-slate-950/80 p-3.5 rounded-xl border border-amber-500/20 space-y-1 min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-1.5">
                    <h3 className="text-xs font-bold text-amber-300 break-words">{item.title}</h3>
                    <span className="text-[10px] font-mono text-slate-400 uppercase bg-slate-900 px-2 py-0.5 rounded shrink-0">
                      {item.priority} Priority
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 break-words">{item.whyMissing}</p>
                  <p className="text-[11px] text-slate-400 italic break-words">
                    Requirement: "{item.requirementReference}"
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 4. What's UNVERIFIABLE */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-md min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-indigo-400 mb-4 pb-2 border-b border-slate-800">
            <HelpCircle className="w-5 h-5 shrink-0" />
            <h2 className="font-bold text-base text-white">
              What's UNVERIFIABLE ({report.featuresUnverifiable.length})
            </h2>
            <span className="text-xs text-slate-400 ml-auto">Missing Tests / Fixtures</span>
          </div>

          <div className="space-y-3">
            {report.featuresUnverifiable.length === 0 ? (
              <p className="text-xs text-slate-500 italic">All items have test verification coverage.</p>
            ) : (
              report.featuresUnverifiable.map((item, idx) => (
                <div key={idx} className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 space-y-1 min-w-0">
                  <h3 className="text-xs font-bold text-indigo-300 break-words">{item.title}</h3>
                  <p className="text-xs text-slate-400 break-words">{item.reason}</p>
                  <div className="text-[11px] text-slate-300 font-mono bg-slate-900 p-2 rounded border border-slate-800 break-words">
                    <strong>Suggested Test:</strong> {item.suggestedVerification}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Step Progression Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-center sm:text-left">
          <h3 className="text-sm font-bold text-white">Next Step: Actionable Rescue Plan</h3>
          <p className="text-xs text-slate-400">
            Review prioritized tasks generated from this AST &amp; Gemini analysis report.
          </p>
        </div>
        <button
          onClick={onProceedToPlan}
          className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-semibold text-xs px-6 py-3 rounded-xl shadow-lg transition"
        >
          <span>Continue to Rescue Plan</span>
          <ArrowRight className="w-4 h-4 shrink-0" />
        </button>
      </div>
    </div>
  );
};
