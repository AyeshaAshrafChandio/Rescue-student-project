import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

// Initialize Gemini SDK on the server side
export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

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
  return new Promise(resolve => setTimeout(resolve, ms));
}

const CANDIDATE_FLASH_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
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
  baseDelayMs = 1500
): Promise<T> {
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const model = CANDIDATE_FLASH_MODELS[(attempt - 1) % CANDIDATE_FLASH_MODELS.length];
    try {
      const req = buildRequest(model);
      const thinkingLevel =
        model === 'gemini-3.1-flash-lite' ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW;

      const response = await ai.models.generateContent({
        model: req.model,
        contents: req.contents,
        config: {
          ...req.config,
          thinkingConfig: { thinkingLevel },
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

      // Exponential backoff with random jitter: 1.5s, 3s, 6s (+ 0..600ms jitter)
      const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.floor(Math.random() * 600);
      const waitMs = Math.min(12000, exponentialDelay + jitter);

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

export async function analyzeCodebaseWithGemini(
  input: AnalyzeProjectInput
): Promise<AnalysisResult> {
  const fileSummaries = input.files
    .slice(0, 25)
    .map(
      f =>
        `--- FILE: ${f.filePath} (${f.content.length} chars) ---\n${f.content.slice(0, 3000)}`
    )
    .join('\n\n');

  const prompt = `You are the lead architect and automated debugger for Student Project Rescue.
Analyze this REAL student project codebase against the student's requirements.

PROJECT TITLE:
${input.title}

STUDENT REQUIREMENTS / SPECIFICATION:
${
  input.requirements ||
  'No specific requirements given. Deduce intended functionality from code structure, package.json, and missing implementations.'
}

ACTUAL CODE FILES (${input.files.length} total files):
${fileSummaries}

TASK:
1. Detect real tech stack, framework, language, dependencies.
2. Analyze what is DONE (features implemented and working with file evidence).
3. Analyze what is BROKEN (syntax issues, broken imports, unhandled exceptions, missing env vars, broken routes).
4. Analyze what is MISSING (requirements not yet implemented or empty placeholders/stubs).
5. Analyze what is UNVERIFIABLE (features with no tests or missing fixtures).
6. Calculate an honest health score between 15 and 95 based on actual code completeness, syntax validity, and feature coverage (never return 0 when source files are provided).
7. Generate a step-by-step, prioritized Rescue Plan with actionable tasks to get this project submission-ready before the deadline. Order the tasks from highest priority/blockers to lowest.
For each task, provide an executable testCommand that only references files actually present in the project using "esbuild <targetFile> --bundle --platform=node --packages=external --outfile=/dev/null" (for TypeScript/React) or "node --check <targetFile>" (for JavaScript). Do not reference jest, vitest, or test files that do not exist in the uploaded file list.`;

  return callGeminiWithExponentialBackoff<AnalysisResult>(
    'Codebase Analysis',
    model => ({
      model,
      contents: prompt,
      config: {
        temperature: 0.2,
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
    rawText => {
      const parsed = JSON.parse(rawText) as AnalysisResult;
      if (
        !parsed ||
        typeof parsed.overallSummary !== 'string' ||
        !parsed.overallSummary.trim() ||
        !Array.isArray(parsed.rescuePlanTasks)
      ) {
        throw new Error('Invalid or incomplete analysis JSON returned by Gemini.');
      }

      // Ensure healthScore is a realistic non-zero integer between 10 and 100 for real codebases
      const rawScore = Number(parsed.healthScore);
      const safeScore = Number.isFinite(rawScore) && rawScore > 0
        ? Math.min(100, Math.max(10, Math.round(rawScore)))
        : 35;

      return {
        ...parsed,
        healthScore: safeScore,
        featuresDone: Array.isArray(parsed.featuresDone) ? parsed.featuresDone : [],
        featuresBroken: Array.isArray(parsed.featuresBroken) ? parsed.featuresBroken : [],
        featuresMissing: Array.isArray(parsed.featuresMissing) ? parsed.featuresMissing : [],
        featuresUnverifiable: Array.isArray(parsed.featuresUnverifiable)
          ? parsed.featuresUnverifiable
          : [],
      };
    }
  );
}

export interface WorkspaceTaskInput {
  taskTitle: string;
  taskDescription: string;
  category: string;
  userMessage?: string;
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

export async function diagnoseAndProposeCodeFix(
  input: WorkspaceTaskInput
): Promise<WorkspaceResponse> {
  const filesContext = input.targetFiles
    .map(f => `--- FILE: ${f.filePath} ---\n${f.content}`)
    .join('\n\n');

  const prompt = `You are the Automated Code Debugger and Software Engineer for Student Project Rescue powered by Google Gemini.
Your role is to diagnose real root causes from user code files, verify against student requirements and failed verification errors, and propose complete, functional replacement code.

TASK:
Title: ${input.taskTitle}
Description: ${input.taskDescription}
Category: ${input.category}

PREVIOUS VERIFICATION RESULT / ERRORS (if any):
${input.previousVerificationOutput || 'None yet.'}

STUDENT'S INQUIRY / INSTRUCTION:
${
  input.userMessage ||
  'Please analyze this task, diagnose the root cause, and write the complete corrected code for the target files.'
}

TARGET CODE FILES:
${filesContext}

INSTRUCTIONS:
1. Provide a clear technical breakdown explaining why it failed or what is missing.
2. Identify the exact root cause.
3. For each file that needs modifications or creation, return the COMPLETE, PRISTINE updated content of that file so it can be safely reviewed and applied.
4. Provide verification advice (e.g. how the student or the verification runner can confirm the fix).`;

  return callGeminiWithExponentialBackoff<WorkspaceResponse>(
    'Workspace Code Fix Diagnosis',
    model => ({
      model,
      contents: prompt,
      config: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            explanation: { type: Type.STRING },
            rootCause: { type: Type.STRING },
            proposedChanges: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  filePath: { type: Type.STRING },
                  description: { type: Type.STRING },
                  newContent: { type: Type.STRING },
                },
                required: ['filePath', 'description', 'newContent'],
              },
            },
            verificationAdvice: { type: Type.STRING },
          },
          required: ['explanation', 'rootCause', 'proposedChanges', 'verificationAdvice'],
        },
      },
    }),
    rawText => {
      const parsed = JSON.parse(rawText) as WorkspaceResponse;
      if (
        !parsed ||
        typeof parsed.explanation !== 'string' ||
        !Array.isArray(parsed.proposedChanges)
      ) {
        throw new Error('Invalid or incomplete diagnosis response from Gemini.');
      }
      return parsed;
    }
  );
}
