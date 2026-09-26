import {
  Project,
  ProjectFile,
  AnalysisReport,
  RescueTask,
  VerificationRun,
} from '../types/index.ts';

// Client session ID for guest students who have not yet signed in with Google
function getClientSessionId(): string {
  let id = sessionStorage.getItem('spr_student_session_id');
  if (!id) {
    id = `student-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem('spr_student_session_id', id);
  }
  return id;
}

function getAuthHeaders(token?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-user-id': getClientSessionId(),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

// 1. Fetch user projects from real PostgreSQL backend
export async function fetchUserProjects(token?: string | null): Promise<Project[]> {
  const res = await fetch('/api/projects', {
    headers: getAuthHeaders(token),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch projects from backend.');
  }

  return await res.json();
}

// 2. Create Project with files in PostgreSQL backend
export async function createBackendProject(
  payload: {
    title: string;
    description?: string;
    sourceType: 'zip' | 'github';
    repoUrl?: string;
    githubBranch?: string;
    requirementsText?: string;
    targetTechStack?: string;
    deadline?: string;
    files: Array<{ filePath: string; content: string; size?: number; language?: string }>;
  },
  token?: string | null
): Promise<Project> {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to create project in backend database.');
  }

  return await res.json();
}

// 3. Delete Project from PostgreSQL backend
export async function deleteProjectById(projectId: string, token?: string | null): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(token),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to delete project.');
  }
}

// 4. Fetch Project Files from PostgreSQL backend
export async function fetchProjectFiles(projectId: string, token?: string | null): Promise<ProjectFile[]> {
  const res = await fetch(`/api/projects/${projectId}/files`, {
    headers: getAuthHeaders(token),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch project files.');
  }

  return await res.json();
}

// 5. Run Deep Gemini Analysis and store in PostgreSQL
export async function runProjectAnalysis(
  projectId: string,
  token?: string | null
): Promise<{ report: AnalysisReport; tasks: RescueTask[] }> {
  const res = await fetch(`/api/projects/${projectId}/analyze`, {
    method: 'POST',
    headers: getAuthHeaders(token),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Codebase analysis failed.');
  }

  return await res.json();
}

// 6. Fetch Analysis Report from PostgreSQL
export async function fetchAnalysisReport(projectId: string, token?: string | null): Promise<AnalysisReport | null> {
  const res = await fetch(`/api/projects/${projectId}/report`, {
    headers: getAuthHeaders(token),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch report.');
  }

  return await res.json();
}

// 7. Fetch Rescue Tasks from PostgreSQL
export async function fetchRescueTasks(projectId: string, token?: string | null): Promise<RescueTask[]> {
  const res = await fetch(`/api/projects/${projectId}/tasks`, {
    headers: getAuthHeaders(token),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch rescue tasks.');
  }

  return await res.json();
}

// 8. Request AI Code Diagnosis & Replacement (Gemini Autonomous Code Engine)
export async function requestAiFixForTask(
  projectId: string,
  taskId: string,
  userMessage?: string,
  token?: string | null
): Promise<{
  explanation: string;
  rootCause: string;
  proposedChanges: Array<{ filePath: string; description: string; newContent: string }>;
  verificationAdvice: string;
}> {
  const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}/ai-fix`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify({ userMessage }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'AI Code Diagnosis failed.');
  }

  return await res.json();
}

// 9. Apply proposed changes safely in PostgreSQL backend
export async function applyTaskChanges(
  projectId: string,
  taskId: string,
  changes: Array<{ filePath: string; newContent: string }>,
  token?: string | null
): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}/apply`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify({ changes }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to apply code changes to database.');
  }
}

// 10. Run Real Isolated Sandbox Verification
export async function verifyTaskInSandbox(
  projectId: string,
  taskId: string,
  token?: string | null
): Promise<{
  status: 'passed' | 'failed';
  passedChecks: string[];
  failedChecks: string[];
  stdout: string;
  stderr: string;
  durationMs: number;
}> {
  const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}/verify`, {
    method: 'POST',
    headers: getAuthHeaders(token),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Verification execution failed.');
  }

  return await res.json();
}

// 11. Import from GitHub
export async function importFromGithub(
  repoUrl: string,
  branch = 'main',
  token?: string | null
): Promise<{ files: Array<{ filePath: string; content: string; size: number }>; repoName: string; defaultBranch: string }> {
  const res = await fetch('/api/projects/github-import', {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify({ repoUrl, branch }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'GitHub import failed.');
  }

  return await res.json();
}

// Health and Progress calculation helper
export function calculateProjectHealth(baseScore: number, tasks: RescueTask[]): { health: number; progress: number } {
  if (tasks.length === 0) return { health: baseScore, progress: 0 };
  const verifiedCount = tasks.filter(t => t.isVerified || t.status === 'verified').length;
  const progress = Math.round((verifiedCount / tasks.length) * 100);
  const remaining = 100 - baseScore;
  const health = Math.min(100, Math.round(baseScore + (verifiedCount / tasks.length) * remaining));
  return { health, progress };
}
