import React from 'react';
import { ProjectStatus } from '../types/index.ts';

interface HealthGaugeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  status?: ProjectStatus;
}

export const HealthGauge: React.FC<HealthGaugeProps> = ({
  score,
  size = 'md',
  label = 'Project Health',
  status,
}) => {
  const isAnalyzing = status === 'analyzing' || status === 'created';
  const isUnanalyzedOrFailed = status === 'failed' || (!isAnalyzing && score <= 0);

  const getScoreColor = (val: number) => {
    if (isAnalyzing) return 'text-indigo-400 stroke-indigo-500';
    if (isUnanalyzedOrFailed) return 'text-amber-400 stroke-amber-500';
    if (val >= 85) return 'text-emerald-400 stroke-emerald-500';
    if (val >= 70) return 'text-sky-400 stroke-sky-500';
    if (val >= 50) return 'text-amber-400 stroke-amber-500';
    return 'text-rose-500 stroke-rose-500';
  };

  const getGrade = (val: number) => {
    if (isAnalyzing) return 'Gemini AST Scan...';
    if (isUnanalyzedOrFailed) return 'Pending Analysis';
    if (val >= 90) return 'A (Submission Ready)';
    if (val >= 80) return 'B (Good Condition)';
    if (val >= 70) return 'C (Needs Work)';
    if (val >= 50) return 'D (At Risk)';
    return 'F (Critical Fail)';
  };

  const radius = size === 'sm' ? 32 : size === 'lg' ? 42 : 38;
  const svgDim = size === 'sm' ? 84 : size === 'lg' ? 116 : 104;
  const center = svgDim / 2;
  const strokeWidth = size === 'sm' ? 7 : 9;
  const circumference = 2 * Math.PI * radius;

  const displayFillPercent = isAnalyzing
    ? 35
    : isUnanalyzedOrFailed
    ? 20
    : Math.min(100, Math.max(0, score));
  const strokeDashoffset = circumference - (displayFillPercent / 100) * circumference;

  return (
    <div
      className={`flex flex-col items-center justify-center bg-slate-900/80 rounded-2xl border border-slate-800 shadow-inner ${
        size === 'sm' ? 'p-3' : 'p-4'
      }`}
    >
      <div className="relative flex items-center justify-center">
        <svg
          width={svgDim}
          height={svgDim}
          viewBox={`0 0 ${svgDim} ${svgDim}`}
          className={`transform -rotate-90 shrink-0 ${isAnalyzing ? 'animate-spin' : ''}`}
        >
          <circle
            cx={center}
            cy={center}
            r={radius}
            className="stroke-slate-800"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            className={`transition-all duration-1000 ease-out ${getScoreColor(score)}`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span
            className={`font-black font-mono tracking-tight ${
              size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-xl'
            } ${getScoreColor(score)}`}
          >
            {isAnalyzing ? 'SCAN' : isUnanalyzedOrFailed ? '—' : `${score}%`}
          </span>
          <span className="text-[10px] uppercase font-bold text-slate-400">
            {isAnalyzing ? 'Active' : isUnanalyzedOrFailed ? 'Pending' : 'Score'}
          </span>
        </div>
      </div>
      <div className="mt-2 text-center">
        <div className="text-xs font-semibold text-slate-300">{label}</div>
        <div className="text-[11px] font-mono text-slate-400">{getGrade(score)}</div>
      </div>
    </div>
  );
};
