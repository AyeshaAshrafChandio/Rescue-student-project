import {
  Project,
  ProjectFile,
  AnalysisReport,
  RescueTask,
} from '../types/index.ts';

export interface RetryStatusInfo {
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  message: string;
}

function getAuthHeaders(token?: string | null): Record<string, string> {
  if (!token) {
    throw new Error('Authentication required. Please log in or sign up to continue.');
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableStatusOrMessage(status: number, errorText: string, retryableFlag?: boolean): boolean {
  if (retryableFlag === true) return true;
  if ([429, 500, 502, 503, 504].includes(status)) return true;
  const lower = (errorText || '').toLowerCase();
  return (
    lower.includes('503') ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('429') ||
    lower.includes('rate limit') ||
    lower.includes('quota') ||
    lower.includes('temporarily') ||
    lower.includes('network') ||
    lower.includes('failed to fetch')
  );
}

async function fetchWithExponentialBackoff<T>(
  url: string,
  options: RequestInit,
  defaultErrorMsg: string,
  onRetryStatus?: (info: RetryStatusInfo) => void,
  maxAttempts = 3,
  baseDelayMs = 2000
): Promise<T> {
  let lastError: Error = new Error(defaultErrorMsg);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) {
        return (await res.json()) as T;
      }

      const data = await res.json().catch(() => ({}));
      const errMessage = data.error || defaultErrorMsg;
      const retryable = isRetryableStatusOrMessage(res.status, errMessage, data.retryable);

      lastError = new Error(errMessage);

      if (!retryable || attempt === maxAttempts) {
        break;
      }
    } catch (netErr: any) {
      lastError = new Error(netErr?.message || defaultErrorMsg);
      if (attempt === maxAttempts) {
        break;
      }
    }

    const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
    const jitter = Math.floor(Math.random() * 500);
    const delayMs = Math.min(10000, exponentialDelay + jitter);
    const seconds = Math.max(1, Math.round(delayMs / 1000));

    if (onRetryStatus) {
      onRetryStatus({
        attempt,
        maxAttempts,
        delayMs,
        message: `Gemini API is experiencing high demand (503 UNAVAILABLE) — automatically retrying with exponential backoff (Attempt ${
          attempt + 1
        } of ${maxAttempts} in ${seconds}s)...`,
      });
    }

    await sleep(delayMs);
  }

  throw lastError;
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

// 5. Run Deep Gemini Analysis and store in PostgreSQL (with automatic exponential backoff)
export async function runProjectAnalysis(
  projectId: string,
  token?: string | null,
  onRetryStatus?: (info: RetryStatusInfo) => void
): Promise<{ report: AnalysisReport; tasks: RescueTask[] }> {
  return fetchWithExponentialBackoff<{ report: AnalysisReport; tasks: RescueTask[] }>(
    `/api/projects/${projectId}/analyze`,
    {
      method: 'POST',
      headers: getAuthHeaders(token),
    },
    'Codebase analysis failed due to temporary Gemini API high demand.',
    onRetryStatus,
    3,
    2000
  );
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

// 8. Request AI Code Diagnosis & Replacement (with automatic exponential backoff)
export async function requestAiFixForTask(
  projectId: string,
  taskId: string,
  userMessage?: string,
  token?: string | null,
  onRetryStatus?: (info: RetryStatusInfo) => void
): Promise<{
  explanation: string;
  rootCause: string;
  proposedChanges: Array<{ filePath: string; description: string; newContent: string }>;
  verificationAdvice: string;
}> {
  return fetchWithExponentialBackoff<{
    explanation: string;
    rootCause: string;
    proposedChanges: Array<{ filePath: string; description: string; newContent: string }>;
    verificationAdvice: string;
  }>(
    `/api/projects/${projectId}/tasks/${taskId}/ai-fix`,
    {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ userMessage }),
    },
    'AI Code Diagnosis failed due to temporary Gemini API high demand.',
    onRetryStatus,
    3,
    2000
  );
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

// 11. Import from GitHub (Free GitHub REST + Raw API)
export async function importFromGithub(
  repoUrl: string,
  branch = 'main',
  token?: string | null,
  githubToken?: string
): Promise<{
  files: Array<{ filePath: string; content: string; size: number }>;
  repoName: string;
  defaultBranch: string;
  rateLimitRemaining?: number;
}> {
  const res = await fetch('/api/projects/github-import', {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify({ repoUrl, branch, githubToken }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'GitHub import failed.');
  }

  return await res.json();
}

// 12. Verify Firebase ID Token & Sync Authenticated User in PostgreSQL Backend
export async function syncAuthenticatedUser(
  token: string,
  displayName?: string | null
): Promise<{
  authenticated: boolean;
  user: {
    id: number;
    uid: string;
    email: string;
    displayName?: string | null;
    photoUrl?: string | null;
  };
}> {
  const res = await fetch('/api/auth/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ displayName }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to verify Firebase token with backend.');
  }

  return await res.json();
}

// 13. Archive Rescued Project Snapshot to Cloudinary
export async function archiveProjectToCloudinary(
  projectId: string,
  token?: string | null
): Promise<{
  url: string;
  secureUrl: string;
  publicId: string;
  bytes: number;
  format: string;
  createdAt: string;
}> {
  const res = await fetch(`/api/projects/${projectId}/cloud-archive`, {
    method: 'POST',
    headers: getAuthHeaders(token),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to archive snapshot to Cloudinary.');
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
