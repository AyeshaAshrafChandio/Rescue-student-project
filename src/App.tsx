import React, { useState, useEffect, useCallback } from 'react';
import {
  RotateCcw,
  Sparkles,
  AlertTriangle,
  ShieldCheck,
  LogIn,
  UserPlus,
  Plus,
  Layers,
} from 'lucide-react';
import { AuthProvider, useAuth, type AppView } from './context/AuthContext.tsx';
import { Navbar, SideNavbar, type NavOptions } from './components/Navbar.tsx';
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

function parseRouteFromPathname(pathname: string): {
  view: AppView;
  openCreateModal?: boolean;
  focusVerification?: boolean;
  reportSection?: 'check' | 'report';
  authMode?: 'login' | 'signup';
} {
  const clean = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  if (clean === '/login') return { view: 'dashboard', authMode: 'login' };
  if (clean === '/signup') return { view: 'dashboard', authMode: 'signup' };
  if (clean === '/rescue') return { view: 'dashboard', openCreateModal: true };
  if (clean === '/analysis') return { view: 'analysis' };
  if (clean === '/plan') return { view: 'plan' };
  if (clean === '/workspace') return { view: 'workspace', focusVerification: false };
  if (clean === '/verification') return { view: 'workspace', focusVerification: true };
  if (clean === '/final-check') return { view: 'report', reportSection: 'check' };
  if (clean === '/report') return { view: 'report', reportSection: 'report' };
  return { view: 'dashboard' };
}

function getPathForView(view: AppView, options?: NavOptions): string {
  if (view === 'analysis') return '/analysis';
  if (view === 'plan') return '/plan';
  if (view === 'workspace') {
    return options?.focusVerification ? '/verification' : '/workspace';
  }
  if (view === 'report') {
    return options?.reportSection === 'check' ? '/final-check' : '/report';
  }
  return '/dashboard';
}

function getLabelForView(view: AppView, options?: NavOptions): string {
  if (view === 'analysis') return 'Analysis Report';
  if (view === 'plan') return 'Rescue Plan';
  if (view === 'workspace') {
    return options?.focusVerification ? 'Isolated Code Verification' : 'AI Workspace';
  }
  if (view === 'report') {
    return options?.reportSection === 'check' ? 'Final Check' : 'Final Report';
  }
  return 'Dashboard';
}

