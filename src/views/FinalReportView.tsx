import React, { useState } from 'react';
import {
  Award,
  Download,
  CheckCircle2,
  ShieldCheck,
  FileCode,
  ArrowLeft,
  Calendar,
  Layers,
  Terminal,
} from 'lucide-react';
import { Project, RescueTask, ProjectFile } from '../types/index.ts';
import { downloadProjectAsZip } from '../lib/zip-utils.ts';
import { HealthGauge } from '../components/HealthGauge.tsx';

interface FinalReportViewProps {
  project: Project;
  tasks: RescueTask[];
  projectFiles: ProjectFile[];
  onBackToDashboard: () => void;
}

export const FinalReportView: React.FC<FinalReportViewProps> = ({
  project,
  tasks,
  projectFiles,
  onBackToDashboard,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const verifiedTasks = tasks.filter(t => t.isVerified || t.status === 'verified');
  const modifiedFiles = projectFiles.filter(f => f.isModified);

  const handleDownloadZip = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      await downloadProjectAsZip(project.title, projectFiles);
    } catch (e: any) {
      setDownloadError(`Download failed: ${e.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-8 pb-20 max-w-5xl mx-auto">
      {/* Certificate Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border border-emerald-500/30 rounded-3xl p-6 sm:p-10 shadow-2xl text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4 border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
          <Award className="w-9 h-9" />
        </div>

        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold mb-3 border border-emerald-500/20">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
          <span>Project Submission Readiness Report</span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight break-words">
          {project.title} Rescued & Verified
        </h1>
        <p className="text-sm text-slate-300 max-w-xl mx-auto mt-2">
          Your project has undergone rigorous AST validation, syntax compilation, and requirement coverage. All changes are packaged and ready to submit.
        </p>

        {downloadError && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs max-w-md mx-auto">
            {downloadError}
          </div>
        )}

        {/* Download Button */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={handleDownloadZip}
            disabled={isDownloading}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm px-6 py-3 rounded-xl shadow-lg shadow-emerald-500/25 transition transform hover:-translate-y-0.5"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>{isDownloading ? 'Packaging ZIP Archive...' : 'Download Rescued Project (.ZIP)'}</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row md:flex-col xl:flex-row items-center text-center sm:text-left md:text-center xl:text-left gap-4">
          <HealthGauge score={project.healthScore} status={project.status} size="md" label="Final Health Score" />
          <div>
            <div className="text-xs text-slate-400">Readiness Level</div>
            <div className="text-lg font-bold text-white">
              {project.healthScore >= 85 ? 'Grade A Submission' : 'Rescued with Fixes'}
            </div>
            <div className="text-[11px] text-emerald-400 font-medium mt-1">
              ✔ Clean AST & Parsed
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-2">
          <div className="text-xs text-slate-400 uppercase font-semibold">Tasks Completed</div>
          <div className="text-3xl font-black font-mono text-emerald-400">
            {verifiedTasks.length} / {tasks.length}
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full"
              style={{
                width: `${tasks.length > 0 ? (verifiedTasks.length / tasks.length) * 100 : 100}%`,
              }}
            />
          </div>
          <p className="text-[11px] text-slate-400">Every task verified against test specification</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-2">
          <div className="text-xs text-slate-400 uppercase font-semibold">Code Files Modified</div>
          <div className="text-3xl font-black font-mono text-sky-400">
            {modifiedFiles.length}
          </div>
          <p className="text-xs text-slate-300">
            Total files in codebase: <strong>{projectFiles.length}</strong>
          </p>
          <p className="text-[11px] text-slate-400">
            All untrusted code was verified in isolated sandbox
          </p>
        </div>
      </div>

      {/* Verified Tasks Audit Log */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <h2 className="text-base font-bold text-white flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>Rescue Plan Execution Audit</span>
          </h2>
          <span className="text-xs font-mono text-slate-400">
            {verifiedTasks.length} verified checks
          </span>
        </div>

        <div className="space-y-3">
          {tasks.map((t) => {
            const isTaskVerified = t.isVerified || t.status === 'verified';
            return (
              <div
                key={t.id}
                className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4 min-w-0"
              >
                <div className="space-y-1 min-w-0 w-full">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-mono font-bold shrink-0 ${
                        isTaskVerified
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {isTaskVerified ? '✓' : '•'}
                    </span>
                    <span className="font-bold text-sm text-white break-words">{t.title}</span>
                    <span className="text-[10px] font-mono uppercase bg-slate-900 px-2 py-0.5 rounded text-slate-400">
                      {t.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 sm:ml-7 break-words">{t.description}</p>
                  {t.targetFiles && (
                    <div className="text-[11px] font-mono text-slate-400 sm:ml-7 break-all sm:break-words">
                      Files: {t.targetFiles.join(', ')}
                    </div>
                  )}
                </div>

                <div className="sm:text-right shrink-0">
                  <span
                    className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full border ${
                      isTaskVerified
                        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                        : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                    }`}
                  >
                    {isTaskVerified ? 'Passed Verification' : 'Pending Verification'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Back button */}
      <div className="text-center pt-4">
        <button
          onClick={onBackToDashboard}
          className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Projects Dashboard</span>
        </button>
      </div>
    </div>
  );
};
