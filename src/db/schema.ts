import { pgTable, text, serial, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. Users table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  displayName: text('display_name'),
  photoUrl: text('photo_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. Projects table
export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  sourceType: text('source_type').notNull(), // 'zip' | 'github'
  repoUrl: text('repo_url'),
  githubBranch: text('github_branch'),
  requirementsText: text('requirements_text'),
  targetTechStack: text('target_tech_stack'),
  deadline: text('deadline'),
  healthScore: integer('health_score').default(0).notNull(),
  progressPercent: integer('progress_percent').default(0).notNull(),
  status: text('status').default('created').notNull(), // 'created' | 'analyzing' | 'in_rescue' | 'completed' | 'failed'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 3. Project Source Files
export const projectFiles = pgTable('project_files', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  filePath: text('file_path').notNull(),
  content: text('content').notNull(),
  size: integer('size').default(0).notNull(),
  language: text('language'),
  isModified: boolean('is_modified').default(false).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 4. Codebase Analysis Reports
export const analysisReports = pgTable('analysis_reports', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  techDetected: text('tech_detected').notNull(),
  requirementsSummary: text('requirements_summary'),
  healthScore: integer('health_score').notNull(),
  overallSummary: text('overall_summary').notNull(),
  featuresDoneJson: text('features_done_json').notNull(),
  featuresBrokenJson: text('features_broken_json').notNull(),
  featuresMissingJson: text('features_missing_json').notNull(),
  featuresUnverifiableJson: text('features_unverifiable_json').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 5. Prioritized Rescue Tasks
export const rescueTasks = pgTable('rescue_tasks', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  taskOrder: integer('task_order').notNull(),
  title: text('title').notNull(),
  category: text('category').notNull(), // 'broken_fix' | 'missing_feature' | 'dependency_config' | 'test_verification'
  priority: text('priority').notNull(), // 'critical' | 'high' | 'medium' | 'low'
  status: text('status').default('pending').notNull(), // 'pending' | 'in_progress' | 'applied' | 'verified' | 'failed'
  description: text('description').notNull(),
  targetFilesJson: text('target_files_json'),
  estimatedMinutes: integer('estimated_minutes').default(15).notNull(),
  testCommand: text('test_command').notNull(),
  rootCauseAnalysis: text('root_cause_analysis'),
  proposedChangesJson: text('proposed_changes_json'),
  verificationOutput: text('verification_output'),
  isVerified: boolean('is_verified').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 6. Verification Execution Runs
export const verificationRuns = pgTable('verification_runs', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  taskId: text('task_id').notNull(),
  status: text('status').notNull(), // 'passed' | 'failed'
  passedChecksJson: text('passed_checks_json'),
  failedChecksJson: text('failed_checks_json'),
  stdout: text('stdout'),
  stderr: text('stderr'),
  durationMs: integer('duration_ms').default(0).notNull(),
  checkedAt: timestamp('checked_at').defaultNow().notNull(),
});

// 7. Security & Action Audit Logs
export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  projectId: text('project_id'),
  userId: text('user_id').notNull(),
  action: text('action').notNull(),
  details: text('details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const projectsRelations = relations(projects, ({ many }) => ({
  files: many(projectFiles),
  reports: many(analysisReports),
  tasks: many(rescueTasks),
  verificationRuns: many(verificationRuns),
}));

export const projectFilesRelations = relations(projectFiles, ({ one }) => ({
  project: one(projects, {
    fields: [projectFiles.projectId],
    references: [projects.id],
  }),
}));

export const rescueTasksRelations = relations(rescueTasks, ({ one }) => ({
  project: one(projects, {
    fields: [rescueTasks.projectId],
    references: [projects.id],
  }),
}));
