import React, { useState } from 'react';
import {
  Sparkles,
  Play,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  FileCode,
  Check,
  RotateCcw,
  Terminal,
  ShieldCheck,
  Send,
  HelpCircle,
  Eye,
} from 'lucide-react';
import { Project, RescueTask, ProjectFile } from '../types/index.ts';
import { DiffViewer } from '../components/DiffViewer.tsx';

interface AiWorkspaceViewProps {
  project: Project;
  tasks: RescueTask[];
  currentTask: RescueTask;
  projectFiles: ProjectFile[];
  onSelectTask: (task: RescueTask) => void;
  onApplyChanges: (task: RescueTask, proposedFiles: Array<{ filePath: string; newContent: string }>) => Promise<void>;
  onVerifyTask: (task: RescueTask) => Promise<{ status: 'passed' | 'failed'; stdout: string; stderr: string; passedChecks: string[]; failedChecks: string[] }>;
  onAskAiFix: (task: RescueTask, userMessage?: string) => Promise<{ explanation: string; rootCause: string; proposedChanges: Array<{ filePath: string; description: string; newContent: string }>; verificationAdvice?: string }>;
  onProceedToNextTask: () => void;
}

export const AiWorkspaceView: React.FC<AiWorkspaceViewProps> = ({
  project,
  tasks,
  currentTask,
  projectFiles,
  onSelectTask,
  onApplyChanges,
  onVerifyTask,
  onAskAiFix,
  onProceedToNextTask,
}) => {
  const [activeFileTab, setActiveFileTab] = useState<string>(
    currentTask.targetFiles?.[0] || (projectFiles[0]?.filePath || '')
  );

  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(currentTask.rootCauseAnalysis || null);
  const [proposedChanges, setProposedChanges] = useState<
    Array<{ filePath: string; description: string; newContent: string }>
  >(currentTask.proposedChanges || []);

  const [activeDiffFile, setActiveDiffFile] = useState<string | null>(null);
  const [userCustomPrompt, setUserCustomPrompt] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    status: 'passed' | 'failed';
    stdout: string;
    stderr: string;
    passedChecks: string[];
    failedChecks: string[];
  } | null>(
    currentTask.verificationOutput
      ? {
          status: currentTask.isVerified ? 'passed' : 'failed',
          stdout: currentTask.verificationOutput,
          stderr: '',
          passedChecks: [],
          failedChecks: [],
        }
      : null
  );

  const [appliedFiles, setAppliedFiles] = useState<Record<string, boolean>>({});

  // Active file content
  const activeFile = projectFiles.find(f => f.filePath === activeFileTab);

  const handleDiagnoseTask = async (customMessage?: string) => {
    setIsDiagnosing(true);
    setVerificationResult(null);

    try {
      const data = await onAskAiFix(currentTask, customMessage || userCustomPrompt || undefined);

      setAiExplanation(data.explanation + '\n\n**Root Cause:** ' + data.rootCause);
      setProposedChanges(data.proposedChanges || []);
      if (data.proposedChanges?.length > 0) {
        setActiveDiffFile(data.proposedChanges[0].filePath);
      }
      setUserCustomPrompt('');
    } catch (err: any) {
      alert(`AI Assistant Error: ${err.message}`);
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleApplySingleFile = async (filePath: string, newContent: string) => {
    await onApplyChanges(currentTask, [{ filePath, newContent }]);
    setAppliedFiles(prev => ({ ...prev, [filePath]: true }));
  };

  const handleApplyAllChanges = async () => {
    if (proposedChanges.length === 0) return;
    await onApplyChanges(
      currentTask,
      proposedChanges.map(p => ({ filePath: p.filePath, newContent: p.newContent }))
    );
    const newApplied: Record<string, boolean> = {};
    proposedChanges.forEach(p => {
      newApplied[p.filePath] = true;
    });
    setAppliedFiles(newApplied);
  };

  const handleRunVerification = async () => {
    setIsVerifying(true);
    try {
      const result = await onVerifyTask(currentTask);
      setVerificationResult(result);
    } catch (e: any) {
      alert(`Verification error: ${e.message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const isCurrentTaskVerified = currentTask.isVerified || currentTask.status === 'verified' || verificationResult?.status === 'passed';

  return (
    <div className="space-y-6 pb-20">
      {/* Workspace Header & Task Selector */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center space-x-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Autonomous Code Engine</span>
            </span>
            <span className="text-xs text-slate-400">
              Task #{currentTask.taskOrder || 1} of {tasks.length}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {currentTask.title}
          </h1>
          <p className="text-xs text-slate-300 max-w-2xl">{currentTask.description}</p>
        </div>

        {/* Task Switcher dropdown */}
        <div className="flex items-center space-x-3 shrink-0">
          <div className="relative">
            <select
              value={currentTask.id}
              onChange={(e) => {
                const found = tasks.find(t => t.id === e.target.value);
                if (found) onSelectTask(found);
              }}
              className="bg-slate-950 border border-slate-700 text-xs font-semibold text-slate-200 rounded-xl px-3 py-2 pr-8 focus:outline-none focus:border-indigo-500"
            >
              {tasks.map((t, idx) => (
                <option key={t.id} value={t.id}>
                  #{idx + 1}: {t.title.slice(0, 30)}... {t.isVerified ? '✔' : ''}
                </option>
              ))}
            </select>
          </div>

          {isCurrentTaskVerified && (
            <button
              onClick={onProceedToNextTask}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2 rounded-xl transition flex items-center space-x-1 shadow-lg shadow-emerald-500/20"
            >
              <span>Next Task</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Code Files Editor / Preview (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
            {/* File Tabs */}
            <div className="bg-slate-900/90 px-3 py-2 border-b border-slate-800 flex items-center space-x-1 overflow-x-auto">
              {projectFiles.map(file => {
                const isTarget = currentTask.targetFiles?.some(tf => tf === file.filePath || file.filePath.endsWith(tf));
                const isSelected = activeFileTab === file.filePath;

                return (
                  <button
                    key={file.id}
                    onClick={() => setActiveFileTab(file.filePath)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition shrink-0 ${
                      isSelected
                        ? 'bg-slate-800 text-white font-semibold shadow-sm border border-slate-700'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <FileCode className={`w-3.5 h-3.5 ${isTarget ? 'text-rose-400' : 'text-indigo-400'}`} />
                    <span>{file.filePath}</span>
                    {isTarget && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 ml-1" title="Target File for this Task" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Code Content */}
            <div className="p-4 max-h-[550px] overflow-auto font-mono text-xs text-slate-300 leading-relaxed bg-slate-950">
              {activeFile ? (
                <div className="space-y-0.5">
                  {activeFile.content.split('\n').map((line, idx) => (
                    <div key={idx} className="flex items-start hover:bg-slate-900/60 rounded px-1.5 py-0.5">
                      <span className="w-8 select-none text-slate-600 text-right pr-3">{idx + 1}</span>
                      <span className="flex-1 whitespace-pre-wrap break-all">{line || ' '}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 text-slate-500">No file selected.</div>
              )}
            </div>
          </div>

          {/* Diff Viewer if proposed changes exist */}
          {proposedChanges.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Proposed Code Changes ({proposedChanges.length})
                  </span>
                  <div className="flex space-x-1">
                    {proposedChanges.map(p => (
                      <button
                        key={p.filePath}
                        onClick={() => setActiveDiffFile(p.filePath)}
                        className={`text-xs font-mono px-2.5 py-0.5 rounded-lg transition ${
                          activeDiffFile === p.filePath
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {p.filePath}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleApplyAllChanges}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3.5 py-1.5 rounded-lg shadow-sm transition"
                >
                  Apply All Changes
                </button>
              </div>

              {activeDiffFile && (
                (() => {
                  const targetProposal = proposedChanges.find(p => p.filePath === activeDiffFile);
                  const originalFile = projectFiles.find(f => f.filePath === activeDiffFile);
                  if (!targetProposal) return null;

                  return (
                    <DiffViewer
                      filePath={targetProposal.filePath}
                      oldContent={originalFile?.content || ''}
                      newContent={targetProposal.newContent}
                      onApply={() => handleApplySingleFile(targetProposal.filePath, targetProposal.newContent)}
                      isApplied={!!appliedFiles[targetProposal.filePath]}
                    />
                  );
                })()
              )}
            </div>
          )}
        </div>

        {/* Right Column: AI Assistant & Real Verification (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* AI Code Engine Assistant Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2 text-white font-bold text-sm">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center shadow-sm">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <span>Gemini Autonomous Code Engine</span>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Active Engine
              </span>
            </div>

            {/* Explanation or Prompt */}
            {aiExplanation ? (
              <div className="space-y-3">
                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto font-sans">
                  {aiExplanation}
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleDiagnoseTask()}
                    disabled={isDiagnosing}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2 rounded-xl border border-slate-700 transition"
                  >
                    {isDiagnosing ? 'Analyzing...' : 'Re-diagnose Task'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 space-y-3">
                <p className="text-xs text-slate-400 leading-relaxed">
                  The Autonomous Code Engine will inspect <strong>{currentTask.targetFiles?.join(', ') || 'the project files'}</strong>,
                  find the root cause of the bug or missing requirement, and write the complete corrected code.
                </p>
                <button
                  onClick={() => handleDiagnoseTask()}
                  disabled={isDiagnosing}
                  className="bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-rose-500/20 transition transform hover:-translate-y-0.5"
                >
                  <Sparkles className="w-4 h-4 inline-block mr-1.5" />
                  <span>{isDiagnosing ? 'Analyzing Codebase...' : 'Diagnose & Propose Solution'}</span>
                </button>
              </div>
            )}

            {/* User Custom Instruction Input */}
            <div className="pt-2 flex items-center space-x-2">
              <input
                type="text"
                placeholder="Ask a question or give specific fix guidance..."
                value={userCustomPrompt}
                onChange={(e) => setUserCustomPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isDiagnosing && userCustomPrompt.trim()) {
                    handleDiagnoseTask(userCustomPrompt);
                  }
                }}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={() => handleDiagnoseTask(userCustomPrompt)}
                disabled={isDiagnosing || !userCustomPrompt.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white p-2 rounded-xl transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Real Verification Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2 text-white font-bold text-sm">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>Isolated Code Verification</span>
              </div>
              <button
                onClick={handleRunVerification}
                disabled={isVerifying}
                className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg shadow-sm transition disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{isVerifying ? 'Running Checks...' : 'Run Real Verification'}</span>
              </button>
            </div>

            {/* Test command note */}
            {currentTask.testCommand && (
              <div className="text-[11px] font-mono text-slate-400 bg-slate-950 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-500">Target Rule:</span> {currentTask.testCommand}
              </div>
            )}

            {/* Verification Results Console */}
            {verificationResult ? (
              <div className="space-y-3">
                <div
                  className={`p-3 rounded-xl border flex items-center space-x-2.5 text-xs font-semibold ${
                    verificationResult.status === 'passed'
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                  }`}
                >
                  {verificationResult.status === 'passed' ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      <span>Verification Passed! AST syntax checks and dependencies are clean.</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                      <span>Verification Failed: Issues detected in codebase.</span>
                    </>
                  )}
                </div>

                {/* Real Stdout/Stderr Console Box */}
                <div className="bg-black/90 p-3 rounded-xl font-mono text-[11px] leading-relaxed max-h-52 overflow-y-auto text-slate-300 border border-slate-800">
                  <div className="text-slate-500 mb-1">$ /engine/run-verification --isolate --ast --manifest</div>
                  {verificationResult.stdout.split('\n').map((line, i) => (
                    <div
                      key={i}
                      className={
                        line.startsWith('✔')
                          ? 'text-emerald-400'
                          : line.startsWith('✖')
                          ? 'text-rose-400'
                          : line.startsWith('ℹ')
                          ? 'text-sky-400'
                          : 'text-slate-400'
                      }
                    >
                      {line}
                    </div>
                  ))}
                  {verificationResult.stderr && (
                    <div className="text-rose-400 mt-2 font-bold whitespace-pre-wrap">
                      {verificationResult.stderr}
                    </div>
                  )}
                </div>

                {/* If failed: Suggest fixing with AI */}
                {verificationResult.status === 'failed' && (
                  <button
                    onClick={() =>
                      handleDiagnoseTask(
                        `Verification failed with errors: ${verificationResult.stderr || verificationResult.stdout}. Please inspect and correct the bug.`
                      )
                    }
                    className="w-full bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-semibold text-xs py-2 rounded-xl transition flex items-center justify-center space-x-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Have AI Diagnose & Fix This Failure</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-slate-500">
                Click <strong>"Run Real Verification"</strong> to execute AST syntax parsing, JSON schema validation, and dependency checks on the current code.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
