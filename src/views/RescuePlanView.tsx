import React from 'react';
import {
  ListOrdered,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Sparkles,
  ShieldCheck,
  Flame,
} from 'lucide-react';
import { Project, RescueTask } from '../types/index.ts';

interface RescuePlanViewProps {
  project: Project;
  tasks: RescueTask[];
  onSelectTask: (task: RescueTask) => void;
  onProceedToReport: () => void;
}

export const RescuePlanView: React.FC<RescuePlanViewProps> = ({
  project,
  tasks,
  onSelectTask,
  onProceedToReport,
}) => {
  const verifiedCount = tasks.filter(t => t.isVerified || t.status === 'verified').length;
  const allVerified = tasks.length > 0 && verifiedCount === tasks.length;
  const totalMinutes = tasks.reduce((acc, t) => acc + (t.estimatedMinutes || 15), 0);

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical':
        return (
          <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <Flame className="w-3 h-3" />
            <span>Critical Blocker</span>
          </span>
        );
      case 'high':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
            High Priority
          </span>
        );
      case 'medium':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            Medium
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400">
            Low
          </span>
        );
    }
  };

  const getStatusBadge = (status: string, isVerified?: boolean) => {
    if (isVerified || status === 'verified') {
      return (
        <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Verified & Tested</span>
        </span>
      );
    }
    if (status === 'applied') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/20 text-sky-400 border border-sky-500/30">
          Changes Applied (Needs Test)
        </span>
      );
    }
    if (status === 'in_progress') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
          In Rescue Workspace
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400">
        Pending
      </span>
    );
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Plan Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
              <ListOrdered className="w-3.5 h-3.5" />
              <span>Prioritized Sequence</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Actionable Rescue Plan: {project.title}
            </h1>
            <p className="text-sm text-slate-300">
              Address critical bugs first to unblock builds, implement missing required routes, and run isolated verification tests.
            </p>
          </div>

          <div className="flex items-center space-x-4 bg-slate-950/60 p-4 rounded-2xl border border-slate-800 shrink-0">
            <div className="text-center px-2">
              <div className="text-xs text-slate-400">Total Tasks</div>
              <div className="text-xl font-bold font-mono text-white">{tasks.length}</div>
            </div>
            <div className="w-px h-8 bg-slate-800" />
            <div className="text-center px-2">
              <div className="text-xs text-slate-400">Verified</div>
              <div className="text-xl font-bold font-mono text-emerald-400">{verifiedCount}</div>
            </div>
            <div className="w-px h-8 bg-slate-800" />
            <div className="text-center px-2">
              <div className="text-xs text-slate-400">Est. Time</div>
              <div className="text-xl font-bold font-mono text-amber-400">~{totalMinutes}m</div>
            </div>
          </div>
        </div>

        {allVerified && (
          <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between">
            <div className="flex items-center space-x-3 text-emerald-400">
              <ShieldCheck className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="font-bold text-sm text-white">All Rescue Tasks Passed Real Verification!</h3>
                <p className="text-xs text-emerald-400/90">Your codebase is submission-ready.</p>
              </div>
            </div>
            <button
              onClick={onProceedToReport}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2 rounded-xl transition"
            >
              Generate Final Report & Download ZIP
            </button>
          </div>
        )}
      </div>

      {/* Task List */}
      <div className="space-y-4">
        {tasks.map((task, index) => {
          const isDone = task.isVerified || task.status === 'verified';

          return (
            <div
              key={task.id}
              className={`bg-slate-900 border rounded-2xl p-5 transition shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                isDone
                  ? 'border-emerald-500/30 bg-gradient-to-r from-slate-900 to-emerald-950/10'
                  : task.priority === 'critical'
                  ? 'border-rose-500/30 bg-gradient-to-r from-slate-900 to-rose-950/10'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Task Left Info */}
              <div className="flex items-start space-x-4">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-bold text-sm shrink-0 ${
                    isDone
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  {isDone ? <CheckCircle2 className="w-5 h-5" /> : index + 1}
                </div>

                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-base text-white">{task.title}</h3>
                    {getPriorityBadge(task.priority)}
                    {getStatusBadge(task.status, task.isVerified)}
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                    {task.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 pt-1 font-mono">
                    <span className="text-[11px] bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      {task.category.replace('_', ' ').toUpperCase()}
                    </span>
                    {task.targetFiles && task.targetFiles.length > 0 && (
                      <span className="flex items-center space-x-1 text-slate-400 text-[11px]">
                        <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{task.targetFiles.join(', ')}</span>
                      </span>
                    )}
                    <span className="text-slate-500">•</span>
                    <span className="flex items-center space-x-1 text-[11px] text-amber-400/90">
                      <Clock className="w-3 h-3" />
                      <span>~{task.estimatedMinutes || 15} mins</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Task Action Right */}
              <div className="shrink-0 self-end md:self-center">
                <button
                  onClick={() => onSelectTask(task)}
                  className={`flex items-center space-x-2 text-xs font-semibold px-4 py-2.5 rounded-xl shadow-md transition ${
                    isDone
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      : 'bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white shadow-rose-500/20'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>{isDone ? 'Review in Workspace' : 'Fix in AI Workspace'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
