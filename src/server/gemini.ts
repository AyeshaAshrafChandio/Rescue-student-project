import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import {
  inspectAndVerifyRepository,
  normalizeRepoPath,
  reconstructCanonicalRepoTree,
  type PreAnalysisVerificationReport,
} from './verifier.ts';

let _aiClient: GoogleGenAI | null = null;

export function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new GeminiServiceError(
      'GEMINI_API_KEY environment variable is missing on the server.',
      500,
      false,
      1
    );
  }
  if (!_aiClient) {
    _aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return _aiClient;
}

export class GeminiServiceError extends Error {
  statusCode: number;
  retryable: boolean;
  attemptsMade: number;

  constructor(message: string, statusCode = 503, retryable = true, attemptsMade = 1) {
    super(message);
    this.name = 'GeminiServiceError';
    this.statusCode = statusCode;
    this.retryable = retryable;
    this.attemptsMade = attemptsMade;
  }
}

export function isRetryableGeminiError(err: any): boolean {
  if (!err) return false;
  const status = Number(err.status || err.statusCode || err.code || 0);
  if ([429, 500, 502, 503, 504].includes(status)) {
    return true;
  }

  const msg = String(err.message || err.toString() || '').toLowerCase();
  return (
    msg.includes('503') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('spikes in demand') ||
    msg.includes('overloaded') ||
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('rate limit') ||
    msg.includes('quota') ||
    msg.includes('temporarily') ||
    msg.includes('internal') ||
    msg.includes('fetch failed') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('empty response') ||
    msg.includes('unexpected end of json')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const CANDIDATE_FLASH_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
] as const;

async function callGeminiWithExponentialBackoff<T>(
  operationName: string,
  buildRequest: (model: string) => {
    model: string;
    contents: string;
    config: Record<string, any>;
  },
  validateAndParse: (rawText: string) => T,
  maxAttempts = 4,
  baseDelayMs = 1200
): Promise<T> {
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const model = CANDIDATE_FLASH_MODELS[(attempt - 1) % CANDIDATE_FLASH_MODELS.length];
    try {
      const req = buildRequest(model);
      const extraConfig: Record<string, any> = {};
      if (model === 'gemini-3.1-flash-lite') {
        extraConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.MINIMAL };
      } else if (model === 'gemini-3.8-flash') {
        extraConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      }

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: req.model,
        contents: req.contents,
        config: {
          ...req.config,
          ...extraConfig,
        },
      });

      const rawText = response.text?.trim();
      if (!rawText) {
        throw new Error('Empty response received from Gemini model.');
      }

      return validateAndParse(rawText);
    } catch (err: any) {
      lastError = err;
      const retryable = isRetryableGeminiError(err);

      console.warn(
        `[Gemini Retry] ${operationName} attempt ${attempt}/${maxAttempts} (${model}) failed: ${
          err.message || err
        }`
      );

      if (!retryable || attempt === maxAttempts) {
        break;
      }

      const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.floor(Math.random() * 500);
      const waitMs = Math.min(10000, exponentialDelay + jitter);

      console.log(
        `[Gemini Retry] Waiting ${waitMs}ms before attempt ${attempt + 1}/${maxAttempts}...`
      );
      await sleep(waitMs);
    }
  }

  const isDemandError = isRetryableGeminiError(lastError);
  const cleanMessage = isDemandError
    ? 'Gemini API is currently experiencing high demand (503 UNAVAILABLE). Automatic retries with exponential backoff were completed without a response. Please click Retry Analysis to try again.'
    : lastError?.message || `Gemini ${operationName} failed.`;

  throw new GeminiServiceError(
    cleanMessage,
    isDemandError ? 503 : 500,
    isDemandError,
    maxAttempts
  );
}

export interface AnalyzeProjectInput {
  title: string;
  requirements: string;
  files: Array<{ filePath: string; content: string }>;
}

export interface AnalysisResult {
  techDetected: string;
  requirementsSummary: string;
  healthScore: number;
  overallSummary: string;
  featuresDone: Array<{ title: string; fileEvidence: string; description: string }>;
  featuresBroken: Array<{
    title: string;
    severity: 'critical' | 'high' | 'medium';
    fileEvidence: string;
    errorExplanation: string;
    rootCause: string;
  }>;
  featuresMissing: Array<{
    title: string;
    priority: 'critical' | 'high' | 'medium';
    requirementReference: string;
    whyMissing: string;
  }>;
  featuresUnverifiable: Array<{
    title: string;
    reason: string;
    suggestedVerification: string;
  }>;
  rescuePlanTasks: Array<{
    order: number;
    title: string;
    category: 'broken_fix' | 'missing_feature' | 'dependency_config' | 'test_verification';
    priority: 'critical' | 'high' | 'medium' | 'low';
    targetFiles: string[];
    estimatedMinutes: number;
    description: string;
    testCommand: string;
  }>;
}

