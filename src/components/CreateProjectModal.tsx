import React, { useState } from 'react';
import { X, Upload, Github, Sparkles, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import { extractZipFile } from '../lib/zip-utils.ts';
import { importFromGithub } from '../lib/project-service.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { Project, ProjectFile } from '../types/index.ts';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (project: Project, files: ProjectFile[]) => Promise<void>;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated,
}) => {
  const { user, getIdToken, requireAuthForAction } = useAuth();
  const [sourceType, setSourceType] = useState<'zip' | 'github'>('zip');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [requirements, setRequirements] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [githubBranch, setGithubBranch] = useState('main');
  const [githubToken, setGithubToken] = useState('');

  const [extractedFiles, setExtractedFiles] = useState<Array<{ filePath: string; content: string; size: number }>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetFormState = () => {
    setTitle('');
    setDescription('');
    setDeadline('');
    setRequirements('');
    setRepoUrl('');
    setGithubBranch('main');
    setGithubToken('');
    setExtractedFiles([]);
    setErrorMsg(null);
  };

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setErrorMsg(null);
    setIsProcessing(true);
    try {
      const firstFile = selectedFiles[0];
      if (selectedFiles.length === 1 && firstFile.name.toLowerCase().endsWith('.zip')) {
        const files = await extractZipFile(firstFile);
        setExtractedFiles(files);
        if (!title) {
          setTitle(firstFile.name.replace(/\.zip$/i, ''));
        }
      } else {
        const directFiles: Array<{ filePath: string; content: string; size: number }> = [];
        for (let i = 0; i < selectedFiles.length; i++) {
          const f = selectedFiles[i];
          if (f.name.toLowerCase().endsWith('.zip')) {
            const zipped = await extractZipFile(f);
            directFiles.push(...zipped);
          } else {
            const content = await f.text();
            directFiles.push({
              filePath: f.webkitRelativePath || f.name,
              content,
              size: content.length,
            });
          }
        }
        if (directFiles.length === 0) {
          throw new Error('No readable source code files selected.');
        }
        setExtractedFiles(directFiles);
        if (!title) {
          setTitle(firstFile.name.replace(/\.[^.]+$/, ''));
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to extract project files.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFetchGitHub = async () => {
    if (!requireAuthForAction({ openCreateModal: true, label: 'GitHub Repository Import' })) {
      onClose();
      return;
    }

    if (!repoUrl.trim()) {
      setErrorMsg('Please enter a GitHub repository URL or owner/repo.');
      return;
    }

    setErrorMsg(null);
    setIsProcessing(true);
    try {
      const token = await getIdToken();
      const data = await importFromGithub(
        repoUrl,
        githubBranch || 'main',
        token,
        githubToken.trim() || undefined
      );
      setExtractedFiles(data.files);
      if (!title) {
        setTitle(data.repoName.split('/')[1] || data.repoName);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'GitHub import error.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireAuthForAction({ openCreateModal: true, label: 'Project Rescue Creation' })) {
      onClose();
      return;
    }

    if (!title.trim()) {
      setErrorMsg('Project title is required.');
      return;
    }
    if (extractedFiles.length === 0) {
      setErrorMsg('Please upload your project ZIP file or fetch a GitHub repository.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    const projectId = `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newProject: Project = {
      id: projectId,
      ownerId: user?.uid || '',
      title: title.trim(),
      description: description.trim(),
      sourceType,
      repoUrl: sourceType === 'github' ? repoUrl : undefined,
      githubBranch: sourceType === 'github' ? githubBranch : undefined,
      requirementsText: requirements.trim(),
      deadline: deadline || undefined,
      healthScore: 0, // will be computed in analysis
      progressPercent: 0,
      status: 'analyzing',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const projectFiles: ProjectFile[] = extractedFiles.map((f, i) => ({
      id: `file-${i}-${Date.now()}`,
      projectId,
      filePath: f.filePath,
      content: f.content,
      size: f.size,
      isModified: false,
      updatedAt: new Date().toISOString(),
    }));

    try {
      await onProjectCreated(newProject, projectFiles);
      resetFormState();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to initialize project.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-4 sm:my-8">
        {/* Header */}
        <div className="bg-slate-950/80 px-4 sm:px-6 py-4 border-b border-slate-800 flex items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold shrink-0">
              +
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white leading-snug">
                Rescue Incomplete Student Project
              </h2>
              <p className="text-xs text-slate-400">
                Ingest real codebase & compare against course requirements
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleCreateSubmit} className="p-4 sm:p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-start space-x-2 break-words">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Source Selection Tabs */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Project Source
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => setSourceType('zip')}
                className={`flex items-center justify-center space-x-2 p-3 rounded-xl border text-sm font-medium transition ${
                  sourceType === 'zip'
                    ? 'bg-slate-800 border-indigo-500 text-white shadow-md'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Upload className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>Upload ZIP File</span>
              </button>

              <button
                type="button"
                onClick={() => setSourceType('github')}
                className={`flex items-center justify-center space-x-2 p-3 rounded-xl border text-sm font-medium transition ${
                  sourceType === 'github'
                    ? 'bg-slate-800 border-indigo-500 text-white shadow-md'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Github className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>GitHub Repository</span>
              </button>
            </div>
          </div>

          {/* Source Input Area */}
          {sourceType === 'zip' ? (
            <div className="border-2 border-dashed border-slate-700/80 hover:border-indigo-500/80 rounded-2xl p-5 sm:p-6 text-center transition bg-slate-950/30">
              <input
                type="file"
                accept=".zip"
                onChange={handleZipUpload}
                id="zip-upload"
                className="hidden"
              />
              <label htmlFor="zip-upload" className="cursor-pointer flex flex-col items-center justify-center">
                <Upload className="w-8 h-8 text-indigo-400 mb-2" />
                <span className="text-sm font-semibold text-slate-200">
                  {extractedFiles.length > 0
                    ? `Extracted ${extractedFiles.length} source code files!`
                    : 'Choose a .zip file or drag & drop'}
                </span>
                <span className="text-xs text-slate-500 mt-1">
                  Supports student projects (React, Node, Python, Java, etc.)
                </span>
              </label>
            </div>
          ) : (
            <div className="space-y-3 bg-slate-950/40 p-3.5 sm:p-4 rounded-xl border border-slate-800">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  GitHub Repository (URL or owner/repo)
                </label>
                <input
                  type="text"
                  placeholder="https://github.com/facebook/react or owner/repo"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-300 mb-1">Branch</label>
                  <input
                    type="text"
                    placeholder="main"
                    value={githubBranch}
                    onChange={(e) => setGithubBranch(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Free GitHub Token (Optional)
                  </label>
                  <div className="relative">
                    <KeyRound className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      placeholder="ghp_... (5,000 req/hr)"
                      value={githubToken}
                      onChange={(e) => setGithubToken(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleFetchGitHub}
                    disabled={isProcessing}
                    className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 py-2.5 rounded-lg transition"
                  >
                    {isProcessing ? 'Fetching Tree...' : 'Fetch Codebase'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Files Summary Indicator */}
          {extractedFiles.length > 0 && (
            <div className="flex items-center space-x-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                Ready: <strong>{extractedFiles.length}</strong> actual files loaded into memory for analysis.
              </span>
            </div>
          )}

          {/* Project Details Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Project Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. CS301 Final Project"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Submission Deadline (Optional)
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Course / Professor Requirements & Expectations
            </label>
            <textarea
              rows={4}
              placeholder="Paste rubric, grading criteria, required endpoints, or features the professor requested..."
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-500"
            />
          </div>

          {/* Action Footer */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 sm:py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing || extractedFiles.length === 0}
              className="flex items-center justify-center space-x-2 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-semibold text-xs px-5 py-2.5 rounded-lg shadow-lg shadow-rose-500/20 transition disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>{isProcessing ? 'Analyzing Codebase...' : 'Begin Deep Rescue Analysis'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
