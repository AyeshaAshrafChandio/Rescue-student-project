import { GoogleGenAI, Type } from '@google/genai';

// Initialize Gemini SDK on the server side
export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build-student-rescue',
    },
  },
});

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
  featuresBroken: Array<{ title: string; severity: 'critical' | 'high' | 'medium'; fileEvidence: string; errorExplanation: string; rootCause: string }>;
  featuresMissing: Array<{ title: string; priority: 'critical' | 'high' | 'medium'; requirementReference: string; whyMissing: string }>;
  featuresUnverifiable: Array<{ title: string; reason: string; suggestedVerification: string }>;
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

export async function analyzeCodebaseWithGemini(input: AnalyzeProjectInput): Promise<AnalysisResult> {
  const fileSummaries = input.files
    .slice(0, 30)
    .map(f => `--- FILE: ${f.filePath} (${f.content.length} chars) ---\n${f.content.slice(0, 3500)}`)
    .join('\n\n');

  const prompt = `You are the lead architect and automated debugger for Student Project Rescue.
Analyze this REAL student project codebase against the student's requirements.

PROJECT TITLE:
${input.title}

STUDENT REQUIREMENTS / SPECIFICATION:
${input.requirements || 'No specific requirements given. Deduce intended functionality from code structure, package.json, and missing implementations.'}

ACTUAL CODE FILES (${input.files.length} total files):
${fileSummaries}

TASK:
1. Detect real tech stack, framework, language, dependencies.
2. Analyze what is DONE (features implemented and working with file evidence).
3. Analyze what is BROKEN (syntax issues, broken imports, unhandled exceptions, missing env vars, broken routes).
4. Analyze what is MISSING (requirements not yet implemented or empty placeholders/stubs).
5. Analyze what is UNVERIFIABLE (features with no tests or missing fixtures).
6. Calculate an honest health score between 0 and 100 based on actual code completeness, syntax validity, and feature coverage.
7. Generate a step-by-step, prioritized Rescue Plan with actionable tasks to get this project submission-ready before the deadline. Order the tasks from highest priority/blockers to lowest.
For each task, provide an executable testCommand (e.g. "npx esbuild target.ts", "node -c target.js", "npm test", etc.) that verifies the fix.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
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
              required: ['title', 'severity', 'fileEvidence', 'errorExplanation', 'rootCause'],
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
              required: ['order', 'title', 'category', 'priority', 'targetFiles', 'estimatedMinutes', 'description', 'testCommand'],
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
  });

  const text = response.text || '{}';
  return JSON.parse(text) as AnalysisResult;
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

export async function diagnoseAndProposeCodeFix(input: WorkspaceTaskInput): Promise<WorkspaceResponse> {
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
${input.userMessage || 'Please analyze this task, diagnose the root cause, and write the complete corrected code for the target files.'}

TARGET CODE FILES:
${filesContext}

INSTRUCTIONS:
1. Provide a clear technical breakdown explaining why it failed or what is missing.
2. Identify the exact root cause.
3. For each file that needs modifications or creation, return the COMPLETE, PRISTINE updated content of that file so it can be safely reviewed and applied.
4. Provide verification advice (e.g. how the student or the verification runner can confirm the fix).`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
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
  });

  const text = response.text || '{}';
  return JSON.parse(text) as WorkspaceResponse;
}
