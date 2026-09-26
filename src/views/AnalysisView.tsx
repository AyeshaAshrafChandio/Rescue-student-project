import React from 'react';
import {
  CheckCircle2,
  AlertOctagon,
  HelpCircle,
  Clock,
  Code2,
  FileText,
  ArrowRight,
  ShieldCheck,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Project, AnalysisReport } from '../types/index.ts';
import { HealthGauge } from '../components/HealthGauge.tsx';

interface AnalysisViewProps {
  project: Project;
  report: AnalysisReport | null;
  onProceedToPlan: () => void;
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({
  project,
  report,
  onProceedToPlan,
}) => {
  if (!report) {
    return (
      <div className="text-center py-20 bg-slate-900/60 rounded-3xl border border-slate-800 p-8">
        <div className="w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4 animate-spin">
          <Code2 className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-white">Generating Deep Codebase Rescue Report...</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Gemini is inspecting the AST, checking dependencies, syntax, and comparing against requirements.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      {/* Top Banner & Health Score */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                Rescue Report
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {new Date(report.createdAt).toLocaleString()}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Codebase Diagnosis: {project.title}
            </h1>

            <p className="text-sm text-slate-300 leading-relaxed">
              {report.overallSummary}
            </p>

            {/* Detected Tech */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="text-slate-400 font-semibold">Detected Stack:</span>
              <span className="bg-slate-800 text-indigo-300 px-3 py-1 rounded-lg font-mono border border-slate-700">
                {report.techDetected}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0">
            <HealthGauge score={report.healthScore} size="lg" label="Initial Code Health" />

            <div className="flex flex-col space-y-2">
              <button
                onClick={onProceedToPlan}
                className="flex items-center justify-center space-x-2 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-semibold text-xs px-5 py-3 rounded-xl shadow-lg shadow-rose-500/20 transition transform hover:-translate-y-0.5"
              >
                <span>View Rescue Plan</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Quadrants Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. What's DONE */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-md">
          <div className="flex items-center space-x-2 text-emerald-400 mb-4 pb-2 border-b border-slate-800">
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
                <div key={idx} className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-emerald-300">{item.title}</h3>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {item.fileEvidence}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{item.description}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 2. What's BROKEN */}
        <div className="bg-slate-900/90 border border-rose-900/30 rounded-2xl p-6 shadow-md bg-gradient-to-b from-rose-950/10 to-transparent">
          <div className="flex items-center space-x-2 text-rose-400 mb-4 pb-2 border-b border-slate-800">
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
                <div key={idx} className="bg-slate-950/80 p-3.5 rounded-xl border border-rose-500/20 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-rose-300">{item.title}</h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-500/20 text-rose-400">
                      {item.severity}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">{item.errorExplanation}</p>
                  <div className="text-[11px] text-amber-300/90 font-mono bg-amber-950/20 p-2 rounded border border-amber-500/20">
                    <strong>Root Cause:</strong> {item.rootCause}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono truncate">
                    File: {item.fileEvidence}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 3. What's MISSING */}
        <div className="bg-slate-900/90 border border-amber-900/30 rounded-2xl p-6 shadow-md bg-gradient-to-b from-amber-950/10 to-transparent">
          <div className="flex items-center space-x-2 text-amber-400 mb-4 pb-2 border-b border-slate-800">
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
                <div key={idx} className="bg-slate-950/80 p-3.5 rounded-xl border border-amber-500/20 space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-amber-300">{item.title}</h3>
                    <span className="text-[10px] font-mono text-slate-400 uppercase bg-slate-900 px-2 py-0.5 rounded">
                      {item.priority} Priority
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">{item.whyMissing}</p>
                  <p className="text-[11px] text-slate-400 italic">
                    Requirement: "{item.requirementReference}"
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 4. What's UNVERIFIABLE */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-md">
          <div className="flex items-center space-x-2 text-indigo-400 mb-4 pb-2 border-b border-slate-800">
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
                <div key={idx} className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 space-y-1">
                  <h3 className="text-xs font-bold text-indigo-300">{item.title}</h3>
                  <p className="text-xs text-slate-400">{item.reason}</p>
                  <div className="text-[11px] text-slate-300 font-mono bg-slate-900 p-2 rounded border border-slate-800">
                    <strong>Suggested Test:</strong> {item.suggestedVerification}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