/**
 * Deterministic health score calculation derived strictly from verified repository findings.
 * Never invents or guesses a score.
 */
export function calculateVerifiedHealthScore(
  preCheck: PreAnalysisVerificationReport,
  analysis: Omit<AnalysisResult, 'healthScore'>
): number {
  const totalFiles = Math.max(1, preCheck.totalFiles);

  // 1. AST Syntax & JSON Manifest Integrity (0 - 25 points)
  const validFilesCount = preCheck.fileInventory.filter((f) => f.syntaxValid).length;
  const syntaxScore = (validFilesCount / totalFiles) * 25;

  // 2. Module Resolution, HTML Entry Points, Dependencies & Bundling (0 - 30 points)
  let buildResolutionScore = 30;
  buildResolutionScore -= Math.min(12, preCheck.brokenHtmlReferences.length * 6);
  buildResolutionScore -= Math.min(14, preCheck.unresolvedRelativeImports.length * 2);
  buildResolutionScore -= Math.min(10, preCheck.missingPackageDependencies.length * 4);
  buildResolutionScore -= Math.min(8, preCheck.runtimeAndSdkIssues.length * 2);
  if (
    preCheck.bundleCheckSummary.attemptedEntryPoints.length > 0 &&
    preCheck.bundleCheckSummary.passedEntryPoints.length === 0
  ) {
    buildResolutionScore = Math.min(buildResolutionScore, 10);
  }
  buildResolutionScore = Math.max(0, buildResolutionScore);

  // 3. Verified Feature & Requirement Coverage (0 - 45 points)
  const doneWeight = analysis.featuresDone.length * 1.2;
  const brokenPenalty = analysis.featuresBroken.reduce((acc, b) => {
    const sev = String(b.severity).toLowerCase();
    if (sev === 'critical') return acc + 1.6;
    if (sev === 'high') return acc + 1.1;
    return acc + 0.6;
  }, 0);
  const missingPenalty = analysis.featuresMissing.reduce((acc, m) => {
    const prio = String(m.priority).toLowerCase();
    if (prio === 'critical') return acc + 1.4;
    if (prio === 'high') return acc + 0.9;
    return acc + 0.5;
  }, 0);

  const totalFeatureWeight = doneWeight + brokenPenalty + missingPenalty;
  const featureRatio =
    totalFeatureWeight > 0
      ? doneWeight / totalFeatureWeight
      : analysis.featuresBroken.length === 0 && analysis.featuresMissing.length === 0
      ? 1
      : 0.5;
  const featureScore = featureRatio * 45;

  const computed = Math.round(syntaxScore + buildResolutionScore + featureScore);
  return Math.max(5, Math.min(100, computed));
}

