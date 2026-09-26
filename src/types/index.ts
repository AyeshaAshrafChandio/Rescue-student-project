export type ProjectStatus = 'created' | 'analyzing' | 'ready' | 'in_rescue' | 'completed' | 'failed';

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type TaskCategory = 'broken_fix' | 'missing_feature' | 'dependency_config' | 'test_verification';
export type TaskStatus = 'pending' | 'in_progress' | 'under_review' | 'applied' | 'verified' | 'failed';

export interface ProjectFile {
  id: string;
  projectId: string;
  filePath: string;
  content: string;
  size: number;
  language?: string;
  isModified?: boolean;
  updatedAt?: string;
}

export interface Project {
  id: string;
  ownerId: string;
  title: string;
  description?: string;
  sourceType: 'zip' | 'github';
  repoUrl?: string;
  githubBranch?: string;
  requirementsText: string;
  targetTechStack?: string;
  deadline?: string;
  healthScore: number;
  progressPercent: number;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FeatureDone {
  title: string;
  fileEvidence: string;
  description: string;
}

export interface FeatureBroken {
  title: string;
  severity: 'critical' | 'high' | 'medium';
  fileEvidence: string;
  errorExplanation: string;
  rootCause: string;
}

export interface FeatureMissing {
  title: string;
  priority: 'critical' | 'high' | 'medium';
  requirementReference: string;
  whyMissing: string;
}

export interface FeatureUnverifiable {
  title: string;
  reason: string;
  suggestedVerification: string;
}

export interface RescueTask {
  id: string;
  projectId: string;
  taskOrder: number;
  title: string;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  targetFiles: string[];
  estimatedMinutes: number;
  description: string;
  testCommand: string;
  rootCauseAnalysis?: string;
  proposedChanges?: Array<{
    filePath: string;
    description: string;
    newContent: string;
  }>;
  verificationOutput?: string;
  isVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AnalysisReport {
  id: string;
  projectId: string;
  techDetected: string;
  requirementsSummary: string;
  healthScore: number;
  overallSummary: string;
  featuresDone: FeatureDone[];
  featuresBroken: FeatureBroken[];
  featuresMissing: FeatureMissing[];
  featuresUnverifiable: FeatureUnverifiable[];
  createdAt: string;
}

export interface VerificationRun {
  id: string;
  projectId: string;
  taskId: string;
  status: 'passed' | 'failed';
  passedChecks: string[];
  failedChecks: string[];
  stdout: string;
  stderr: string;
  durationMs: number;
  checkedAt: string;
}

export interface AiSessionMessage {
  id: string;
  projectId: string;
  taskId: string;
  sender: 'user' | 'ai';
  text: string;
  diffPayload?: string;
  createdAt: string;
}
