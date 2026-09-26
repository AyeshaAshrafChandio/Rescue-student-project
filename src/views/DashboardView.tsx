import React from 'react';
import {
  Plus,
  Clock,
  ArrowRight,
  Trash2,
  Layers,
  Github,
  FileArchive,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Project } from '../types/index.ts';
import { HealthGauge } from '../components/HealthGauge.tsx';

interface DashboardViewProps {
  projects: Project[];
  onSelectProject: (project: Project, targetView: 'analysis' | 'plan' | 'workspace' | 'report') => void;
  onOpenCreateModal: () => void;
  onDeleteProject: (projectId: string) => void;
  onRetryAnalysis?: (project: Project) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  projects,
  onSelectProject,
  onOpenCreateModal,
  onDeleteProject,
  onRetryAnalysis,
}) => {
  const formatDeadline = (dateStr?: string) => {
    if (!dateStr) return 'No deadline set';
    const deadlineDate = new Date(dateStr);
    const now = new Date();
    const diffHours = Math.round((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60));

    if (diffHours < 0) return 'Deadline passed!';
    if (diffHours === 0) return 'Due in less than 1 hour!';
    if (diffHours <= 24) return `Due in ${diffHours} hours`;
    const days = Math.round(diffHours / 24);
    return `Due in ${days} days`;
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-slate-800 p-5 sm:p-8 lg:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
            <span>Automated Codebase Rescue & Verification</span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
            Rescue your project <br className="hidden sm:block" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-rose-400 via-amber-300 to-indigo-400">
              before the deadline.
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Turn incomplete, broken student assignments into submission-ready code.
            Deep Gemini AST inspection detects what is <strong>DONE</strong>, <strong>BROKEN</strong>, and <strong>MISSING</strong>,
            guides you through an actionable rescue plan with <strong>Autonomous Code AI</strong>, and verifies every fix with real tests.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenCreateModal}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-semibold text-sm px-6 py-3 rounded-xl shadow-lg shadow-rose-500/25 transition transform hover:-translate-y-0.5"
            >
              <Plus className="w-5 h-5 shrink-0" />
              <span>Rescue A Project Now</span>
            </button>
          </div>
        </div>
      </div>

      {/* Projects Section */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Active Rescues</h2>
            <p className="text-xs text-slate-400">Track real codebase health, fixes, and verification status</p>
          </div>
          {projects.length > 0 && (
            <button
              onClick={onOpenCreateModal}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 shrink-0"
            >
              <span>+ New Project</span>
            </button>
          )}
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-12 sm:py-16 px-4 bg-slate-900/40 rounded-2xl border border-slate-800/80">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-4">
              <Layers className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">No Projects in Rescue Pipeline</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mb-6">
              Upload your incomplete university project ZIP or connect a GitHub repository. We will inspect your real files, find bugs, and generate a step-by-step fix plan.
            </p>
            <button
              onClick={onOpenCreateModal}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition"
            >
              + Create Your First Rescue
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {projects.map((proj) => {
              const deadlineInfo = formatDeadline(proj.deadline);
              const isUrgent = deadlineInfo.includes('hour') || deadlineInfo.includes('passed');
              const isAnalyzing = proj.status === 'analyzing' || proj.status === 'created';
              const isUnanalyzedOrFailed = proj.status === 'failed' || (!isAnalyzing && proj.healthScore <= 0);

              return (
                <div
                  key={proj.id}
                  className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 sm:p-6 transition shadow-lg flex flex-col justify-between min-w-0"
                >
                  <div>
                    {/* Top Row: Title & Source badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-base sm:text-lg text-white group-hover:text-indigo-400 transition break-words">
                            {proj.title}
                          </h3>
                          <span
                            className={`flex items-center space-x-1 text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                              proj.sourceType === 'github'
                                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {proj.sourceType === 'github' ? (
                              <>
                                <Github className="w-3 h-3 shrink-0" />
                                <span>GitHub</span>
                              </>
                            ) : (
                              <>
                                <FileArchive className="w-3 h-3 shrink-0" />
                                <span>ZIP</span>
                              </>
                            )}
                          </span>
                        </div>
                        {proj.description && (
                          <p className="text-xs text-slate-400 line-clamp-2 break-words">{proj.description}</p>
                        )}
                      </div>

                      <button
                        onClick={() => onDeleteProject(proj.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded transition shrink-0"
                        title="Delete Project"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Deadline and Target tech */}
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                      <div
                        className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg ${
                          isUrgent
                            ? 'bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>{deadlineInfo}</span>
                      </div>

                      {proj.targetTechStack && (
                        <div className="bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg font-mono text-[11px] break-words max-w-full">
                          {proj.targetTechStack}
                        </div>
                      )}
                    </div>

                    {/* Health Gauge & Progress */}
                    <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center bg-slate-950/40 p-3.5 sm:p-4 rounded-xl border border-slate-800/80">
                      <div className="sm:col-span-1">
                        <HealthGauge
                          score={proj.healthScore}
                          status={proj.status}
                          size="sm"
                          label="Code Health"
                        />
                      </div>

                      <div className="sm:col-span-2 space-y-2 min-w-0">
                        <div className="flex items-center justify-between text-xs gap-2">
                          <span className="text-slate-400 font-medium">Rescue Tasks Progress:</span>
                          {isAnalyzing ? (
                            <span className="font-mono font-semibold text-indigo-400 animate-pulse">
                              Analyzing AST…
                            </span>
                          ) : isUnanalyzedOrFailed ? (
                            <span className="font-mono font-semibold text-amber-400">
                              Pending Analysis
                            </span>
                          ) : (
                            <span className="font-mono font-bold text-slate-200">
                              {proj.progressPercent}%
                            </span>
                          )}
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              isAnalyzing
                                ? 'bg-indigo-500/70 animate-pulse w-1/3'
                                : isUnanalyzedOrFailed
                                ? 'bg-amber-500/40 w-1/5'
                                : 'bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400'
                            }`}
                            style={
                              !isAnalyzing && !isUnanalyzedOrFailed
                                ? { width: `${proj.progressPercent}%` }
                                : undefined
                            }
                          />
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {isAnalyzing
                            ? 'Gemini is inspecting your codebase and requirements…'
                            : isUnanalyzedOrFailed
                            ? 'Analysis paused due to high API demand — click Retry Analysis below.'
                            : proj.healthScore >= 90
                            ? '✔ Codebase is submission-ready!'
                            : 'Critical bugs or missing requirements pending fix.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-6 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onSelectProject(proj, 'analysis')}
                        className="text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-800/60 transition"
                      >
                        View Report
                      </button>
                      <button
                        onClick={() => onSelectProject(proj, 'plan')}
                        className="text-indigo-400 hover:text-indigo-300 px-2.5 py-1.5 rounded-lg hover:bg-slate-800/60 transition"
                      >
                        Rescue Plan
                      </button>
                    </div>

                    {isUnanalyzedOrFailed && onRetryAnalysis ? (
                      <button
                        onClick={() => onRetryAnalysis(proj)}
                        className="w-full sm:w-auto flex items-center justify-center space-x-1.5 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white px-4 py-2 rounded-xl shadow-md transition"
                      >
                        <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                        <span>Retry Analysis</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => onSelectProject(proj, isAnalyzing ? 'analysis' : 'workspace')}
                        className="w-full sm:w-auto flex items-center justify-center space-x-1.5 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white px-4 py-2 rounded-xl shadow-md transition"
                      >
                        {isAnalyzing ? (
                          <>
                            <Sparkles className="w-3.5 h-3.5 shrink-0 animate-spin" />
                            <span>View Live Analysis</span>
                          </>
                        ) : (
                          <>
                            <span>Open Workspace</span>
                            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