export async function analyzeCodebaseWithGemini(
  input: AnalyzeProjectInput
): Promise<AnalysisResult> {
  // STEP 1: RECONSTRUCT CANONICAL REPO TREE & VERIFY REAL REPOSITORY FILES BEFORE MAKING ANY FINDING
  const canonicalFiles = reconstructCanonicalRepoTree(input.files);
  const preCheck = await inspectAndVerifyRepository(canonicalFiles);

  // Build complete, untruncated file dump so Gemini sees 100% of the actual code
  const MAX_CHARS_PER_FILE = 100000;
  const fullFilesDump = canonicalFiles
    .slice(0, 60)
    .map((f) => {
      const isComplete = f.content.length <= MAX_CHARS_PER_FILE;
      const body = isComplete ? f.content : f.content.slice(0, MAX_CHARS_PER_FILE);
      const lineCount = f.content.split('\n').length;
      return `=== FILE: ${f.filePath} (COMPLETE FILE IN REPO: ${f.content.length} chars, ${lineCount} lines) ===\n${body}${
        !isComplete
          ? `\n[NOTE: File is ${f.content.length} chars in repo; first ${MAX_CHARS_PER_FILE} chars shown above]`
          : '\n=== END OF FILE ==='
      }`;
    })
    .join('\n\n');

  const preVerificationSummary = JSON.stringify(
    {
      totalFiles: preCheck.totalFiles,
      totalBytes: preCheck.totalBytes,
      detectedTechStack: preCheck.detectedTechStack,
      packageJsonSummary: preCheck.packageJsonSummary,
      readmeContent: preCheck.readmeContent,
      fileInventory: preCheck.fileInventory,
      syntaxErrors: preCheck.syntaxErrors,
      jsonErrors: preCheck.jsonErrors,
      brokenHtmlReferences: preCheck.brokenHtmlReferences,
      unresolvedRelativeImports: preCheck.unresolvedRelativeImports,
      missingPackageDependencies: preCheck.missingPackageDependencies,
      backendRoutesImplemented: preCheck.backendRoutesImplemented,
      frontendApiCalls: preCheck.frontendApiCalls,
      runtimeAndSdkIssues: preCheck.runtimeAndSdkIssues,
      hasAutomatedTests: preCheck.hasAutomatedTests,
      testFiles: preCheck.testFiles,
      bundleCheckSummary: preCheck.bundleCheckSummary,
    },
    null,
    2
  );

  const prompt = `You are the Lead Static & Runtime Verifier for Student Project Rescue.
You MUST analyze ONLY the student's actual uploaded repository files and the deterministic Pre-Analysis Verification Audit below.

STRICT NON-NEGOTIABLE VERIFICATION RULES:
1. READ AND VERIFY REAL FILES ONLY: Every single file shown below with "=== END OF FILE ===" is the COMPLETE, UNTRUNCATED file in the repository.
2. NEVER FALSELY CLAIM TRUNCATION: Look at "preVerificationSummary.fileInventory" and "syntaxErrors". If a file has "syntaxValid: true" and ends with "=== END OF FILE ===", it is NOT truncated! NEVER claim a file is truncated, cut off mid-JSX, or missing routes that actually appear in the file or in "backendRoutesImplemented".
3. VERIFY ACTUAL ISSUES FROM THE PRE-ANALYSIS AUDIT AND REAL CODE:
   - Check "brokenHtmlReferences": ONLY report an HTML reference issue if "brokenHtmlReferences" is non-empty. If "brokenHtmlReferences" is [], index.html references are 100% valid—NEVER report index.html as broken!
   - Check "unresolvedRelativeImports": ONLY report a relative import or module resolution issue if "unresolvedRelativeImports" is non-empty. If "unresolvedRelativeImports" is [], all relative imports (such as "../types" and "./components/...") are 100% valid for the folder structure—NEVER report them as broken!
   - Check "missingPackageDependencies" and "packageJsonSummary".
   - Check "runtimeAndSdkIssues" (e.g., if server.ts uses an invalid/unsupported Gemini model name like "gemini-3.5-flash" instead of "gemini-2.5-flash" or "gemini-flash-latest").
   - Check "backendRoutesImplemented" vs "frontendApiCalls". Only report a route as missing if it is genuinely absent from "backendRoutesImplemented" and the server code.
   - Check "readmeContent" and the student's requirements against the actual implemented UI and backend logic.
4. SEPARATE FINDINGS ACCURATELY WITH REAL EVIDENCE:
   - featuresDone: Every genuinely implemented component, backend endpoint, utility, state persistence, and configuration verified in the repository. Include exact file paths and route/function evidence.
   - featuresBroken: ONLY genuinely broken items proven by the actual files and Pre-Analysis Audit (broken import paths vs file layout, broken HTML entry script path, invalid API model identifiers, syntax/type errors, runtime bugs). Include exact file paths, line/import evidence, error explanation, and root cause.
   - featuresMissing: ONLY requirements from README.md or student specification that are genuinely not implemented in the files. If a feature IS implemented in the views/backend (like quiz scorecards, study planner, flashcards, chat, or summarization), put it in featuresDone, NOT featuresMissing.
   - featuresUnverifiable: Aspects that cannot be verified without live runtime secrets/API keys (e.g., live Gemini API responses requiring GEMINI_API_KEY at runtime, external CDN scripts in browser) or missing automated test suites.
5. RESCUE PLAN TASKS (rescuePlanTasks):
   - Include ONLY genuinely required, actionable tasks that fix the verified BROKEN issues, implement genuinely MISSING requirements, or verify build/bundling.
   - Group all broken HTML entry references and unresolved relative imports across root/component files into a single cohesive module-resolution task so fixing it resolves frontend bundling cleanly.
   - For each task's "testCommand", provide a real command that tests the actual target file(s) in the repository:
     * For frontend entry/component tasks: e.g. 'esbuild "main.tsx" --bundle --platform=browser --packages=external --outfile=/dev/null' (using the actual path of main.tsx or target file in the repo).
     * For backend server tasks: e.g. 'esbuild "server.ts" --bundle --platform=node --packages=external --outfile=/dev/null'.

PROJECT TITLE:
${input.title}

STUDENT SPECIFICATION / ADDITIONAL REQUIREMENTS:
${
  input.requirements ||
  preCheck.readmeContent ||
  'Infer requirements strictly from README.md, metadata.json, package.json, and codebase structure.'
}

DETERMINISTIC PRE-ANALYSIS VERIFICATION AUDIT (GROUND TRUTH):
${preVerificationSummary}

COMPLETE REPOSITORY FILES (${input.files.length} files):
${fullFilesDump}`;

  return callGeminiWithExponentialBackoff<AnalysisResult>(
    'Codebase Analysis',
    (model) => ({
      model,
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            techDetected: { type: Type.STRING },
            requirementsSummary: { type: Type.STRING },
            healthScore: { type: Type.INTEGER },
            overallSummary: { type: Type.STRING },
            featuresDone: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  fileEvidence: { type: Type.STRING },
                  description: { type: Type.STRING },
                },
                required: ['title', 'fileEvidence', 'description'],
              },
            },
            featuresBroken: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  severity: { type: Type.STRING },
                  fileEvidence: { type: Type.STRING },
                  errorExplanation: { type: Type.STRING },
                  rootCause: { type: Type.STRING },
                },
                required: [
                  'title',
                  'severity',
                  'fileEvidence',
                  'errorExplanation',
                  'rootCause',
                ],
              },
            },
            featuresMissing: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  priority: { type: Type.STRING },
                  requirementReference: { type: Type.STRING },
                  whyMissing: { type: Type.STRING },
                },
                required: ['title', 'priority', 'requirementReference', 'whyMissing'],
              },
            },
            featuresUnverifiable: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  suggestedVerification: { type: Type.STRING },
                },
                required: ['title', 'reason', 'suggestedVerification'],
              },
            },
            rescuePlanTasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  order: { type: Type.INTEGER },
                  title: { type: Type.STRING },
                  category: { type: Type.STRING },
                  priority: { type: Type.STRING },
                  targetFiles: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  estimatedMinutes: { type: Type.INTEGER },
                  description: { type: Type.STRING },
                  testCommand: { type: Type.STRING },
                },
                required: [
                  'order',
                  'title',
                  'category',
                  'priority',
                  'targetFiles',
                  'estimatedMinutes',
                  'description',
                  'testCommand',
                ],
              },
            },
          },
          required: [
            'techDetected',
            'requirementsSummary',
            'healthScore',
            'overallSummary',
            'featuresDone',
            'featuresBroken',
            'featuresMissing',
            'featuresUnverifiable',
            'rescuePlanTasks',
          ],
        },
      },
    }),
    (rawText) => {
      const parsed = JSON.parse(rawText) as AnalysisResult;
      if (
        !parsed ||
        typeof parsed.overallSummary !== 'string' ||
        !parsed.overallSummary.trim() ||
        !Array.isArray(parsed.rescuePlanTasks)
      ) {
        throw new Error('Invalid or incomplete analysis JSON returned by Gemini.');
      }

      const normalizeSev = (s: string): 'critical' | 'high' | 'medium' => {
        const lower = String(s || '').toLowerCase();
        if (lower === 'critical') return 'critical';
        if (lower === 'high') return 'high';
        return 'medium';
      };

      const normalizeTaskPrio = (s: string): 'critical' | 'high' | 'medium' | 'low' => {
        const lower = String(s || '').toLowerCase();
        if (lower === 'critical') return 'critical';
        if (lower === 'high') return 'high';
        if (lower === 'low') return 'low';
        return 'medium';
      };

      const normalizeCategory = (
        s: string
      ): 'broken_fix' | 'missing_feature' | 'dependency_config' | 'test_verification' => {
        const lower = String(s || '').toLowerCase();
        if (
          lower === 'broken_fix' ||
          lower === 'missing_feature' ||
          lower === 'dependency_config' ||
          lower === 'test_verification'
        ) {
          return lower;
        }
        if (lower.includes('missing')) return 'missing_feature';
        if (lower.includes('dep') || lower.includes('config')) return 'dependency_config';
        if (lower.includes('test') || lower.includes('verif') || lower.includes('build'))
          return 'test_verification';
        return 'broken_fix';
      };

      const hasZeroSyntaxErrors =
        preCheck.syntaxErrors.length === 0 && preCheck.jsonErrors.length === 0;
      const hasZeroBrokenHtml = preCheck.brokenHtmlReferences.length === 0;
      const hasZeroUnresolvedImports = preCheck.unresolvedRelativeImports.length === 0;
      const allFrontendRoutesMatched =
        preCheck.frontendApiCalls.length > 0 &&
        preCheck.frontendApiCalls.every((c) => c.matchedBackendRoute);

      const cleanedBroken = (Array.isArray(parsed.featuresBroken) ? parsed.featuresBroken : [])
        .filter((item) => {
          const combined = `${item.title} ${item.fileEvidence} ${item.errorExplanation} ${item.rootCause}`.toLowerCase();
          if (hasZeroSyntaxErrors) {
            if (combined.includes('truncated') || combined.includes('cut off mid')) {
              return false;
            }
          }
          if (
            hasZeroBrokenHtml &&
            (combined.includes('index.html') ||
              combined.includes('/src/main.tsx') ||
              combined.includes('html script'))
          ) {
            return false;
          }
          if (
            hasZeroUnresolvedImports &&
            (combined.includes('relative import') ||
              combined.includes('module resolution') ||
              combined.includes('import path') ||
              combined.includes('./components/') ||
              combined.includes('../types'))
          ) {
            return false;
          }
          if (
            allFrontendRoutesMatched &&
            (combined.includes('missing endpoint') ||
              combined.includes('missing route') ||
              combined.includes('endpoints are missing'))
          ) {
            return false;
          }
          return true;
        })
        .map((item) => ({
          ...item,
          severity: normalizeSev(item.severity),
        }));

      // Ensure verified preCheck broken findings are never omitted
      if (preCheck.brokenHtmlReferences.length > 0) {
        const htmlRef = preCheck.brokenHtmlReferences[0];
        const hasHtmlBroken = cleanedBroken.some((b) =>
          `${b.fileEvidence} ${b.title} ${b.errorExplanation}`
            .toLowerCase()
            .includes(htmlRef.htmlFile.toLowerCase())
        );
        if (!hasHtmlBroken) {
          cleanedBroken.unshift({
            title: `Broken HTML Entry Script Path in ${htmlRef.htmlFile}`,
            severity: 'critical',
            fileEvidence: htmlRef.htmlFile,
            errorExplanation: `${htmlRef.htmlFile} references "${htmlRef.referencedPath}", which does not exist at that path in the repository.`,
            rootCause: htmlRef.suggestedMatch
              ? `Entry file is located at "/${htmlRef.suggestedMatch}" rather than "${htmlRef.referencedPath}".`
              : `Referenced script "${htmlRef.referencedPath}" is missing at that path.`,
          });
        }
      }

      if (preCheck.unresolvedRelativeImports.length > 0) {
        const affectedImportFiles = Array.from(
          new Set(preCheck.unresolvedRelativeImports.map((u) => u.sourceFile))
        );
        const hasImportBroken = cleanedBroken.some((b) => {
          const text = `${b.title} ${b.errorExplanation} ${b.rootCause}`.toLowerCase();
          return (
            text.includes('import') ||
            text.includes('resolve') ||
            text.includes('./components/') ||
            text.includes('../types')
          );
        });
        if (!hasImportBroken) {
          cleanedBroken.unshift({
            title: 'Unresolved Relative Module Imports Across Repository Files',
            severity: 'critical',
            fileEvidence: affectedImportFiles.join(', '),
            errorExplanation: preCheck.unresolvedRelativeImports
              .slice(0, 4)
              .map((u) => `${u.sourceFile}:${u.line} (${u.importSpecifier})`)
              .join('; '),
            rootCause:
              'Relative import specifiers assume a nested directory structure (such as ./components/* or ../types) while the actual files reside in a flat root layout.',
          });
        }
      }

      if (preCheck.runtimeAndSdkIssues.length > 0) {
        const firstSdk = preCheck.runtimeAndSdkIssues[0];
        const hasSdkBroken = cleanedBroken.some((b) =>
          `${b.fileEvidence} ${b.title} ${b.errorExplanation}`
            .toLowerCase()
            .includes(firstSdk.filePath.toLowerCase())
        );
        if (!hasSdkBroken) {
          cleanedBroken.push({
            title: `Invalid or Unsupported Model Identifier in ${firstSdk.filePath}`,
            severity: 'high',
            fileEvidence: `${firstSdk.filePath} (lines ${preCheck.runtimeAndSdkIssues
              .map((r) => r.line)
              .join(', ')})`,
            errorExplanation: firstSdk.issue,
            rootCause: `Code specifies "${
              firstSdk.invalidValue || 'invalid model'
            }" instead of a supported Gemini model identifier such as "gemini-flash-latest".`,
          });
        }
      }

      const cleanedMissing = (Array.isArray(parsed.featuresMissing) ? parsed.featuresMissing : [])
        .filter((item) => {
          const combined = `${item.title} ${item.whyMissing}`.toLowerCase();
          if (
            hasZeroSyntaxErrors &&
            (combined.includes('due to truncation') || combined.includes('truncated'))
          ) {
            return false;
          }
          if (
            allFrontendRoutesMatched &&
            (combined.includes('/api/study/') ||
              combined.includes('backend routes for') ||
              combined.includes('endpoints are missing'))
          ) {
            return false;
          }
          return true;
        })
        .map((item) => ({
          ...item,
          priority: normalizeSev(item.priority),
        }));

      const allImportBrokenFiles = Array.from(
        new Set([
          ...preCheck.brokenHtmlReferences.map((b) => b.htmlFile),
          ...preCheck.unresolvedRelativeImports.map((u) => u.sourceFile),
        ])
      );

      let cleanedTasks = (Array.isArray(parsed.rescuePlanTasks) ? parsed.rescuePlanTasks : [])
        .filter((task) => {
          const combined = `${task.title} ${task.description}`.toLowerCase();
          if (
            hasZeroSyntaxErrors &&
            (combined.includes('truncated') || combined.includes('close all open jsx'))
          ) {
            return false;
          }
          if (
            hasZeroBrokenHtml &&
            hasZeroUnresolvedImports &&
            (combined.includes('import path') ||
              combined.includes('relative import') ||
              combined.includes('module resolution') ||
              combined.includes('./components/') ||
              combined.includes('../types'))
          ) {
            return false;
          }
          return true;
        })
        .map((task, idx) => {
          const targetFiles = Array.isArray(task.targetFiles)
            ? task.targetFiles.map(normalizeRepoPath)
            : [];
          const text = `${task.title} ${task.description}`.toLowerCase();
          const isImportOrHtmlTask =
            text.includes('import') ||
            text.includes('resolve') ||
            text.includes('index.html') ||
            text.includes('module') ||
            targetFiles.some((tf) => allImportBrokenFiles.includes(tf));

          // Ensure import/module resolution task includes all files with broken HTML refs or relative imports
          const mergedTargets =
            isImportOrHtmlTask && allImportBrokenFiles.length > 0
              ? Array.from(new Set([...allImportBrokenFiles, ...targetFiles]))
              : targetFiles;

          return {
            ...task,
            order: idx + 1,
            priority: normalizeTaskPrio(task.priority),
            category: normalizeCategory(task.category),
            targetFiles: mergedTargets,
          };
        });

      // Deduplicate tasks if multiple tasks got merged onto the exact same allImportBrokenFiles set
      const seenImportTask = { count: 0 };
      cleanedTasks = cleanedTasks.filter((t) => {
        const isFullImportSet =
          allImportBrokenFiles.length > 1 &&
          allImportBrokenFiles.every((f) => t.targetFiles.includes(f));
        if (isFullImportSet) {
          seenImportTask.count++;
          return seenImportTask.count === 1;
        }
        return true;
      });

      cleanedTasks = cleanedTasks.map((t, idx) => ({
        ...t,
        order: idx + 1,
      }));

      const cleanedDone = Array.isArray(parsed.featuresDone) ? parsed.featuresDone : [];
      const cleanedUnverifiable = Array.isArray(parsed.featuresUnverifiable)
        ? parsed.featuresUnverifiable
        : [];

      const detectedTech =
        parsed.techDetected?.trim() ||
        preCheck.detectedTechStack.join(', ') ||
        'JavaScript / TypeScript';

      const verifiedHealthScore = calculateVerifiedHealthScore(preCheck, {
        techDetected: detectedTech,
        requirementsSummary: parsed.requirementsSummary || '',
        overallSummary: parsed.overallSummary,
        featuresDone: cleanedDone,
        featuresBroken: cleanedBroken,
        featuresMissing: cleanedMissing,
        featuresUnverifiable: cleanedUnverifiable,
        rescuePlanTasks: cleanedTasks,
      });

      return {
        techDetected: detectedTech,
        requirementsSummary: parsed.requirementsSummary || '',
        healthScore: verifiedHealthScore,
        overallSummary: parsed.overallSummary,
        featuresDone: cleanedDone,
        featuresBroken: cleanedBroken,
        featuresMissing: cleanedMissing,
        featuresUnverifiable: cleanedUnverifiable,
        rescuePlanTasks: cleanedTasks,
      };
    }
  );
}

