import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Navbar } from './components/Navbar.tsx';
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
  calculateProjectHealth,
} from './lib/project-service.ts';

function MainApp() {
  const { user, getIdToken } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [activeReport, setActiveReport] = useState<AnalysisReport | null>(null);
  const [rescueTasks, setRescueTasks] = useState<RescueTask[]>([]);
  const [currentRescueTask, setCurrentRescueTask] = useState<RescueTask | null>(null);

  const [currentView, setCurrentView] = useState<'dashboard' | 'analysis' | 'plan' | 'workspace' | 'report'>('dashboard');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

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
      if (list.length > 0 && !activeProject) {
        await selectProject(list[0], 'dashboard');
      }
    } catch (e: any) {
      console.error('Failed to fetch projects from PostgreSQL:', e);
    } finally {
      setIsInitializing(false);
    }
  };

  const selectProject = async (
    project: Project,
    targetView: 'dashboard' | 'analysis' | 'plan' | 'workspace' | 'report' = 'analysis'
  ) => {
    setActiveProject(project);
    setCurrentView(targetView);

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
      }
    } catch (e: any) {
      console.error('Error loading project details:', e);
    }
  };

  const handleProjectCreated = async (newProject: Project, files: ProjectFile[]) => {
    setCurrentView('analysis');

    try {
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

      // 2. Run real Gemini analysis and store report & rescue plan in PostgreSQL
      const analysisOutput = await runProjectAnalysis(createdProj.id, token);

      setActiveReport(analysisOutput.report);
      setRescueTasks(analysisOutput.tasks);
      if (analysisOutput.tasks.length > 0) {
        setCurrentRescueTask(analysisOutput.tasks[0]);
      }

      // Update active project with new health score
      const updatedProj: Project = {
        ...createdProj,
        healthScore: analysisOutput.report.healthScore,
        targetTechStack: analysisOutput.report.techDetected,
        status: 'in_rescue',
      };
      setActiveProject(updatedProj);
      setProjects(prev => [updatedProj, ...prev.filter(p => p.id !== updatedProj.id)]);
    } catch (err: any) {
      console.error('Error creating & analyzing project:', err);
      alert(`Project setup error: ${err.message}`);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this rescued project from the database?')) return;
    try {
      const token = await getIdToken();
      await deleteProjectById(projectId, token);
      setProjects(prev => prev.filter(p => p.id !== projectId));
      if (activeProject?.id === projectId) {
        setActiveProject(null);
        setCurrentView('dashboard');
      }
    } catch (e: any) {
      alert(`Delete failed: ${e.message}`);
    }
  };

  const handleApplyChanges = async (
    task: RescueTask,
    proposedFiles: Array<{ filePath: string; newContent: string }>
  ) => {
    if (!activeProject) return;

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
      alert(`Failed to apply changes: ${e.message}`);
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

  const handleAskAiFix = async (task: RescueTask, userMessage?: string) => {
    if (!activeProject) throw new Error('No active project.');
    const token = await getIdToken();
    return await requestAiFixForTask(activeProject.id, task.id, userMessage, token);
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-rose-500 selection:text-white">
      <Navbar
        currentView={currentView}
        setCurrentView={setCurrentView}
        activeProject={activeProject}
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {currentView === 'dashboard' && (
          <DashboardView
            projects={projects}
            onSelectProject={selectProject}
            onOpenCreateModal={() => setIsCreateModalOpen(true)}
            onDeleteProject={handleDeleteProject}
          />
        )}

        {currentView === 'analysis' && activeProject && (
          <AnalysisView
            project={activeProject}
            report={activeReport}
            onProceedToPlan={() => setCurrentView('plan')}
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
          />
        )}

        {currentView === 'workspace' && activeProject && currentRescueTask && (
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
