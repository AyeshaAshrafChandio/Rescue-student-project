import { Router, type Response } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { getDb, testNeonConnection } from '../db/index.ts';
import {
  projects,
  projectFiles,
  analysisReports,
  rescueTasks,
  verificationRuns,
  auditLogs,
} from '../db/schema.ts';
import { getOrCreateUser, getUserByUid } from '../db/users.ts';
import { requireAuth, requireStrictFirebaseAuth, type AuthRequest } from '../middleware/auth.ts';
import {
  getPublicFirebaseClientConfig,
  ensureFirebaseAuthorizedDomains,
} from '../lib/firebase-admin.ts';
import { analyzeCodebaseWithGemini, diagnoseAndProposeCodeFix } from './gemini.ts';
import { runRealCodeVerification, reconstructCanonicalRepoTree } from './verifier.ts';
import { fetchGitHubRepository } from './github.ts';
import {
  isCloudinaryConfigured,
  checkCloudinaryStatus,
  uploadSnapshotToCloudinaryFree,
} from './cloudinary.ts';

export const apiRouter = Router();

// Public runtime Firebase client configuration endpoint (also ensures request domain is authorized)
apiRouter.get('/auth/firebase-config', async (req, res: Response) => {
  const queryDomain = typeof req.query.domain === 'string' ? req.query.domain : '';
  const originHeader = typeof req.headers.origin === 'string' ? req.headers.origin : '';
  const extraDomains = [queryDomain, req.hostname, originHeader, 'rescue-student-project.ai.studio'].filter(
    Boolean
  );
  const authorizedDomains = await ensureFirebaseAuthorizedDomains(extraDomains);
  return res.json({
    ...getPublicFirebaseClientConfig(),
    authorizedDomains,
  });
});

apiRouter.post('/auth/authorize-domain', async (req, res: Response) => {
  const domain = typeof req.body?.domain === 'string' ? req.body.domain : '';
  const extraDomains = [domain, req.hostname, 'rescue-student-project.ai.studio'].filter(Boolean);
  const authorizedDomains = await ensureFirebaseAuthorizedDomains(extraDomains);
  return res.json({ authorized: true, authorizedDomains });
});

apiRouter.get('/cloudinary-status', async (_req, res: Response) => {
  const status = await checkCloudinaryStatus();
  return res.json(status);
});

// Neon PostgreSQL + Drizzle ORM live health & connection check
apiRouter.get('/db-status', async (_req, res: Response) => {
  try {
    const info = await testNeonConnection();
    return res.json(info);
  } catch (error: any) {
    return res.status(503).json({
      connected: false,
      error: error.message || 'Neon PostgreSQL connection failed.',
    });
  }
});

// 0. Firebase Authentication Sync & Profile Endpoints (Strictly Protected by Firebase ID Token)
apiRouter.post('/auth/sync', requireStrictFirebaseAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { uid, email, displayName, photoUrl } = req.user!;
    const bodyName = req.body?.displayName || displayName;
    const dbUser = await getOrCreateUser(
      uid,
      email || 'user@firebase.auth',
      bodyName || null,
      photoUrl || null
    );
    return res.json({
      authenticated: true,
      user: dbUser,
    });
  } catch (error: any) {
    console.error('Error syncing authenticated user:', error);
    return res.status(500).json({ error: error.message || 'Failed to sync user.' });
  }
});

apiRouter.get('/auth/me', requireStrictFirebaseAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { uid, email, displayName, photoUrl } = req.user!;
    let dbUser = await getUserByUid(uid);
    if (!dbUser) {
      dbUser = await getOrCreateUser(uid, email || 'user@firebase.auth', displayName || null, photoUrl || null);
    }
    return res.json({
      authenticated: true,
      user: dbUser,
    });
  } catch (error: any) {
    console.error('Error fetching authenticated user:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch user profile.' });
  }
});

// 1. List user projects (Protected & Ownership-scoped)
apiRouter.get('/projects', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDb();
    const userId = req.user!.uid;

    const list = await db
      .select()
      .from(projects)
      .where(eq(projects.ownerId, userId))
      .orderBy(desc(projects.updatedAt));

    return res.json(list);
  } catch (error: any) {
    console.error('Error listing projects:', error);
    return res.status(500).json({ error: error.message || 'Failed to list projects.' });
  }
});