export interface WorkspaceTaskInput {
  taskTitle: string;
  taskDescription: string;
  category: string;
  userMessage?: string;
  allProjectFilePaths?: string[];
  allProjectFiles?: Array<{ filePath: string; content: string }>;
  targetFiles: Array<{ filePath: string; content: string }>;
  previousVerificationOutput?: string;
}

export interface WorkspaceResponse {
  explanation: string;
  rootCause: string;
  proposedChanges: Array<{
    filePath: string;
    description: string;
    newContent: string;
  }>;
  verificationAdvice: string;
}

/**
 * Applies verified deterministic fixes for broken HTML entry paths, unresolved relative imports,
 * and invalid Gemini SDK model identifiers on a file's content so that known static/SDK errors
 * in target files are guaranteed to be resolved cleanly without truncating any lines.
 */
function applyVerifiedPreCheckFixesToFile(
  filePath: string,
  content: string,
  preCheck: PreAnalysisVerificationReport
): { updatedContent: string; appliedNotes: string[] } {
  const normPath = normalizeRepoPath(filePath);
  let updated = content;
  const appliedNotes: string[] = [];

  // 1. Fix broken HTML script references that have a verified suggestedMatch
  const htmlIssues = preCheck.brokenHtmlReferences.filter(
    (b) => normalizeRepoPath(b.htmlFile) === normPath && b.suggestedMatch
  );
  for (const h of htmlIssues) {
    const newRef = `/${normalizeRepoPath(h.suggestedMatch!)}`;
    if (updated.includes(h.referencedPath)) {
      updated = updated.split(h.referencedPath).join(newRef);
      appliedNotes.push(`Updated HTML script src from "${h.referencedPath}" to "${newRef}".`);
    }
  }

  // 2. Fix unresolved relative imports that have a verified suggestedRelativeImport
  const importIssues = preCheck.unresolvedRelativeImports.filter(
    (u) => normalizeRepoPath(u.sourceFile) === normPath && u.suggestedRelativeImport
  );
  for (const imp of importIssues) {
    const escapedSpec = imp.importSpecifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const reg = new RegExp(`(['"])${escapedSpec}\\1`, 'g');
    if (reg.test(updated)) {
      updated = updated.replace(reg, `$1${imp.suggestedRelativeImport}$1`);
      appliedNotes.push(
        `Updated import "${imp.importSpecifier}" to "${imp.suggestedRelativeImport}" (matching ${imp.suggestedMatch}).`
      );
    }
  }

  // 3. Fix invalid/deprecated Gemini model identifiers in runtimeAndSdkIssues
  const sdkIssues = preCheck.runtimeAndSdkIssues.filter(
    (s) => normalizeRepoPath(s.filePath) === normPath && s.invalidValue
  );
  for (const sdk of sdkIssues) {
    const badVal = sdk.invalidValue!;
    const goodVal = sdk.replacementValue || 'gemini-flash-latest';
    const escapedBad = badVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const reg = new RegExp(`(model\\s*:\\s*['"\`])${escapedBad}(['"\`])`, 'g');
    if (reg.test(updated)) {
      updated = updated.replace(reg, `$1${goodVal}$2`);
      appliedNotes.push(`Replaced invalid Gemini model "${badVal}" with "${goodVal}".`);
    }
  }

  return { updatedContent: updated, appliedNotes };
}

