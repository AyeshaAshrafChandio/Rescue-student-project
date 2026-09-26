import React from 'react';

interface HealthGaugeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export const HealthGauge: React.FC<HealthGaugeProps> = ({ score, size = 'md', label = 'Project Health' }) => {
  const getScoreColor = (val: number) => {
    if (val >= 85) return 'text-emerald-400 stroke-emerald-500';
    if (val >= 70) return 'text-sky-400 stroke-sky-500';
    if (val >= 50) return 'text-amber-400 stroke-amber-500';
    return 'text-rose-500 stroke-rose-500';
  };

  const getGrade = (val: number) => {
    if (val >= 90) return 'A (Submission Ready)';
    if (val >= 80) return 'B (Good Condition)';
    if (val >= 70) return 'C (Needs Work)';
    if (val >= 50) return 'D (At Risk)';
    return 'F (Critical Fail)';
  };

  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-slate-900/80 rounded-2xl border border-slate-800 shadow-inner">
      <div className="relative flex items-center justify-center">
        <svg className="w-28 h-28 transform -rotate-90">
          <circle
            cx="56"
            cy="56"
            r={radius}
            className="stroke-slate-800"
            strokeWidth="9"
            fill="transparent"
          />
          <circle
            cx="56"
            cy="56"
            r={radius}
            className={`transition-all duration-1000 ease-out ${getScoreColor(score)}`}
            strokeWidth="9"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className={`text-2xl font-black font-mono tracking-tight ${getScoreColor(score)}`}>
            {score}%
          </span>
          <span className="text-[10px] uppercase font-bold text-slate-400">Score</span>
        </div>
      </div>
      <div className="mt-2 text-center">
        <div className="text-xs font-semibold text-slate-300">{label}</div>
        <div className="text-[11px] font-mono text-slate-400">{getGrade(score)}</div>
      </div>
    </div>
  );
};