// 2. Create new project with files (Protected)
apiRouter.post('/projects', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDb();
    const userId = req.user!.uid;
    const {
      title,
      description,
      sourceType,
      repoUrl,
      githubBranch,
      requirementsText,
      targetTechStack,
      deadline,
      files,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Project title is required.' });
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'At least one code file is required to create a project.' });
    }

    const projectId = `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // Insert project
    const newProject = {
      id: projectId,
      ownerId: userId,
      title: title.trim(),
      description: description ? description.trim() : null,
      sourceType: sourceType || 'zip',
      repoUrl: repoUrl || null,
      githubBranch: githubBranch || null,
      requirementsText: requirementsText ? requirementsText.trim() : '',
      targetTechStack: targetTechStack || null,
      deadline: deadline || null,
      healthScore: 0,
      progressPercent: 0,
      status: 'analyzing',
    };

    await db.insert(projects).values(newProject);

    // Insert project files (reconstructed to canonical repository tree)
    const canonicalFiles = reconstructCanonicalRepoTree(
      files.map((f: any) => ({
        ...f,
        filePath: String(f.filePath || ''),
        content: String(f.content ?? ''),
      }))
    );

    for (let i = 0; i < canonicalFiles.length; i++) {
      const f = canonicalFiles[i];
      await db.insert(projectFiles).values({
        id: `file-${i}-${Date.now()}`,
        projectId,
        filePath: f.filePath,
        content: f.content,
        size: f.size || f.content.length,
        language: f.language || null,
        isModified: false,
      });
    }

    // Insert audit log
    await db.insert(auditLogs).values({
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      projectId,
      userId,
      action: 'PROJECT_CREATED',
      details: JSON.stringify({ fileCount: files.length, sourceType }),
    });

    return res.status(201).json(newProject);
  } catch (error: any) {
    console.error('Error creating project:', error);
    return res.status(500).json({ error: error.message || 'Failed to create project.' });
  }
});

// 3. Get single project (Protected & Ownership checked)
apiRouter.get('/projects/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDb();
    const userId = req.user!.uid;
    const { id } = req.params;

    const result = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.ownerId, userId)));

    if (result.length === 0) {
      return res.status(404).json({ error: 'Project not found or unauthorized.' });
    }

    return res.json(result[0]);
  } catch (error: any) {
    console.error('Error fetching project:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch project.' });
  }
});

// 4. Delete project (Protected & Ownership checked)
apiRouter.delete('/projects/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDb();
    const userId = req.user!.uid;
    const { id } = req.params;

    // Check ownership
    const existing = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.ownerId, userId)));

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Project not found or unauthorized.' });
    }

    await db.delete(projects).where(eq(projects.id, id));

    await db.insert(auditLogs).values({
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      projectId: null,
      userId,
      action: 'PROJECT_DELETED',
      details: `User deleted project ${id} and cascading sub-records.`,
    });

    return res.json({ success: true, message: 'Project deleted successfully.' });
  } catch (error: any) {
    console.error('Error deleting project:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete project.' });
  }
});

// 5. Get project files (Protected & Ownership checked)
apiRouter.get('/projects/:id/files', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDb();
    const userId = req.user!.uid;
    const { id } = req.params;

    // Verify project ownership
    const proj = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.ownerId, userId)));

    if (proj.length === 0) {
      return res.status(404).json({ error: 'Project not found or unauthorized.' });
    }

    const files = await db
      .select()
      .from(projectFiles)
      .where(eq(projectFiles.projectId, id));

    return res.json(files);
  } catch (error: any) {
    console.error('Error fetching project files:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch project files.' });
  }
});

// 6. Run Deep Gemini Analysis on project (Protected & Ownership checked)
apiRouter.post('/projects/:id/analyze', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDb();
    const userId = req.user!.uid;
    const { id } = req.params;

    const projResult = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.ownerId, userId)));

    if (projResult.length === 0) {
      return res.status(404).json({ error: 'Project not found or unauthorized.' });
    }

    const project = projResult[0];

    // Fetch files from PostgreSQL
    const files = await db
      .select()
      .from(projectFiles)
      .where(eq(projectFiles.projectId, id));

    if (files.length === 0) {
      return res.status(400).json({ error: 'No files found in database for this project.' });
    }

    // Reconstruct canonical repository file tree and persist any canonicalized file paths
    const canonicalFiles = reconstructCanonicalRepoTree(
      files.map((f: any) => ({
        id: f.id,
        filePath: f.filePath,
        content: f.content,
      }))
    );
    for (let i = 0; i < canonicalFiles.length; i++) {
      if (canonicalFiles[i].filePath !== files[i].filePath) {
        await db
          .update(projectFiles)
          .set({ filePath: canonicalFiles[i].filePath })
          .where(eq(projectFiles.id, canonicalFiles[i].id));
      }
    }

    // Mark project as actively analyzing
    await db
      .update(projects)
      .set({
        status: 'analyzing',
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id));

    // Call real Gemini analysis (includes automatic server-side exponential backoff)
    const analysis = await analyzeCodebaseWithGemini({
      title: project.title,
      requirements: project.requirementsText || '',
      files: canonicalFiles.map((f) => ({ filePath: f.filePath, content: f.content })),
    });

    // Replace any previous report for this project
    await db.delete(analysisReports).where(eq(analysisReports.projectId, id));

    const reportId = `report-${Date.now()}`;
    await db.insert(analysisReports).values({
      id: reportId,
      projectId: id,
      techDetected: analysis.techDetected,
      requirementsSummary: analysis.requirementsSummary,
      healthScore: analysis.healthScore,
      overallSummary: analysis.overallSummary,
      featuresDoneJson: JSON.stringify(analysis.featuresDone),
      featuresBrokenJson: JSON.stringify(analysis.featuresBroken),
      featuresMissingJson: JSON.stringify(analysis.featuresMissing),
      featuresUnverifiableJson: JSON.stringify(analysis.featuresUnverifiable),
    });

    // Delete any old tasks before recreating
    await db.delete(rescueTasks).where(eq(rescueTasks.projectId, id));

    // Save Rescue Tasks
    const initialTasks = [];
    for (let i = 0; i < analysis.rescuePlanTasks.length; i++) {
      const t = analysis.rescuePlanTasks[i];
      const rawCmd = (t.testCommand || '').trim();
      const safeTestCmd = rawCmd === 'npx esbuild' ? '' : rawCmd;
      const taskRecord = {
        id: `task-${i}-${Date.now()}`,
        projectId: id,
        taskOrder: t.order || i + 1,
        title: t.title,
        category: t.category,
        priority: t.priority,
        status: 'pending',
        description: t.description,
        targetFilesJson: JSON.stringify(t.targetFiles || []),
        estimatedMinutes: t.estimatedMinutes || 15,
        testCommand: safeTestCmd,
        isVerified: false,
      };
      await db.insert(rescueTasks).values(taskRecord);
      initialTasks.push({
        ...taskRecord,
        targetFiles: t.targetFiles || [],
      });
    }

    // Update project health score & status
    await db
      .update(projects)
      .set({
        healthScore: analysis.healthScore,
        targetTechStack: analysis.techDetected,
        status: 'in_rescue',
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id));

    return res.json({
      report: {
        id: reportId,
        projectId: id,
        techDetected: analysis.techDetected,
        requirementsSummary: analysis.requirementsSummary,
        healthScore: analysis.healthScore,
        overallSummary: analysis.overallSummary,
        featuresDone: analysis.featuresDone,
        featuresBroken: analysis.featuresBroken,
        featuresMissing: analysis.featuresMissing,
        featuresUnverifiable: analysis.featuresUnverifiable,
        createdAt: new Date().toISOString(),
      },
      tasks: initialTasks,
    });
  } catch (error: any) {
    console.error('Error analyzing project:', error);
    try {
      const db = await getDb();
      const { id } = req.params;
      const existingReports = await db
        .select()
        .from(analysisReports)
        .where(eq(analysisReports.projectId, id));

      if (existingReports.length === 0) {
        await db
          .update(projects)
          .set({
            status: 'failed',
            updatedAt: new Date(),
          })
          .where(eq(projects.id, id));
      }
    } catch (dbErr) {
      console.warn('Failed to update project status after analysis error:', dbErr);
    }

    const statusCode = error.statusCode || 503;
    return res.status(statusCode).json({
      error: error.message || 'Analysis failed due to temporary Gemini API unavailability.',
      retryable: error.retryable ?? true,
      attemptsMade: error.attemptsMade || 4,
    });
  }
});

// 7. Get Analysis Report (Protected)
apiRouter.get('/projects/:id/report', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDb();
    const userId = req.user!.uid;
    const { id } = req.params;

    const proj = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.ownerId, userId)));

    if (proj.length === 0) {
      return res.status(404).json({ error: 'Project not found or unauthorized.' });
    }

    const reportResult = await db
      .select()
      .from(analysisReports)
      .where(eq(analysisReports.projectId, id))
      .orderBy(desc(analysisReports.createdAt));

    if (reportResult.length === 0) {
      return res.json(null);
    }

    const r = reportResult[0];
    return res.json({
      id: r.id,
      projectId: r.projectId,
      techDetected: r.techDetected,
      requirementsSummary: r.requirementsSummary,
      healthScore: r.healthScore,
      overallSummary: r.overallSummary,
      featuresDone: JSON.parse(r.featuresDoneJson || '[]'),
      featuresBroken: JSON.parse(r.featuresBrokenJson || '[]'),
      featuresMissing: JSON.parse(r.featuresMissingJson || '[]'),
      featuresUnverifiable: JSON.parse(r.featuresUnverifiableJson || '[]'),
      createdAt: r.createdAt,
    });
  } catch (error: any) {
    console.error('Error fetching report:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch report.' });
  }
});

// 8. Get Rescue Tasks (Protected)
apiRouter.get('/projects/:id/tasks', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDb();
    const userId = req.user!.uid;
    const { id } = req.params;

    const proj = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.ownerId, userId)));

    if (proj.length === 0) {
      return res.status(404).json({ error: 'Project not found or unauthorized.' });
    }

    const taskList = await db
      .select()
      .from(rescueTasks)
      .where(eq(rescueTasks.projectId, id));

    const formatted = taskList.map((t: any) => ({
      ...t,
      targetFiles: JSON.parse(t.targetFilesJson || '[]'),
      proposedChanges: t.proposedChangesJson ? JSON.parse(t.proposedChangesJson) : [],
    })).sort((a: any, b: any) => a.taskOrder - b.taskOrder);

    return res.json(formatted);
  } catch (error: any) {
    console.error('Error fetching rescue tasks:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch tasks.' });
  }
});

// 9. AI Workspace Diagnose & Propose Code Fix (Protected)
apiRouter.post('/projects/:id/tasks/:taskId/ai-fix', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDb();
    const userId = req.user!.uid;
    const { id, taskId } = req.params;
    const { userMessage } = req.body;

    const proj = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.ownerId, userId)));

    if (proj.length === 0) {
      return res.status(404).json({ error: 'Project not found or unauthorized.' });
    }

    const taskResult = await db
      .select()
      .from(rescueTasks)
      .where(and(eq(rescueTasks.id, taskId), eq(rescueTasks.projectId, id)));

    if (taskResult.length === 0) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const task = taskResult[0];
    const targetFilesArr: string[] = JSON.parse(task.targetFilesJson || '[]');

    // Fetch target files from database
    const allFiles = await db
      .select()
      .from(projectFiles)
      .where(eq(projectFiles.projectId, id));

    const matchingFiles = allFiles.filter((f: any) =>
      targetFilesArr.some(
        (tf) =>
          f.filePath === tf ||
          f.filePath.endsWith(`/${tf}`) ||
          tf.endsWith(`/${f.filePath}`)
      )
    );
    const contextFiles =
      matchingFiles.length > 0 ? matchingFiles : allFiles.slice(0, 10);

    // Call real Gemini fix diagnosis with full repository file paths and complete target files
    const solution = await diagnoseAndProposeCodeFix({
      taskTitle: task.title,
      taskDescription: task.description,
      category: task.category,
      userMessage,
      allProjectFilePaths: allFiles.map((f: any) => f.filePath),
      allProjectFiles: allFiles.map((f: any) => ({ filePath: f.filePath, content: f.content })),
      targetFiles: contextFiles.map((f: any) => ({ filePath: f.filePath, content: f.content })),
      previousVerificationOutput: task.verificationOutput || undefined,
    });

    // Save proposed changes and diagnosis to task in PostgreSQL
    await db
      .update(rescueTasks)
      .set({
        rootCauseAnalysis: solution.rootCause,
        proposedChangesJson: JSON.stringify(solution.proposedChanges),
        updatedAt: new Date(),
      })
      .where(eq(rescueTasks.id, taskId));

    return res.json(solution);
  } catch (error: any) {
    console.error('Error generating AI fix:', error);
    const statusCode = error.statusCode || 503;
    return res.status(statusCode).json({
      error: error.message || 'AI diagnosis failed due to temporary Gemini API unavailability.',
      retryable: error.retryable ?? true,
      attemptsMade: error.attemptsMade || 4,
    });
  }
});

// 10. Apply proposed changes safely to project files in PostgreSQL (Protected)
apiRouter.post('/projects/:id/tasks/:taskId/apply', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDb();
    const userId = req.user!.uid;
    const { id, taskId } = req.params;
    const { changes } = req.body; // Array<{ filePath: string; newContent: string }>

    if (!changes || !Array.isArray(changes) || changes.length === 0) {
      return res.status(400).json({ error: 'No code changes provided to apply.' });
    }

    const proj = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.ownerId, userId)));

    if (proj.length === 0) {
      return res.status(404).json({ error: 'Project not found or unauthorized.' });
    }

    // Apply each file change in PostgreSQL
    for (const change of changes) {
      const existing = await db
        .select()
        .from(projectFiles)
        .where(and(eq(projectFiles.projectId, id), eq(projectFiles.filePath, change.filePath)));

      if (existing.length > 0) {
        await db
          .update(projectFiles)
          .set({
            content: change.newContent,
            size: change.newContent.length,
            isModified: true,
            updatedAt: new Date(),
          })
          .where(eq(projectFiles.id, existing[0].id));
      } else {
        await db.insert(projectFiles).values({
          id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          projectId: id,
          filePath: change.filePath,
          content: change.newContent,
          size: change.newContent.length,
          isModified: true,
        });
      }
    }

    // Update task status to applied
    await db
      .update(rescueTasks)
      .set({
        status: 'applied',
        updatedAt: new Date(),
      })
      .where(eq(rescueTasks.id, taskId));

    await db.insert(auditLogs).values({
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      projectId: id,
      userId,
      action: 'CODE_CHANGES_APPLIED',
      details: JSON.stringify({ taskId, files: changes.map(c => c.filePath) }),
    });

    return res.json({ success: true, message: 'Changes applied safely.' });
  } catch (error: any) {
    console.error('Error applying code changes:', error);
    return res.status(500).json({ error: error.message || 'Failed to apply code changes.' });
  }
});

// 11. Run Real Isolated Verification Runner on Task (Protected)
apiRouter.post('/projects/:id/tasks/:taskId/verify', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDb();
    const userId = req.user!.uid;
    const { id, taskId } = req.params;

    const projResult = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.ownerId, userId)));

    if (projResult.length === 0) {
      return res.status(404).json({ error: 'Project not found or unauthorized.' });
    }

    const project = projResult[0];

    const taskResult = await db
      .select()
      .from(rescueTasks)
      .where(and(eq(rescueTasks.id, taskId), eq(rescueTasks.projectId, id)));

    if (taskResult.length === 0) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const task = taskResult[0];

    // Fetch current code files from PostgreSQL
    const files = await db
      .select()
      .from(projectFiles)
      .where(eq(projectFiles.projectId, id));

    const taskTargetFiles: string[] = JSON.parse(task.targetFilesJson || '[]');

    // Run real isolated sandbox verification
    const verification = await runRealCodeVerification({
      files: files.map((f: any) => ({ filePath: f.filePath, content: f.content })),
      testCommand: task.testCommand,
      category: task.category,
      targetFiles: taskTargetFiles,
    });

    // Save run to verification_runs table
    const runId = `run-${Date.now()}`;
    await db.insert(verificationRuns).values({
      id: runId,
      projectId: id,
      taskId,
      status: verification.status,
      passedChecksJson: JSON.stringify(verification.passedChecks),
      failedChecksJson: JSON.stringify(verification.failedChecks),
      stdout: verification.stdout,
      stderr: verification.stderr,
      durationMs: verification.durationMs,
    });

    // A task must NEVER be verified unless actual verification passed!
    if (verification.status === 'passed') {
      await db
        .update(rescueTasks)
        .set({
          isVerified: true,
          status: 'verified',
          verificationOutput: verification.stdout,
          updatedAt: new Date(),
        })
        .where(eq(rescueTasks.id, taskId));

      // Recompute project health and progress strictly from verified initial report score and verified task completion
      const allTasks = await db
        .select()
        .from(rescueTasks)
        .where(eq(rescueTasks.projectId, id));

      const reportRows = await db
        .select()
        .from(analysisReports)
        .where(eq(analysisReports.projectId, id))
        .orderBy(desc(analysisReports.createdAt));

      const verifiedCount = allTasks.filter((t: any) => t.id === taskId || t.isVerified).length;
      const progress = Math.round((verifiedCount / Math.max(1, allTasks.length)) * 100);
      const initialReportScore = reportRows[0]?.healthScore ?? project.healthScore;
      const newHealth = Math.min(
        100,
        Math.round(
          initialReportScore +
            (verifiedCount / Math.max(1, allTasks.length)) * (100 - initialReportScore)
        )
      );

      await db
        .update(projects)
        .set({
          healthScore: newHealth,
          progressPercent: progress,
          status: verifiedCount === allTasks.length ? 'completed' : 'in_rescue',
          updatedAt: new Date(),
        })
        .where(eq(projects.id, id));
    } else {
      await db
        .update(rescueTasks)
        .set({
          isVerified: false,
          status: 'failed',
          verificationOutput: verification.stderr || verification.stdout,
          updatedAt: new Date(),
        })
        .where(eq(rescueTasks.id, taskId));
    }

    return res.json(verification);
  } catch (error: any) {
    console.error('Error running verification:', error);
    return res.status(500).json({ error: error.message || 'Verification execution failed.' });
  }
});

// 12. GitHub Import (Protected)
apiRouter.post('/projects/github-import', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { repoUrl, branch, githubToken } = req.body;
    if (!repoUrl) {
      return res.status(400).json({ error: 'GitHub repository URL or owner/repo is required.' });
    }

    const repoData = await fetchGitHubRepository(repoUrl, branch, githubToken);
    return res.json(repoData);
  } catch (error: any) {
    console.error('Error importing from GitHub:', error);
    return res.status(400).json({ error: error.message || 'Failed to import repository from GitHub.' });
  }
});

// 13. Optional Cloudinary Free Tier Rescue Snapshot Archive (Protected)
apiRouter.post('/projects/:id/cloud-archive', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDb();
    const userId = req.user!.uid;
    const { id } = req.params;

    const projResult = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.ownerId, userId)));

    if (projResult.length === 0) {
      return res.status(404).json({ error: 'Project not found or unauthorized.' });
    }

    if (!isCloudinaryConfigured()) {
      return res.status(400).json({
        error:
          'Cloudinary Free Tier is optional and not configured in environment variables (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET). Use local ZIP download instead.',
      });
    }

    const project = projResult[0];
    const files = await db.select().from(projectFiles).where(eq(projectFiles.projectId, id));
    const tasks = await db.select().from(rescueTasks).where(eq(rescueTasks.projectId, id));

    const snapshotPayload = JSON.stringify(
      {
        project,
        files,
        tasks,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );

    const uploadResult = await uploadSnapshotToCloudinaryFree(
      id,
      `${project.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_snapshot.json`,
      snapshotPayload
    );

    await db.insert(auditLogs).values({
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      projectId: id,
      userId,
      action: 'CLOUD_ARCHIVE_UPLOADED',
      details: JSON.stringify({
        publicId: uploadResult.publicId,
        secureUrl: uploadResult.secureUrl,
        bytes: uploadResult.bytes,
      }),
    });

    return res.json(uploadResult);
  } catch (error: any) {
    console.error('Error archiving to Cloudinary Free Tier:', error);
    return res.status(500).json({ error: error.message || 'Failed to archive snapshot to Cloudinary.' });
  }
});
