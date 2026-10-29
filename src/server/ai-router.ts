import {
  analyzeCodebaseWithGemini,
  diagnoseAndProposeCodeFix,
  type AnalysisResult,
  type AnalyzeProjectInput,
  type WorkspaceTaskInput,
  type WorkspaceResponse,
} from './gemini.ts';
import {
  analyzeCodebaseWithNebius,
  diagnoseAndProposeCodeFixWithNebius,
  checkNebiusStatus,
  NEBIUS_DEFAULT_MODEL,
  type NebiusTokenUsage,
} from './nebius.ts';

export type SupportedAiProvider = 'gemini' | 'nebius';

export interface ProviderStatusSummary {
  id: SupportedAiProvider;
  name: string;
  model: string;
  configured: boolean;
  active: boolean;
  badge: string;
  description: string;
}

export function getAvailableAiProviders(): {
  defaultProvider: SupportedAiProvider;
  providers: ProviderStatusSummary[];
} {
  const isGeminiConfigured = Boolean(process.env.GEMINI_API_KEY?.trim());
  const nebiusStatus = checkNebiusStatus();

  const providers: ProviderStatusSummary[] = [
    {
      id: 'nebius',
      name: 'NVIDIA Nemotron (Nebius Token Factory)',
      model: nebiusStatus.model || NEBIUS_DEFAULT_MODEL,
      configured: nebiusStatus.configured,
      active: nebiusStatus.active,
      badge: 'NVIDIA Nemotron-3-Nano',
      description:
        'Official Nebius Token Factory inference with NVIDIA Nemotron-3-Nano-30B-A3B for codebase analysis & precise code repair.',
    },
    {
      id: 'gemini',
      name: 'Google Gemini',
      model: 'gemini-flash-latest',
      configured: isGeminiConfigured,
      active: isGeminiConfigured,
      badge: 'Gemini Flash',
      description:
        'Google Gemini Flash model for static AST verification, project triage, and code repairs.',
    },
  ];

  // If Nebius has an API key configured, prefer Nebius for Hackathon compliance, otherwise fallback to Gemini
  const defaultProvider: SupportedAiProvider = nebiusStatus.configured ? 'nebius' : 'gemini';

  return {
    defaultProvider,
    providers,
  };
}

export async function runUnifiedCodebaseAnalysis(params: {
  provider: SupportedAiProvider;
  title: string;
  requirements: string;
  files: Array<{ filePath: string; content: string }>;
}): Promise<{
  analysis: AnalysisResult;
  aiProvider: SupportedAiProvider;
  modelUsed: string;
  tokenUsage?: NebiusTokenUsage;
}> {
  const { provider, title, requirements, files } = params;

  if (provider === 'nebius') {
    const nebiusStatus = checkNebiusStatus();
    console.log(`[AI Dispatcher] Routing codebase analysis to NVIDIA Nemotron via Nebius Token Factory (${nebiusStatus.model})`);
    const analysis = await analyzeCodebaseWithNebius({ title, requirements, files });
    return {
      analysis,
      aiProvider: 'nebius',
      modelUsed: nebiusStatus.model,
      tokenUsage: analysis.tokenUsage,
    };
  }

  // Default to Gemini
  console.log('[AI Dispatcher] Routing codebase analysis to Google Gemini (gemini-flash-latest)');
  const analysis = await analyzeCodebaseWithGemini({ title, requirements, files });
  return {
    analysis,
    aiProvider: 'gemini',
    modelUsed: 'gemini-flash-latest',
  };
}

export async function runUnifiedTaskDiagnosis(params: {
  provider: SupportedAiProvider;
  taskInput: WorkspaceTaskInput;
}): Promise<{
  solution: WorkspaceResponse;
  aiProvider: SupportedAiProvider;
  modelUsed: string;
  tokenUsage?: NebiusTokenUsage;
}> {
  const { provider, taskInput } = params;

  if (provider === 'nebius') {
    const nebiusStatus = checkNebiusStatus();
    console.log(
      `[AI Dispatcher] Routing task diagnosis to NVIDIA Nemotron via Nebius Token Factory (${nebiusStatus.model})`
    );
    const solution = await diagnoseAndProposeCodeFixWithNebius(taskInput);
    return {
      solution,
      aiProvider: 'nebius',
      modelUsed: nebiusStatus.model,
      tokenUsage: solution.tokenUsage,
    };
  }

  // Default to Gemini
  console.log('[AI Dispatcher] Routing task diagnosis to Google Gemini (gemini-flash-latest)');
  const solution = await diagnoseAndProposeCodeFix(taskInput);
  return {
    solution,
    aiProvider: 'gemini',
    modelUsed: 'gemini-flash-latest',
  };
}