function MainApp() {
  const {
    user,
    loading: authLoading,
    openAuthModal,
    requireAuthForAction,
    consumeIntendedDestination,
    signInWithGoogle,
    getIdToken,
  } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [activeReport, setActiveReport] = useState<AnalysisReport | null>(null);
  const [rescueTasks, setRescueTasks] = useState<RescueTask[]>([]);
  const [currentRescueTask, setCurrentRescueTask] = useState<RescueTask | null>(null);

  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [focusVerification, setFocusVerification] = useState(false);
  const [reportSection, setReportSection] = useState<'check' | 'report'>('report');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisRetryStatus, setAnalysisRetryStatus] = useState<RetryStatusInfo | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const executeProjectAnalysis = async (targetProject: Project) => {
    if (!requireAuthForAction({ view: 'analysis', projectId: targetProject.id, label: 'Project Analysis' })) {
      return;
    }

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

  const selectProjectInternal = useCallback(
    async (
      project: Project,
      targetView: AppView = 'analysis',
      options?: NavOptions
    ) => {
      setActiveProject(project);
      setCurrentView(targetView);
      if (options?.focusVerification !== undefined) {
        setFocusVerification(options.focusVerification);
      }
      if (options?.reportSection) {
        setReportSection(options.reportSection);
      }
      setAppError(null);
      setAnalysisError(null);

      try {
        const token = await getIdToken();
        if (!token) return;
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

        if (!report && targetView === 'analysis' && project.status === 'analyzing') {
          await executeProjectAnalysis(project);
        }
      } catch (e: any) {
        console.error('Error loading project details:', e);
      }
    },
    [getIdToken]
  );

  // Navigate to a view with strict Firebase Auth check
  const handleNavigateView = useCallback(
    (targetView: AppView, options?: NavOptions) => {
      const nextFocusVerif = options?.focusVerification ?? false;
      const nextReportSec = options?.reportSection ?? 'report';

      // Every project-related route/view requires authentication
      if (targetView !== 'dashboard' && !user) {
        requireAuthForAction({
          view: targetView,
          focusVerification: nextFocusVerif,
          reportSection: nextReportSec,
          label: getLabelForView(targetView, options),
        });
        return;
      }

      setCurrentView(targetView);
      setFocusVerification(nextFocusVerif);
      setReportSection(nextReportSec);

      try {
        const nextPath = getPathForView(targetView, options);
        if (window.location.pathname !== nextPath) {
          window.history.pushState({}, '', nextPath);
        }
      } catch {
        // ignore history errors
      }

      // Auto-select first project if user navigates to a project view and has projects loaded
      if (targetView !== 'dashboard' && !activeProject && projects.length > 0 && user) {
        void selectProjectInternal(projects[0], targetView, options);
      }
    },
    [user, activeProject, projects, requireAuthForAction, selectProjectInternal]
  );

  const handleOpenCreateModal = useCallback(() => {
    if (
      !requireAuthForAction({
        view: 'dashboard',
        openCreateModal: true,
        label: 'Rescue A Project',
      })
    ) {
      return;
    }
    setIsCreateModalOpen(true);
  }, [requireAuthForAction]);

  const selectProject = async (
    project: Project,
    targetView: AppView = 'analysis'
  ) => {
    if (
      !requireAuthForAction({
        view: targetView,
        projectId: project.id,
        label: project.title,
      })
    ) {
      return;
    }
    try {
      const nextPath = getPathForView(targetView);
      if (window.location.pathname !== nextPath) {
        window.history.pushState({}, '', nextPath);
      }
    } catch {
      // ignore
    }
    await selectProjectInternal(project, targetView);
  };

  // Handle initial URL route and browser back/forward navigation
  useEffect(() => {
    const syncRoute = () => {
      if (authLoading) return;
      const parsed = parseRouteFromPathname(window.location.pathname);

      if (parsed.authMode && !user) {
        openAuthModal(parsed.authMode, { view: 'dashboard', label: 'Dashboard' });
        return;
      }

      if (!user) {
        // Unauthenticated users accessing project routes or actions are redirected to Login/Sign Up
        if (parsed.openCreateModal) {
          requireAuthForAction({
            view: 'dashboard',
            openCreateModal: true,
            label: 'Rescue A Project',
          });
          return;
        }
        if (parsed.view !== 'dashboard') {
          requireAuthForAction({
            view: parsed.view,
            focusVerification: parsed.focusVerification,
            reportSection: parsed.reportSection,
            label: getLabelForView(parsed.view, {
              focusVerification: parsed.focusVerification,
              reportSection: parsed.reportSection,
            }),
          });
          return;
        }
        // On initial unauthenticated visit to root/dashboard, prompt Login/Sign Up modal
        openAuthModal('login', { view: 'dashboard', label: 'Dashboard' });
        return;
      }

      if (parsed.openCreateModal) {
        setCurrentView('dashboard');
        setIsCreateModalOpen(true);
        return;
      }

      setCurrentView(parsed.view);
      setFocusVerification(Boolean(parsed.focusVerification));
      if (parsed.reportSection) {
        setReportSection(parsed.reportSection);
      }
    };

    syncRoute();
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, [authLoading, user]);

  // Load projects when user authenticates, and resume any intended page/action
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setProjects([]);
      setActiveProject(null);
      setProjectFiles([]);
      setActiveReport(null);
      setRescueTasks([]);
      setCurrentRescueTask(null);
      setAppError(null);
      setIsInitializing(false);
      return;
    }

    const initializeAuthenticatedSession = async () => {
      setIsInitializing(true);
      try {
        const token = await getIdToken();
        if (!token) return;
        const list = await fetchUserProjects(token);
        setProjects(list);
        setAppError(null);

        const intended = consumeIntendedDestination();
        if (intended) {
          if (intended.openCreateModal) {
            setCurrentView('dashboard');
            setIsCreateModalOpen(true);
            try {
              window.history.pushState({}, '', '/dashboard');
            } catch {
              // ignore
            }
            if (list.length > 0 && !activeProject) {
              await selectProjectInternal(list[0], 'dashboard');
            }
            return;
          }

          const targetView = intended.view || 'dashboard';
          const targetProj = intended.projectId
            ? list.find(p => p.id === intended.projectId) || list[0]
            : activeProject || list[0];

          const navOpts: NavOptions = {
            focusVerification: intended.focusVerification,
            reportSection: intended.reportSection,
          };

          try {
            window.history.pushState({}, '', getPathForView(targetView, navOpts));
          } catch {
            // ignore
          }

          if (targetProj) {
            await selectProjectInternal(targetProj, targetView, navOpts);
          } else {
            setCurrentView(targetView);
            setFocusVerification(Boolean(intended.focusVerification));
            if (intended.reportSection) {
              setReportSection(intended.reportSection);
            }
          }
          return;
        }

        if (list.length > 0 && !activeProject) {
          await selectProjectInternal(list[0], currentView);
        }
      } catch (e: any) {
        setAppError(e.message || 'Failed to fetch projects from Neon PostgreSQL.');
      } finally {
        setIsInitializing(false);
      }
    };

    void initializeAuthenticatedSession();
  }, [user, authLoading]);

  const handleProjectCreated = async (newProject: Project, files: ProjectFile[]) => {
    if (
      !requireAuthForAction({
        view: 'dashboard',
        openCreateModal: true,
        label: 'Create Rescue Project',
      })
    ) {
      return;
    }

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
    try {
      window.history.pushState({}, '', '/analysis');
    } catch {
      // ignore
    }

    // 2. Run real Gemini analysis with automatic exponential backoff
    void executeProjectAnalysis(createdProj);
  };

  const handleRetryAnalysis = async (target?: Project) => {
    const proj = target || activeProject;
    if (!proj) return;
    if (
      !requireAuthForAction({
        view: 'analysis',
        projectId: proj.id,
        label: 'Retry Analysis',
      })
    ) {
      return;
    }
    setCurrentView('analysis');
    try {
      window.history.pushState({}, '', '/analysis');
    } catch {
      // ignore
    }
    await executeProjectAnalysis(proj);
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!requireAuthForAction({ view: 'dashboard', label: 'Delete Project' })) {
      return;
    }
    setAppError(null);
    try {
      const token = await getIdToken();
      await deleteProjectById(projectId, token);
      const remaining = projects.filter(p => p.id !== projectId);
      setProjects(remaining);
      if (activeProject?.id === projectId) {
        if (remaining.length > 0) {
          await selectProjectInternal(remaining[0], 'dashboard');
        } else {
          setActiveProject(null);
          setActiveReport(null);
          setRescueTasks([]);
          setCurrentRescueTask(null);
          setCurrentView('dashboard');
        }
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
    if (
      !requireAuthForAction({
        view: 'workspace',
        projectId: activeProject.id,
        taskId: task.id,
        label: 'Apply Code Changes',
      })
    ) {
      return;
    }
    setAppError(null);

    try {
      const token = await getIdToken();
      await applyTaskChanges(activeProject.id, task.id, proposedFiles, token);

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
    if (
      !requireAuthForAction({
        view: 'workspace',
        focusVerification: true,
        projectId: activeProject.id,
        taskId: task.id,
        label: 'Run Code Verification',
      })
    ) {
      throw new Error('Authentication required to run verification.');
    }

    const token = await getIdToken();
    const verificationResult = await verifyTaskInSandbox(activeProject.id, task.id, token);

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
    if (
      !requireAuthForAction({
        view: 'workspace',
        projectId: activeProject.id,
        taskId: task.id,
        label: 'AI Code Diagnosis',
      })
    ) {
      throw new Error('Authentication required for AI diagnosis.');
    }
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
      setFocusVerification(false);
      try {
        window.history.pushState({}, '', '/workspace');
      } catch {
        // ignore
      }
    } else {
      handleNavigateView('report', { reportSection: 'check' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-rose-500 selection:text-white overflow-x-hidden">
      <Navbar
        currentView={currentView}
        setCurrentView={handleNavigateView}
        activeProject={activeProject}
        projects={projects}
        onSelectProject={selectProject}
        onOpenCreateModal={handleOpenCreateModal}
        focusVerification={focusVerification}
        reportSection={reportSection}
      />

      <div className="flex-1 flex max-w-[1600px] w-full mx-auto min-w-0">
        <SideNavbar
          currentView={currentView}
          setCurrentView={handleNavigateView}
          activeProject={activeProject}
          projects={projects}
          onSelectProject={selectProject}
          onOpenCreateModal={handleOpenCreateModal}
          focusVerification={focusVerification}
          reportSection={reportSection}
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

          {!user && !authLoading && (
            <div className="mb-6 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">
                    Sign in with Firebase Authentication to rescue and manage your projects
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Every project action requires authentication. Log in, Sign Up, or use Google Login to continue.
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
              onOpenCreateModal={handleOpenCreateModal}
              onDeleteProject={handleDeleteProject}
              onRetryAnalysis={handleRetryAnalysis}
            />
          )}

          {currentView !== 'dashboard' && !activeProject && !isInitializing && (
            <div className="max-w-xl mx-auto my-12 bg-slate-900/90 border border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-xl">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mx-auto">
                <Layers className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-white">No Active Project Selected</h3>
              <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
                Start by uploading a project ZIP archive or importing a GitHub repository so we can generate your Rescue Report, Actionable Plan, AI Workspace fixes, and Verification checks.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={handleOpenCreateModal}
                  className="inline-flex items-center space-x-2 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-md transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Rescue A Project Now</span>
                </button>
                <button
                  onClick={() => handleNavigateView('dashboard')}
                  className="inline-flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs px-4 py-2.5 rounded-xl border border-slate-700 transition"
                >
                  <span>Back to Dashboard</span>
                </button>
              </div>
            </div>
          )}

          {currentView === 'analysis' && activeProject && (
            <AnalysisView
              project={activeProject}
              report={activeReport}
              onProceedToPlan={() => handleNavigateView('plan')}
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
                handleNavigateView('workspace', { focusVerification: false });
              }}
              onProceedToReport={() => handleNavigateView('report', { reportSection: 'check' })}
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
                onProceedToFinalCheck={() => handleNavigateView('report', { reportSection: 'check' })}
                focusVerification={focusVerification}
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
              onBackToDashboard={() => handleNavigateView('dashboard')}
              reportSection={reportSection}
              onSwitchSection={(sec) => handleNavigateView('report', { reportSection: sec })}
              onOpenTaskInWorkspace={(task) => {
                setCurrentRescueTask(task);
                handleNavigateView('workspace', { focusVerification: false });
              }}
            />
          )}
        </main>
      </div>

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