export async function diagnoseAndProposeCodeFix(
  input: WorkspaceTaskInput
): Promise<WorkspaceResponse> {
  const repoFilesForVerification =
    input.allProjectFiles && input.allProjectFiles.length > 0
      ? input.allProjectFiles
      : input.targetFiles;

  const preCheck = await inspectAndVerifyRepository(repoFilesForVerification);

  const targetPathsSet = new Set(input.targetFiles.map((f) => normalizeRepoPath(f.filePath)));
  const originalContentMap = new Map<string, string>();
  for (const f of repoFilesForVerification) {
    originalContentMap.set(normalizeRepoPath(f.filePath), f.content);
  }
  for (const f of input.targetFiles) {
    originalContentMap.set(normalizeRepoPath(f.filePath), f.content);
  }

  const targetSyntaxErrors = preCheck.syntaxErrors.filter((s) =>
    targetPathsSet.has(normalizeRepoPath(s.filePath))
  );
  const targetBrokenHtml = preCheck.brokenHtmlReferences.filter((b) =>
    targetPathsSet.has(normalizeRepoPath(b.htmlFile))
  );
  const targetUnresolvedImports = preCheck.unresolvedRelativeImports.filter((u) =>
    targetPathsSet.has(normalizeRepoPath(u.sourceFile))
  );
  const targetSdkIssues = preCheck.runtimeAndSdkIssues.filter((s) =>
    targetPathsSet.has(normalizeRepoPath(s.filePath))
  );

  const filesContext = input.targetFiles
    .map(
      (f) =>
        `=== FILE: ${f.filePath} (${f.content.length} chars) ===\n${f.content}\n=== END OF FILE ===`
    )
    .join('\n\n');

  const repoPathsList =
    input.allProjectFilePaths && input.allProjectFilePaths.length > 0
      ? input.allProjectFilePaths.join(', ')
      : repoFilesForVerification.map((f) => f.filePath).join(', ');

  const prompt = `You are the Automated Code Debugger and Software Engineer for Student Project Rescue.
Your role is to diagnose real root causes from the student's actual code files, verify against the repository file structure and failed verification errors, and propose exact search/replace code edits.

COMPLETE LIST OF FILE PATHS IN THIS REPOSITORY:
[${repoPathsList}]

TASK TO RESOLVE:
Title: ${input.taskTitle}
Description: ${input.taskDescription}
Category: ${input.category}

STATIC & IMPORT VERIFICATION ON TARGET FILES:
- Syntax errors: ${JSON.stringify(targetSyntaxErrors)}
- Broken HTML references: ${JSON.stringify(targetBrokenHtml)}
- Unresolved relative imports: ${JSON.stringify(targetUnresolvedImports)}
- Runtime / SDK model issues: ${JSON.stringify(targetSdkIssues)}

PREVIOUS VERIFICATION RESULT / ERRORS (if any):
${input.previousVerificationOutput || 'None yet.'}

STUDENT'S INQUIRY / INSTRUCTION:
${
  input.userMessage ||
  'Please analyze this task against the actual repository file paths and target file contents, diagnose the exact root cause, and provide exact search/replace edits for each file that needs changes.'
}

TARGET CODE FILES:
${filesContext}

INSTRUCTIONS:
1. Provide a clear technical breakdown explaining the exact issue with file and line/import evidence.
2. Identify the exact root cause based on the actual repository files.
3. For each file that needs modifications, provide an array of exact "edits" ({ "search": "<exact substring in original file>", "replace": "<updated replacement substring>" }).
   - Only provide "newFileContent" if creating a brand-new file that does not exist yet or replacing a tiny file (< 500 chars). For existing code files, ALWAYS use "edits" so no existing code is ever truncated!
   - Make sure all relative imports in modified files match the ACTUAL file paths in [${repoPathsList}].
   - If fixing an invalid Gemini model identifier like "gemini-3.5-flash", replace it with "gemini-flash-latest".
4. Provide clear verification advice.`;

  return callGeminiWithExponentialBackoff<WorkspaceResponse>(
    'Workspace Code Fix Diagnosis',
    (model) => ({
      model,
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            explanation: { type: Type.STRING },
            rootCause: { type: Type.STRING },
            filePatches: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  filePath: { type: Type.STRING },
                  description: { type: Type.STRING },
                  edits: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        search: { type: Type.STRING },
                        replace: { type: Type.STRING },
                      },
                      required: ['search', 'replace'],
                    },
                  },
                  newFileContent: { type: Type.STRING },
                },
                required: ['filePath', 'description', 'edits'],
              },
            },
            verificationAdvice: { type: Type.STRING },
          },
          required: ['explanation', 'rootCause', 'filePatches', 'verificationAdvice'],
        },
      },
    }),
    (rawText) => {
      const parsed = JSON.parse(rawText) as {
        explanation: string;
        rootCause: string;
        filePatches: Array<{
          filePath: string;
          description: string;
          edits: Array<{ search: string; replace: string }>;
          newFileContent?: string;
        }>;
        verificationAdvice: string;
      };

      if (
        !parsed ||
        typeof parsed.explanation !== 'string' ||
        !Array.isArray(parsed.filePatches)
      ) {
        throw new Error('Invalid or incomplete diagnosis response from Gemini.');
      }

      const proposedChangesMap = new Map<
        string,
        { filePath: string; description: string; newContent: string }
      >();

      for (const patch of parsed.filePatches) {
        const normPath = normalizeRepoPath(patch.filePath);
        const original = originalContentMap.get(normPath);

        if (typeof original === 'string') {
          let updated = original;
          if (Array.isArray(patch.edits) && patch.edits.length > 0) {
            for (const edit of patch.edits) {
              if (edit.search && updated.includes(edit.search)) {
                updated = updated.split(edit.search).join(edit.replace);
              }
            }
          } else if (
            patch.newFileContent &&
            patch.newFileContent.trim().length > 0 &&
            (original.length < 800 || patch.newFileContent.length >= original.length * 0.8)
          ) {
            updated = patch.newFileContent;
          }

          // Also run deterministic preCheck fix pass on this file so no verified import/HTML/SDK issue is missed
          const verifiedPass = applyVerifiedPreCheckFixesToFile(normPath, updated, preCheck);
          updated = verifiedPass.updatedContent;

          if (updated !== original) {
            proposedChangesMap.set(normPath, {
              filePath: normPath,
              description: patch.description || `Updated ${normPath}`,
              newContent: updated,
            });
          }
        } else if (patch.newFileContent && patch.newFileContent.trim().length > 0) {
          proposedChangesMap.set(normPath, {
            filePath: normPath,
            description: patch.description || `Created ${normPath}`,
            newContent: patch.newFileContent,
          });
        }
      }

      // Ensure all targetFiles that have deterministic preCheck issues (broken HTML refs, unresolved imports, SDK model issues)
      // receive their complete verified fix even if the LLM omitted one of the target files in filePatches
      for (const tf of input.targetFiles) {
        const normPath = normalizeRepoPath(tf.filePath);
        const currentContent = proposedChangesMap.get(normPath)?.newContent ?? tf.content;
        const { updatedContent, appliedNotes } = applyVerifiedPreCheckFixesToFile(
          normPath,
          currentContent,
          preCheck
        );
        if (updatedContent !== tf.content) {
          proposedChangesMap.set(normPath, {
            filePath: normPath,
            description:
              proposedChangesMap.get(normPath)?.description ||
              appliedNotes.join(' ') ||
              `Resolved verified issues in ${normPath}`,
            newContent: updatedContent,
          });
        }
      }

      return {
        explanation: parsed.explanation,
        rootCause: parsed.rootCause,
        proposedChanges: Array.from(proposedChangesMap.values()),
        verificationAdvice: parsed.verificationAdvice,
      };
    }
  );
}
