import React, { useState, useEffect } from 'react';
import { RotateCcw, Sparkles, AlertTriangle, ShieldCheck, LogIn, UserPlus } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { CreateProjectModal } from './components/CreateProjectModal.tsx';
import { DashboardView } from './views/DashboardView.tsx';
import { AnalysisView } from './views/AnalysisView.tsx';
import { RescuePlanView } from './views/RescuePlanView.tsx';
import { AiWorkspaceView } from './views/AiWorkspaceView.tsx';
import { FinalReportView } from './views/FinalReportView.tsx';
import {
  Project,
  ProjectFile,
  AnalysisReport,
  RescueTask,
} from './types/index.ts';
import {
  fetchUserProjects,
  createBackendProject,
  deleteProjectById,
  fetchProjectFiles,
  runProjectAnalysis,
  fetchAnalysisReport,
  fetchRescueTasks,
  applyTaskChanges,
  verifyTaskInSandbox,
  requestAiFixForTask,
  RetryStatusInfo,
} from './lib/project-service.ts';

function MainApp() {
  const { user, openAuthModal, signInWithGoogle, getIdToken } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [activeReport, setActiveReport] = useState<AnalysisReport | null>(null);
  const [rescueTasks, setRescueTasks] = useState<RescueTask[]>([]);
  const [currentRescueTask, setCurrentRescueTask] = useState<RescueTask | null>(null);

  const [currentView, setCurrentView] = useState<'dashboard' | 'analysis' | 'plan' | 'workspace' | 'report'>('dashboard');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [appError, setAppError] = useState<string | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisRetryStatus, setAnalysisRetryStatus] = useState<RetryStatusInfo | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Load initial projects from real PostgreSQL backend
  useEffect(() => {
    loadProjects();
  }, [user]);

  const loadProjects = async () => {
    setIsInitializing(true);
    try {
      const token = await getIdToken();
      const list = await fetchUserProjects(token);
      setProjects(list);
      setAppError(null);
      if (list.length > 0 && !activeProject) {
        await selectProject(list[0], 'dashboard');
      }
    } catch (e: any) {
      setAppError(e.message || 'Failed to fetch projects from Neon PostgreSQL.');
    } finally {
      setIsInitializing(false);
    }
  };

  const executeProjectAnalysis = async (targetProject: Project) => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisRetryStatus(null);
    setAppError(null);

    const analyzingProj: Project = {
      ...targetProject,
      status: 'analyzing',
    };
    setActiveProject(analyzingProj);
    setProjects(prev => [analyzingProj, ...prev.filter(p => p.id !== analyzingProj.id)]);

    try {
      const token = await getIdToken();
      const analysisOutput = await runProjectAnalysis(
        targetProject.id,
        token,
        info => setAnalysisRetryStatus(info)
      );

      setActiveReport(analysisOutput.report);
      setRescueTasks(analysisOutput.tasks);
      if (analysisOutput.tasks.length > 0) {
        setCurrentRescueTask(analysisOutput.tasks[0]);
      }

      const updatedProj: Project = {
        ...targetProject,
        healthScore: analysisOutput.report.healthScore,
        targetTechStack: analysisOutput.report.techDetected,
        status: 'in_rescue',
      };
      setActiveProject(updatedProj);
      setProjects(prev => [updatedProj, ...prev.filter(p => p.id !== updatedProj.id)]);
    } catch (err: any) {
      console.error('Error analyzing project:', err);
      const errMsg =
        err.message ||
        'Gemini API is currently experiencing high demand (503 UNAVAILABLE). Please click Retry Analysis.';
      setAnalysisError(errMsg);

      const failedProj: Project = {
        ...targetProject,
        status: 'failed',
      };
      setActiveProject(failedProj);
      setProjects(prev => [failedProj, ...prev.filter(p => p.id !== failedProj.id)]);
    } finally {
      setIsAnalyzing(false);
      setAnalysisRetryStatus(null);
    }
  };

  const selectProject = async (
    project: Project,
    targetView: 'dashboard' | 'analysis' | 'plan' | 'workspace' | 'report' = 'analysis'
  ) => {
    setActiveProject(project);
    setCurrentView(targetView);
    setAppError(null);
    setAnalysisError(null);

    try {
      const token = await getIdToken();
      const [files, report, tasks] = await Promise.all([
        fetchProjectFiles(project.id, token),
        fetchAnalysisReport(project.id, token),
        fetchRescueTasks(project.id, token),
      ]);

      setProjectFiles(files);
      setActiveReport(report);
      setRescueTasks(tasks);

      if (tasks.length > 0) {
        const pending = tasks.find(t => !t.isVerified) || tasks[0];
        setCurrentRescueTask(pending);
      } else {
        setCurrentRescueTask(null);
      }

      // If user opened analysis view on a project that has no report yet and isn't marked failed, start analysis
      if (!report && targetView === 'analysis' && project.status === 'analyzing') {
        await executeProjectAnalysis(project);
      }
    } catch (e: any) {
      console.error('Error loading project details:', e);
    }
  };

  const handleProjectCreated = async (newProject: Project, files: ProjectFile[]) => {
    setAppError(null);
    setAnalysisError(null);
    setActiveReport(null);
    setRescueTasks([]);
    setCurrentRescueTask(null);

    const token = await getIdToken();

    // 1. Create in PostgreSQL database
    const createdProj = await createBackendProject(
      {
        title: newProject.title,
        description: newProject.description,
        sourceType: newProject.sourceType,
        repoUrl: newProject.repoUrl,
        githubBranch: newProject.githubBranch,
        requirementsText: newProject.requirementsText,
        deadline: newProject.deadline,
        files: files.map(f => ({
          filePath: f.filePath,
          content: f.content,
          size: f.size,
        })),
      },
      token
    );

    setActiveProject(createdProj);
    setProjectFiles(files);
    setProjects(prev => [createdProj, ...prev.filter(p => p.id !== createdProj.id)]);
    setCurrentView('analysis');
    setIsCreateModalOpen(false);

    // 2. Run real Gemini analysis with automatic exponential backoff (never blocking modal close)
    void executeProjectAnalysis(createdProj);
  };

  const handleRetryAnalysis = async (target?: Project) => {
    const proj = target || activeProject;
    if (!proj) return;
    setCurrentView('analysis');
    await executeProjectAnalysis(proj);
  };

  const handleDeleteProject = async (projectId: string) => {
    setAppError(null);
    try {
      const token = await getIdToken();
      await deleteProjectById(projectId, token);
      setProjects(prev => prev.filter(p => p.id !== projectId));
      if (activeProject?.id === projectId) {
        setActiveProject(null);
        setActiveReport(null);
        setRescueTasks([]);
        setCurrentRescueTask(null);
        setCurrentView('dashboard');
      }
    } catch (e: any) {
      setAppError(`Delete failed: ${e.message}`);
    }
  };

  const handleApplyChanges = async (
    task: RescueTask,
    proposedFiles: Array<{ filePath: string; newContent: string }>
  ) => {
    if (!activeProject) return;
    setAppError(null);

    try {
      const token = await getIdToken();
      // Apply changes in PostgreSQL
      await applyTaskChanges(activeProject.id, task.id, proposedFiles, token);

      // Refresh files & tasks from PostgreSQL
      const [updatedFiles, updatedTasks] = await Promise.all([
        fetchProjectFiles(activeProject.id, token),
        fetchRescueTasks(activeProject.id, token),
      ]);

      setProjectFiles(updatedFiles);
      setRescueTasks(updatedTasks);

      const target = updatedTasks.find(t => t.id === task.id) || { ...task, status: 'applied' as const };
      setCurrentRescueTask(target);
    } catch (e: any) {
      setAppError(`Failed to apply changes: ${e.message}`);
    }
  };

  const handleVerifyTask = async (task: RescueTask) => {
    if (!activeProject) throw new Error('No active project.');

    const token = await getIdToken();
    // Run isolated sandbox verification
    const verificationResult = await verifyTaskInSandbox(activeProject.id, task.id, token);

    // Refresh tasks & project state from PostgreSQL
    const [updatedTasks, updatedProjects] = await Promise.all([
      fetchRescueTasks(activeProject.id, token),
      fetchUserProjects(token),
    ]);

    setRescueTasks(updatedTasks);
    const targetTask = updatedTasks.find(t => t.id === task.id);
    if (targetTask) setCurrentRescueTask(targetTask);

    const refreshedProj = updatedProjects.find(p => p.id === activeProject.id);
    if (refreshedProj) {
      setActiveProject(refreshedProj);
      setProjects(updatedProjects);
    }

    return verificationResult;
  };

  const handleAskAiFix = async (
    task: RescueTask,
    userMessage?: string,
    onRetryStatus?: (info: RetryStatusInfo) => void
  ) => {
    if (!activeProject) throw new Error('No active project.');
    const token = await getIdToken();
    return await requestAiFixForTask(
      activeProject.id,
      task.id,
      userMessage,
      token,
      onRetryStatus
    );
  };

  const handleProceedToNextTask = () => {
    const unverified = rescueTasks.find(t => !t.isVerified && t.id !== currentRescueTask?.id);
    if (unverified) {
      setCurrentRescueTask(unverified);
    } else {
      setCurrentView('report');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-rose-500 selection:text-white overflow-x-hidden">
      <Navbar
        currentView={currentView}
        setCurrentView={setCurrentView}
        activeProject={activeProject}
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-5 sm:pt-8 min-w-0">
        {appError && (
          <div className="mb-6 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs flex flex-wrap items-center justify-between gap-3">
            <span className="break-words min-w-0 flex-1">{appError}</span>
            <div className="flex items-center gap-2 shrink-0">
              {activeProject && (
                <button
                  onClick={() => handleRetryAnalysis(activeProject)}
                  className="inline-flex items-center space-x-1 bg-rose-600 hover:bg-rose-500 text-white font-bold px-3 py-1 rounded-lg transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry Analysis</span>
                </button>
              )}
              <button
                onClick={() => setAppError(null)}
                className="text-rose-400 hover:text-white font-bold px-2 py-0.5 rounded shrink-0"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {currentView === 'dashboard' && !user && (
          <div className="mb-6 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">
                  Sign in with Firebase Authentication to save projects to your personal account
                </p>
                <p className="text-[11px] text-slate-400">
                  Log in, create an account, or use Google Login to access your rescued projects across devices.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={() => openAuthModal('login')}
                className="inline-flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-700 transition"
              >
                <LogIn className="w-3.5 h-3.5 text-indigo-400" />
                <span>Log In</span>
              </button>
              <button
                onClick={() => openAuthModal('signup')}
                className="inline-flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-700 transition"
              >
                <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Sign Up</span>
              </button>
              <button
                onClick={() => signInWithGoogle().catch(() => openAuthModal('login'))}
                className="inline-flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow transition"
              >
                <span>Google Login</span>
              </button>
            </div>
          </div>
        )}

        {currentView === 'dashboard' && (
          <DashboardView
            projects={projects}
            onSelectProject={selectProject}
            onOpenCreateModal={() => setIsCreateModalOpen(true)}
            onDeleteProject={handleDeleteProject}
            onRetryAnalysis={handleRetryAnalysis}
          />
        )}

        {currentView === 'analysis' && activeProject && (
          <AnalysisView
            project={activeProject}
            report={activeReport}
            onProceedToPlan={() => setCurrentView('plan')}
            isAnalyzing={isAnalyzing}
            retryStatus={analysisRetryStatus}
            analysisError={analysisError}
            onRetryAnalysis={() => handleRetryAnalysis(activeProject)}
          />
        )}

        {currentView === 'plan' && activeProject && (
          <RescuePlanView
            project={activeProject}
            tasks={rescueTasks}
            onSelectTask={(task) => {
              setCurrentRescueTask(task);
              setCurrentView('workspace');
            }}
            onProceedToReport={() => setCurrentView('report')}
            onRetryAnalysis={() => handleRetryAnalysis(activeProject)}
            isAnalyzing={isAnalyzing}
          />
        )}

        {currentView === 'workspace' && activeProject && (
          currentRescueTask ? (
            <AiWorkspaceView
              project={activeProject}
              tasks={rescueTasks}
              currentTask={currentRescueTask}
              projectFiles={projectFiles}
              onSelectTask={(task) => setCurrentRescueTask(task)}
              onApplyChanges={handleApplyChanges}
              onVerifyTask={handleVerifyTask}
              onAskAiFix={handleAskAiFix}
              onProceedToNextTask={handleProceedToNextTask}
            />
          ) : (
            <div className="max-w-xl mx-auto my-12 bg-slate-900/90 border border-slate-800 rounded-3xl p-8 text-center space-y-4">
              <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
              <h3 className="text-lg font-bold text-white">
                {isAnalyzing ? 'Analyzing Codebase First…' : 'Analysis Required Before Workspace'}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {isAnalyzing
                  ? 'Gemini is currently inspecting your codebase to generate prioritized rescue tasks.'
                  : 'Complete the Deep Gemini Analysis to populate actionable rescue tasks for the AI Workspace.'}
              </p>
              <button
                onClick={() => handleRetryAnalysis(activeProject)}
                disabled={isAnalyzing}
                className="inline-flex items-center space-x-2 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 disabled:opacity-50 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-md transition"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isAnalyzing ? 'View Analysis Progress' : 'Run / Retry Gemini Analysis'}</span>
              </button>
            </div>
          )
        )}

        {currentView === 'report' && activeProject && (
          <FinalReportView
            project={activeProject}
            tasks={rescueTasks}
            projectFiles={projectFiles}
            onBackToDashboard={() => setCurrentView('dashboard')}
          />
        )}
      </main>

      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onProjectCreated={handleProjectCreated}
      />

      <AuthModal />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
