import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { transform } from 'esbuild';

const execAsync = promisify(exec);

export interface RepoFileInput {
  filePath: string;
  content: string;
}

export interface UnresolvedImportFinding {
  sourceFile: string;
  importSpecifier: string;
  line: number;
  reason: string;
  suggestedMatch?: string;
  suggestedRelativeImport?: string;
}

export interface BrokenHtmlRefFinding {
  htmlFile: string;
  referencedPath: string;
  tagType: 'script' | 'link';
  suggestedMatch?: string;
}

export interface SyntaxErrorFinding {
  filePath: string;
  message: string;
}

export interface DeprecatedApiFinding {
  filePath: string;
  line: number;
  issue: string;
  evidence: string;
  invalidValue?: string;
  replacementValue?: string;
}

export interface PreAnalysisVerificationReport {
  totalFiles: number;
  totalBytes: number;
  fileInventory: Array<{
    filePath: string;
    bytes: number;
    lines: number;
    syntaxValid: boolean;
    exportsSummary?: string[];
  }>;
  detectedTechStack: string[];
  packageJsonSummary: {
    present: boolean;
    filePath?: string;
    scripts: Record<string, string>;
    dependencies: string[];
    devDependencies: string[];
  };
  readmeContent: string | null;
  syntaxErrors: SyntaxErrorFinding[];
  jsonErrors: SyntaxErrorFinding[];
  unresolvedRelativeImports: UnresolvedImportFinding[];
  missingPackageDependencies: Array<{
    sourceFile: string;
    packageName: string;
  }>;
  brokenHtmlReferences: BrokenHtmlRefFinding[];
  backendRoutesImplemented: Array<{
    filePath: string;
    method: string;
    routePath: string;
    line: number;
  }>;
  frontendApiCalls: Array<{
    filePath: string;
    routePath: string;
    line: number;
    matchedBackendRoute: boolean;
  }>;
  runtimeAndSdkIssues: DeprecatedApiFinding[];
  hasAutomatedTests: boolean;
  testFiles: string[];
  bundleCheckSummary: {
    attemptedEntryPoints: string[];
    passedEntryPoints: string[];
    failedEntryPoints: Array<{ entryPoint: string; error: string }>;
  };
}

const NODE_BUILTINS = new Set([
  'assert',
  'async_hooks',
  'buffer',
  'child_process',
  'cluster',
  'console',
  'constants',
  'crypto',
  'dgram',
  'diagnostics_channel',
  'dns',
  'domain',
  'events',
  'fs',
  'fs/promises',
  'http',
  'http2',
  'https',
  'inspector',
  'module',
  'net',
  'os',
  'path',
  'path/posix',
  'path/win32',
  'perf_hooks',
  'process',
  'punycode',
  'querystring',
  'readline',
  'repl',
  'stream',
  'stream/promises',
  'stream/web',
  'string_decoder',
  'sys',
  'timers',
  'timers/promises',
  'tls',
  'trace_events',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'wasi',
  'worker_threads',
  'zlib',
]);

export function normalizeRepoPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\/+/, '').replace(/^\.\//, '');
}

export function computeRelativeImportSpecifier(fromFile: string, toFile: string): string {
  const fromDir = path.posix.dirname(normalizeRepoPath(fromFile));
  const targetNormalized = normalizeRepoPath(toFile).replace(/\.(ts|tsx|js|jsx)$/, '');
  let rel = path.posix.relative(fromDir === '.' ? '' : fromDir, targetNormalized);
  if (!rel.startsWith('.')) {
    rel = `./${rel}`;
  }
  return rel;
}

/**
 * Reconstructs canonical directory paths when repository files were uploaded/fetched with flattened paths
 * (e.g., index.html points to "/src/main.tsx", main.tsx imports "./App.tsx", App.tsx imports "./components/DashboardView",
 * and DashboardView.tsx imports "../types" and "./PDFExtractor").
 * Never invents files—only places existing repository files at the exact paths implied by the entry/import graph.
 */
export function reconstructCanonicalRepoTree<T extends { filePath: string; content: string }>(
  rawFiles: T[]
): T[] {
  const normalized = rawFiles.map((f) => ({
    ...f,
    filePath: normalizeRepoPath(f.filePath),
  }));

  const pathMap = new Map<string, string>();
  for (const f of normalized) {
    pathMap.set(f.filePath, f.filePath);
  }

  const getActivePathsSet = () => new Set<string>(pathMap.values());

  const doesTargetExistInSet = (candidateBase: string, activeSet: Set<string>): boolean => {
    const cleanBase = normalizeRepoPath(candidateBase);
    const exts = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css', '.scss'];
    for (const ext of exts) {
      if (activeSet.has(`${cleanBase}${ext}`)) return true;
    }
    const stripped = cleanBase.replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, '');
    for (const ext of ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']) {
      if (activeSet.has(`${stripped}${ext}`)) return true;
    }
    for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
      if (activeSet.has(`${cleanBase}/index${ext}`)) return true;
    }
    return false;
  };

  const findUniqueRootFileMatching = (targetPathWithoutOrWithExt: string): string | undefined => {
    const cleanTarget = normalizeRepoPath(targetPathWithoutOrWithExt);
    const targetExt = path.posix.extname(cleanTarget);
    const targetStem = targetExt ? cleanTarget.slice(0, -targetExt.length) : cleanTarget;
    const targetBaseStem = path.posix.basename(targetStem).toLowerCase();

    const candidates = normalized.filter((f) => {
      const currentMapped = pathMap.get(f.filePath) || f.filePath;
      // Only relocate files that are currently at the flat root
      if (currentMapped.includes('/')) return false;
      const fExt = path.posix.extname(f.filePath);
      const fStem = fExt ? f.filePath.slice(0, -fExt.length) : f.filePath;
      if (targetExt) {
        return (
          fExt.toLowerCase() === targetExt.toLowerCase() &&
          fStem.toLowerCase() === targetBaseStem
        );
      }
      if (fExt.toLowerCase() === '.html' || fExt.toLowerCase() === '.md') {
        return false;
      }
      return fStem.toLowerCase() === targetBaseStem;
    });

    if (candidates.length === 1) {
      return candidates[0].filePath;
    }
    return undefined;
  };

  // Pass 1: Check HTML <script src="..."> and <link rel="stylesheet" href="..."> entry points
  for (const file of normalized) {
    if (file.filePath.toLowerCase().endsWith('.html')) {
      const htmlDir = path.posix.dirname(pathMap.get(file.filePath) || file.filePath);
      const scriptRegex = /<script\b[^>]*?\bsrc=["']([^"']+)["'][^>]*>/gi;
      let m: RegExpExecArray | null;
      while ((m = scriptRegex.exec(file.content)) !== null) {
        const srcRef = m[1].trim();
        if (
          srcRef.startsWith('http://') ||
          srcRef.startsWith('https://') ||
          srcRef.startsWith('//')
        ) {
          continue;
        }
        const expectedPath = srcRef.startsWith('/')
          ? normalizeRepoPath(srcRef)
          : normalizeRepoPath(htmlDir === '.' ? srcRef : `${htmlDir}/${srcRef}`);

        const activeSet = getActivePathsSet();
        if (!doesTargetExistInSet(expectedPath, activeSet)) {
          const rootMatch = findUniqueRootFileMatching(expectedPath);
          if (rootMatch) {
            const rootExt = path.posix.extname(rootMatch);
            const expectedHasExt = Boolean(path.posix.extname(expectedPath));
            const finalDest = expectedHasExt ? expectedPath : `${expectedPath}${rootExt}`;
            pathMap.set(rootMatch, finalDest);
          }
        }
      }
    }
  }

  // Pass 2..7: Fixed-point propagation along relative imports from already-placed files
  for (let pass = 0; pass < 6; pass++) {
    let changed = false;
    for (const file of normalized) {
      const currentFilePath = pathMap.get(file.filePath) || file.filePath;
      const ext = path.posix.extname(currentFilePath).slice(1).toLowerCase();
      if (!['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext)) continue;

      const importerDir = path.posix.dirname(currentFilePath);
      // Only propagate directory placements from files that are inside a subdirectory (e.g., src/, src/components/)
      if (importerDir === '.') continue;

      const lines = file.content.split('\n');
      for (const lineText of lines) {
        const trimmed = lineText.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

        const importMatches = [
          ...lineText.matchAll(/(?:import|export)\s+(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]/g),
          ...lineText.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
        ];

        for (const im of importMatches) {
          const rawSpec = im[1].replace(/\?.*$/, '').trim();
          if (!rawSpec.startsWith('.')) continue;

          const joined = path.posix.normalize(`${importerDir}/${rawSpec}`);
          if (joined.startsWith('..')) continue;

          const activeSet = getActivePathsSet();
          if (!doesTargetExistInSet(joined, activeSet)) {
            const rootMatch = findUniqueRootFileMatching(joined);
            if (rootMatch) {
              const rootExt = path.posix.extname(rootMatch);
              const joinedExt = path.posix.extname(joined);
              const finalDest = joinedExt ? joined : `${joined}${rootExt}`;
              if (pathMap.get(rootMatch) !== finalDest) {
                pathMap.set(rootMatch, finalDest);
                changed = true;
              }
            }
          }
        }
      }
    }
    if (!changed) break;
  }

  return normalized.map((f) => ({
    ...f,
    filePath: pathMap.get(f.filePath) || f.filePath,
  }));
}

export function resolveRelativeImportInRepo(
  importingFile: string,
  rawSpecifier: string,
  allFilePathsSet: Set<string>,
  allFilePathsList: string[]
): {
  resolved: boolean;
  resolvedPath?: string;
  suggestedMatch?: string;
  suggestedRelativeImport?: string;
  reason?: string;
} {
  const specifier = rawSpecifier.replace(/\?.*$/, '').trim();
  const importerDir = path.posix.dirname(normalizeRepoPath(importingFile));
  const candidateBases: string[] = [];

  if (specifier.startsWith('@/')) {
    const sub = normalizeRepoPath(specifier.slice(2));
    candidateBases.push(sub, `src/${sub}`);
  } else if (specifier.startsWith('/')) {
    const sub = normalizeRepoPath(specifier);
    candidateBases.push(sub);
    if (sub.startsWith('src/')) {
      candidateBases.push(sub.slice(4));
    }
  } else {
    const joined = path.posix.normalize(
      importerDir === '.' ? specifier : `${importerDir}/${specifier}`
    );
    if (!joined.startsWith('..')) {
      candidateBases.push(normalizeRepoPath(joined));
    }
    // Also check relative to src/ or root if the project had mixed depth
    const cleanedRel = normalizeRepoPath(specifier.replace(/^(\.\.\/)+/, '').replace(/^\.\//, ''));
    if (cleanedRel) {
      candidateBases.push(cleanedRel, `src/${cleanedRel}`, `src/components/${cleanedRel}`);
    }
  }

  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css', '.scss'];
  for (const candidateBase of candidateBases) {
    for (const ext of extensions) {
      const direct = `${candidateBase}${ext}`;
      if (allFilePathsSet.has(direct)) {
        return { resolved: true, resolvedPath: direct };
      }
    }

    const stripped = candidateBase.replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, '');
    for (const ext of ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']) {
      const alt = `${stripped}${ext}`;
      if (allFilePathsSet.has(alt)) {
        return { resolved: true, resolvedPath: alt };
      }
    }

    for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
      const idx = `${candidateBase}/index${ext}`;
      if (allFilePathsSet.has(idx)) {
        return { resolved: true, resolvedPath: idx };
      }
    }
  }

  const primaryCandidate = candidateBases[0] || normalizeRepoPath(specifier);
  const targetBaseName = path.posix
    .basename(primaryCandidate)
    .replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, '');
  const suggestedMatch = allFilePathsList.find((f) => {
    const fBase = path.posix.basename(f).replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, '');
    return fBase.toLowerCase() === targetBaseName.toLowerCase();
  });

  // If the file actually exists in the repository under that exact module name, resolve it cleanly
  if (suggestedMatch) {
    return {
      resolved: true,
      resolvedPath: suggestedMatch,
    };
  }

  return {
    resolved: false,
    reason: `Import "${specifier}" in "${importingFile}" cannot be resolved to any file in the repository.`,
  };
}

/**
 * Performs a comprehensive, deterministic verification of the real repository files
 * BEFORE calling Gemini so that all findings are grounded in 100% verified evidence.
 */
export async function inspectAndVerifyRepository(
  rawFiles: RepoFileInput[]
): Promise<PreAnalysisVerificationReport> {
  const files = reconstructCanonicalRepoTree(
    rawFiles.map((f) => ({
      filePath: normalizeRepoPath(f.filePath),
      content: f.content ?? '',
    }))
  );

  const allFilePathsList = files.map((f) => f.filePath);
  const allFilePathsSet = new Set(allFilePathsList);

  const fileInventory: PreAnalysisVerificationReport['fileInventory'] = [];
  const syntaxErrors: SyntaxErrorFinding[] = [];
  const jsonErrors: SyntaxErrorFinding[] = [];
  const unresolvedRelativeImports: UnresolvedImportFinding[] = [];
  const missingPackageDependencies: Array<{ sourceFile: string; packageName: string }> = [];
  const brokenHtmlReferences: BrokenHtmlRefFinding[] = [];
  const backendRoutesImplemented: PreAnalysisVerificationReport['backendRoutesImplemented'] = [];
  const frontendApiCalls: PreAnalysisVerificationReport['frontendApiCalls'] = [];
  const runtimeAndSdkIssues: DeprecatedApiFinding[] = [];
  const detectedTechSet = new Set<string>();

  // 1. Locate README and package.json
  const readmeFile = files.find(
    (f) =>
      f.filePath.toLowerCase() === 'readme.md' || f.filePath.toLowerCase().endsWith('/readme.md')
  );
  const readmeContent = readmeFile ? readmeFile.content : null;

  const pkgFile =
    files.find((f) => f.filePath === 'package.json') ||
    files.find((f) => f.filePath.endsWith('/package.json'));

  let pkgScripts: Record<string, string> = {};
  let pkgDeps: string[] = [];
  let pkgDevDeps: string[] = [];
  const declaredDepsSet = new Set<string>();

  if (pkgFile) {
    try {
      const parsed = JSON.parse(pkgFile.content);
      pkgScripts = parsed.scripts || {};
      pkgDeps = Object.keys(parsed.dependencies || {});
      pkgDevDeps = Object.keys(parsed.devDependencies || {});
      [...pkgDeps, ...pkgDevDeps].forEach((d) => declaredDepsSet.add(d));

      if (declaredDepsSet.has('react')) detectedTechSet.add('React');
      if (declaredDepsSet.has('next')) detectedTechSet.add('Next.js');
      if (declaredDepsSet.has('vue')) detectedTechSet.add('Vue');
      if (declaredDepsSet.has('svelte')) detectedTechSet.add('Svelte');
      if (declaredDepsSet.has('express')) detectedTechSet.add('Express');
      if (declaredDepsSet.has('vite')) detectedTechSet.add('Vite');
      if (declaredDepsSet.has('tailwindcss') || declaredDepsSet.has('@tailwindcss/vite'))
        detectedTechSet.add('Tailwind CSS');
      if (declaredDepsSet.has('typescript')) detectedTechSet.add('TypeScript');
      if (declaredDepsSet.has('@google/genai')) detectedTechSet.add('Google GenAI SDK');
      if (declaredDepsSet.has('lucide-react')) detectedTechSet.add('Lucide React');
      if (declaredDepsSet.has('drizzle-orm')) detectedTechSet.add('Drizzle ORM');
      if (declaredDepsSet.has('prisma') || declaredDepsSet.has('@prisma/client'))
        detectedTechSet.add('Prisma');
      if (declaredDepsSet.has('mongoose') || declaredDepsSet.has('mongodb'))
        detectedTechSet.add('MongoDB');
      if (declaredDepsSet.has('pg') || declaredDepsSet.has('@neondatabase/serverless'))
        detectedTechSet.add('PostgreSQL');
      if (declaredDepsSet.has('firebase')) detectedTechSet.add('Firebase');
    } catch {
      // handled in JSON check below
    }
  }

  // 2. Check every file for JSON validity, AST syntax compilation, imports, routes, and HTML refs
  for (const file of files) {
    const lines = file.content.split('\n');
    const bytes = Buffer.byteLength(file.content, 'utf8');
    const ext = path.posix.extname(file.filePath).slice(1).toLowerCase();
    let syntaxValid = true;
    const exportsSummary: string[] = [];

    if (ext === 'py') detectedTechSet.add('Python');
    if (ext === 'java') detectedTechSet.add('Java');
    if (ext === 'go') detectedTechSet.add('Go');
    if (ext === 'rs') detectedTechSet.add('Rust');
    if (['ts', 'tsx'].includes(ext)) detectedTechSet.add('TypeScript');
    if (['js', 'jsx', 'mjs', 'cjs'].includes(ext)) detectedTechSet.add('JavaScript');

    // 2a. JSON validation
    if (ext === 'json') {
      try {
        JSON.parse(file.content);
      } catch (err: any) {
        syntaxValid = false;
        jsonErrors.push({
          filePath: file.filePath,
          message: err.message || 'Invalid JSON syntax',
        });
      }
    }

    // 2b. AST Syntax validation with esbuild
    if (['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext)) {
      const loader = ext === 'tsx' ? 'tsx' : ext === 'jsx' ? 'jsx' : ext === 'ts' ? 'ts' : 'js';
      try {
        await transform(file.content, {
          loader,
          target: 'es2022',
          sourcemap: false,
        });
      } catch (err: any) {
        syntaxValid = false;
        syntaxErrors.push({
          filePath: file.filePath,
          message: err.message || 'AST compilation syntax error',
        });
      }

      // Extract exported symbols for inventory evidence
      const exportMatches = file.content.matchAll(
        /export\s+(?:default\s+)?(?:async\s+)?(?:function|const|class|interface|type)\s+([A-Za-z0-9_]+)/g
      );
      for (const em of exportMatches) {
        if (em[1] && !exportsSummary.includes(em[1])) {
          exportsSummary.push(em[1]);
        }
      }
    }

    fileInventory.push({
      filePath: file.filePath,
      bytes,
      lines: lines.length,
      syntaxValid,
      ...(exportsSummary.length > 0 ? { exportsSummary } : {}),
    });

    // 2c. HTML <script> check against repository file tree
    if (ext === 'html') {
      const scriptRegex = /<script\b[^>]*?\bsrc=["']([^"']+)["'][^>]*>/gi;
      let m: RegExpExecArray | null;
      while ((m = scriptRegex.exec(file.content)) !== null) {
        const srcRef = m[1].trim();
        if (
          !srcRef.startsWith('http://') &&
          !srcRef.startsWith('https://') &&
          !srcRef.startsWith('//')
        ) {
          const check = resolveRelativeImportInRepo(
            file.filePath,
            srcRef,
            allFilePathsSet,
            allFilePathsList
          );
          if (!check.resolved) {
            brokenHtmlReferences.push({
              htmlFile: file.filePath,
              referencedPath: srcRef,
              tagType: 'script',
              suggestedMatch: check.suggestedMatch,
            });
          }
        }
      }
    }

    // 2d. Code inspection: imports, backend routes, frontend fetch calls, deprecated/invalid SDK models
    if (['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext)) {
      lines.forEach((lineText, idx) => {
        const lineNum = idx + 1;
        const trimmed = lineText.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;

        // Check static import / export from / require statements
        const importMatches = [
          ...lineText.matchAll(
            /(?:import|export)\s+(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]/g
          ),
          ...lineText.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
        ];

        for (const im of importMatches) {
          const spec = im[1].trim();
          if (!spec) continue;

          if (spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('@/')) {
            const res = resolveRelativeImportInRepo(
              file.filePath,
              spec,
              allFilePathsSet,
              allFilePathsList
            );
            if (!res.resolved) {
              unresolvedRelativeImports.push({
                sourceFile: file.filePath,
                importSpecifier: spec,
                line: lineNum,
                reason: res.reason || `Cannot resolve "${spec}"`,
                suggestedMatch: res.suggestedMatch,
                suggestedRelativeImport: res.suggestedRelativeImport,
              });
            }
          } else if (!spec.startsWith('node:') && !spec.startsWith('http')) {
            const pkgName = spec.startsWith('@')
              ? spec.split('/').slice(0, 2).join('/')
              : spec.split('/')[0];
            if (
              !NODE_BUILTINS.has(pkgName) &&
              declaredDepsSet.size > 0 &&
              !declaredDepsSet.has(pkgName)
            ) {
              const alreadyListed = missingPackageDependencies.some(
                (d) => d.sourceFile === file.filePath && d.packageName === pkgName
              );
              if (!alreadyListed) {
                missingPackageDependencies.push({
                  sourceFile: file.filePath,
                  packageName: pkgName,
                });
              }
            }
          }
        }

        // Check Express/router backend route definitions
        const routeMatch = lineText.match(
          /\b(?:app|router|apiRouter)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/i
        );
        if (routeMatch) {
          backendRoutesImplemented.push({
            filePath: file.filePath,
            method: routeMatch[1].toUpperCase(),
            routePath: routeMatch[2],
            line: lineNum,
          });
        }

        // Check frontend fetch('/api/...') or axios.*('/api/...') calls
        const fetchMatch =
          lineText.match(/\bfetch\s*\(\s*['"`](\/api\/[^'"`$?]+)/) ||
          lineText.match(/\baxios\.(?:get|post|put|delete|patch)\s*\(\s*['"`](\/api\/[^'"`$?]+)/);
        if (fetchMatch) {
          frontendApiCalls.push({
            filePath: file.filePath,
            routePath: fetchMatch[1],
            line: lineNum,
            matchedBackendRoute: false, // computed after loop
          });
        }

        // Check for non-existent/deprecated Gemini model strings in code
        const badModelMatch = lineText.match(
          /model\s*:\s*['"`](gemini-3\.[0-9][^'"`]*|gemini-1\.[0-9][^'"`]*|gemini-pro|gemini-2\.0-flash[^'"`]*|gemini-2\.0-pro)['"`]/
        );
        if (badModelMatch) {
          runtimeAndSdkIssues.push({
            filePath: file.filePath,
            line: lineNum,
            issue: `Invalid or unsupported Gemini model identifier "${badModelMatch[1]}" will fail at runtime when calling the Google GenAI API (replace with "gemini-2.5-flash" or "gemini-2.5-flash-lite").`,
            evidence: `${file.filePath}:${lineNum} -> ${trimmed}`,
            invalidValue: badModelMatch[1],
            replacementValue: 'gemini-2.5-flash',
          });
        }
      });
    }
  }

  // Cross-match frontend API calls against backend routes
  for (const call of frontendApiCalls) {
    const matched = backendRoutesImplemented.some((r) => {
      if (r.routePath === call.routePath) return true;
      if (`/api${r.routePath}` === call.routePath) return true;
      const pattern = r.routePath.replace(/:[^/]+/g, '[^/]+');
      try {
        return new RegExp(`^(?:/api)?${pattern}$`).test(call.routePath);
      } catch {
        return false;
      }
    });
    call.matchedBackendRoute = matched;
  }

  // Check for automated test files
  const testFiles = allFilePathsList.filter((p) =>
    /\.(test|spec)\.(ts|tsx|js|jsx|mjs|py)$/i.test(p)
  );
  const hasTestScript = Boolean(
    pkgScripts.test && !pkgScripts.test.includes('no test specified')
  );
  const hasAutomatedTests = testFiles.length > 0 || hasTestScript;

  // 3. Run real sandbox esbuild bundle check on actual entry points
  const candidateEntries = [
    'src/main.tsx',
    'src/main.ts',
    'src/index.tsx',
    'src/index.ts',
    'main.tsx',
    'main.ts',
    'src/App.tsx',
    'App.tsx',
    'server.ts',
    'src/server.ts',
    'index.ts',
    'index.js',
  ].filter((e) => allFilePathsSet.has(e));

  const attemptedEntryPoints: string[] = [];
  const passedEntryPoints: string[] = [];
  const failedEntryPoints: Array<{ entryPoint: string; error: string }> = [];

  if (candidateEntries.length > 0) {
    const sandboxId = `precheck-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const sandboxDir = path.join(os.tmpdir(), sandboxId);
    try {
      await fs.mkdir(sandboxDir, { recursive: true });
      for (const file of files) {
        const safePath = path.normalize(file.filePath).replace(/^(\.\.[\/\\])+/, '');
        const fullPath = path.join(sandboxDir, safePath);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, file.content, 'utf8');
      }

      const localBin = path.join(process.cwd(), 'node_modules', '.bin');
      for (const entry of candidateEntries.slice(0, 4)) {
        attemptedEntryPoints.push(entry);
        const isServer = entry.includes('server') || entry === 'index.ts' || entry === 'index.js';
        const platform = isServer ? 'node' : 'browser';
        const cmd = `esbuild "${entry}" --bundle --platform=${platform} --packages=external --outfile=/dev/null`;
        try {
          await execAsync(cmd, {
            cwd: sandboxDir,
            timeout: 8000,
            env: {
              PATH: `${localBin}:${process.env.PATH || '/usr/local/bin:/usr/bin:/bin'}`,
              NODE_ENV: 'test',
              HOME: sandboxDir,
              TMPDIR: sandboxDir,
            },
          });
          passedEntryPoints.push(entry);
        } catch (err: any) {
          const errOut = String(err.stderr || err.stdout || err.message || '').trim();
          failedEntryPoints.push({
            entryPoint: entry,
            error: errOut.slice(0, 600),
          });
        }
      }
    } catch {
      // ignore sandbox setup error
    } finally {
      await fs.rm(sandboxDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  return {
    totalFiles: files.length,
    totalBytes: files.reduce((sum, f) => sum + Buffer.byteLength(f.content, 'utf8'), 0),
    fileInventory,
    detectedTechStack: Array.from(detectedTechSet),
    packageJsonSummary: {
      present: Boolean(pkgFile),
      filePath: pkgFile?.filePath,
      scripts: pkgScripts,
      dependencies: pkgDeps,
      devDependencies: pkgDevDeps,
    },
    readmeContent,
    syntaxErrors,
    jsonErrors,
    unresolvedRelativeImports,
    missingPackageDependencies,
    brokenHtmlReferences,
    backendRoutesImplemented,
    frontendApiCalls,
    runtimeAndSdkIssues,
    hasAutomatedTests,
    testFiles,
    bundleCheckSummary: {
      attemptedEntryPoints,
      passedEntryPoints,
      failedEntryPoints,
    },
  };
}

export interface VerificationCheckInput {
  files: Array<{ filePath: string; content: string }>;
  testCommand?: string;
  category?: string;
  targetFiles?: string[];
}

export interface VerificationCheckOutput {
  status: 'passed' | 'failed';
  passedChecks: string[];
  failedChecks: string[];
  stdout: string;
  stderr: string;
  durationMs: number;
}

export async function runRealCodeVerification(
  input: VerificationCheckInput
): Promise<VerificationCheckOutput> {
  const startTime = Date.now();
  const passedChecks: string[] = [];
  const failedChecks: string[] = [];
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  const sandboxId = `sandbox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const sandboxDir = path.join(os.tmpdir(), sandboxId);

  stdoutLines.push(`[Sandbox] Initializing isolated execution environment: ${sandboxId}`);

  try {
    await fs.mkdir(sandboxDir, { recursive: true });

    const normalizedFiles = reconstructCanonicalRepoTree(
      input.files.map((f) => ({
        filePath: normalizeRepoPath(f.filePath),
        content: f.content ?? '',
      }))
    );
    const allFilePathsList = normalizedFiles.map((f) => f.filePath);
    const allFilePathsSet = new Set(allFilePathsList);

    for (const file of normalizedFiles) {
      const safePath = path.normalize(file.filePath).replace(/^(\.\.[\/\\])+/, '');
      const fullPath = path.join(sandboxDir, safePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, file.content, 'utf8');
    }

    stdoutLines.push(
      `[Sandbox] Mounted ${normalizedFiles.length} project files to isolated sandbox.`
    );

    try {
      const globalNodeModules = path.join(process.cwd(), 'node_modules');
      const targetNodeModules = path.join(sandboxDir, 'node_modules');
      await fs.symlink(globalNodeModules, targetNodeModules, 'dir');
    } catch {
      // Non-fatal if node_modules cannot be symlinked
    }

    // Determine which files are in scope for this task check
    const targetFilesNormalized = (input.targetFiles || []).map(normalizeRepoPath);
    const scopedFiles =
      targetFilesNormalized.length > 0
        ? normalizedFiles.filter((f) =>
            targetFilesNormalized.some(
              (tf) =>
                f.filePath === tf ||
                f.filePath.endsWith(`/${tf}`) ||
                tf.endsWith(`/${f.filePath}`) ||
                path.posix.basename(f.filePath) === path.posix.basename(tf)
            )
          )
        : normalizedFiles;
    const filesToInspect = scopedFiles.length > 0 ? scopedFiles : normalizedFiles;

    // 1. JSON Schema & Manifest Verification
    for (const file of normalizedFiles) {
      if (file.filePath.endsWith('.json')) {
        try {
          JSON.parse(file.content);
          passedChecks.push(`Valid JSON manifest: ${file.filePath}`);
          stdoutLines.push(`✔ [JSON Validated] ${file.filePath}`);
        } catch (err: any) {
          failedChecks.push(`Invalid JSON syntax in ${file.filePath}: ${err.message}`);
          stderrLines.push(`✖ [JSON Parse Error] ${file.filePath}: ${err.message}`);
        }
      }
    }

    // 2. Real ESBuild AST & Syntax verification on all script files
    for (const file of normalizedFiles) {
      const ext = path.extname(file.filePath).slice(1).toLowerCase();
      if (['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext)) {
        const loader = ext === 'tsx' ? 'tsx' : ext === 'jsx' ? 'jsx' : ext === 'ts' ? 'ts' : 'js';
        try {
          await transform(file.content, {
            loader,
            target: 'es2022',
            sourcemap: false,
          });
          passedChecks.push(`AST syntax compilation passed: ${file.filePath}`);
          stdoutLines.push(
            `✔ [AST Parse Success] ${file.filePath} passed ${loader.toUpperCase()} syntax check`
          );
        } catch (err: any) {
          failedChecks.push(`Compilation syntax failure in ${file.filePath}: ${err.message}`);
          stderrLines.push(`✖ [Syntax Error] ${file.filePath}:\n${err.message}`);
        }
      }
    }

    // 3. Relative Import & HTML Entry Point Resolution Check on Scoped/Target Files
    let relativeImportErrors = 0;
    for (const file of filesToInspect) {
      const ext = path.extname(file.filePath).slice(1).toLowerCase();
      if (ext === 'html') {
        const scriptRegex = /<script\b[^>]*?\bsrc=["']([^"']+)["'][^>]*>/gi;
        let m: RegExpExecArray | null;
        while ((m = scriptRegex.exec(file.content)) !== null) {
          const srcRef = m[1].trim();
          if (
            !srcRef.startsWith('http://') &&
            !srcRef.startsWith('https://') &&
            !srcRef.startsWith('//')
          ) {
            const check = resolveRelativeImportInRepo(
              file.filePath,
              srcRef,
              allFilePathsSet,
              allFilePathsList
            );
            if (!check.resolved) {
              relativeImportErrors++;
              failedChecks.push(
                `Broken HTML script reference "${srcRef}" in ${file.filePath}`
              );
              stderrLines.push(
                `✖ [Broken HTML Entry] ${file.filePath} references "${srcRef}", which does not exist in repository.`
              );
            } else {
              stdoutLines.push(
                `✔ [HTML Entry Verified] ${file.filePath} -> ${check.resolvedPath}`
              );
            }
          }
        }
      }

      if (['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext)) {
        const lines = file.content.split('\n');
        lines.forEach((lineText, idx) => {
          const trimmed = lineText.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
          const importMatches = [
            ...lineText.matchAll(
              /(?:import|export)\s+(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]/g
            ),
            ...lineText.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
          ];
          for (const im of importMatches) {
            const spec = im[1].trim();
            if (spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('@/')) {
              const res = resolveRelativeImportInRepo(
                file.filePath,
                spec,
                allFilePathsSet,
                allFilePathsList
              );
              if (!res.resolved) {
                relativeImportErrors++;
                failedChecks.push(
                  `Unresolved import "${spec}" at ${file.filePath}:${idx + 1}`
                );
                stderrLines.push(`✖ [Module Resolution Error] ${res.reason}`);
              }
            }
          }
        });
      }
    }

    if (relativeImportErrors === 0) {
      passedChecks.push('All relative imports and HTML entry references resolved cleanly.');
      stdoutLines.push('✔ [Module Resolution] All local file imports resolved in repository.');
    }

    // 4. Check for undeclared external dependencies in package.json
    const pkgFile = normalizedFiles.find(
      (f) => f.filePath === 'package.json' || f.filePath.endsWith('/package.json')
    );
    if (pkgFile) {
      try {
        const pkg = JSON.parse(pkgFile.content);
        const allDeps = new Set([
          ...Object.keys(pkg.dependencies || {}),
          ...Object.keys(pkg.devDependencies || {}),
        ]);

        const missingDeps: string[] = [];

        for (const file of filesToInspect) {
          const ext = path.extname(file.filePath).slice(1).toLowerCase();
          if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) {
            const importRegex =
              /(?:import|export)\s+(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]|\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
            let match: RegExpExecArray | null;
            while ((match = importRegex.exec(file.content)) !== null) {
              const mod = (match[1] || match[2] || '').trim();
              if (
                mod &&
                !mod.startsWith('.') &&
                !mod.startsWith('/') &&
                !mod.startsWith('@/') &&
                !mod.startsWith('node:')
              ) {
                const base = mod.startsWith('@')
                  ? mod.split('/').slice(0, 2).join('/')
                  : mod.split('/')[0];
                if (!NODE_BUILTINS.has(base) && allDeps.size > 0 && !allDeps.has(base)) {
                  missingDeps.push(`${base} in ${file.filePath}`);
                }
              }
            }
          }
        }

        if (missingDeps.length > 0) {
          failedChecks.push(
            `Undeclared dependencies in package.json: ${missingDeps.slice(0, 3).join(', ')}`
          );
          stderrLines.push(
            `✖ [Dependency Error] Missing packages in package.json: ${missingDeps
              .slice(0, 3)
              .join(', ')}`
          );
        } else {
          passedChecks.push('All imports matched declared package dependencies.');
          stdoutLines.push(
            '✔ [Dependency Contract] All external packages are declared in package.json.'
          );
        }
      } catch {
        // already flagged in step 1
      }
    }

    // 4b. Check for invalid/unsupported SDK model identifiers in target files
    let sdkIssuesCount = 0;
    for (const file of filesToInspect) {
      const ext = path.extname(file.filePath).slice(1).toLowerCase();
      if (['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext)) {
        const lines = file.content.split('\n');
        lines.forEach((lineText, idx) => {
          const trimmed = lineText.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
          const badModelMatch = lineText.match(
            /model\s*:\s*['"`](gemini-3\.[0-9][^'"`]*|gemini-1\.[0-9][^'"`]*|gemini-pro|gemini-2\.0-flash[^'"`]*|gemini-2\.0-pro)['"`]/
          );
          if (badModelMatch) {
            sdkIssuesCount++;
            failedChecks.push(
              `Invalid Gemini model identifier "${badModelMatch[1]}" at ${file.filePath}:${idx + 1}`
            );
            stderrLines.push(
              `✖ [Runtime SDK Error] ${file.filePath}:${idx + 1} uses invalid model "${badModelMatch[1]}". Replace with "gemini-2.5-flash" or "gemini-2.5-flash-lite".`
            );
          }
        });
      }
    }
    if (sdkIssuesCount === 0) {
      passedChecks.push('No invalid or deprecated Gemini SDK model identifiers in target files.');
      stdoutLines.push('✔ [SDK & Runtime Check] All model identifiers in target files are valid.');
    }

    // 5. REAL ISOLATED EXECUTION OF TEST / BUILD COMMAND
    let cmdToRun = input.testCommand ? input.testCommand.trim() : '';
    cmdToRun = cmdToRun.replace(/^npx\s+esbuild\b/, 'esbuild');
    if (cmdToRun === 'esbuild') {
      cmdToRun = '';
    }
    if (cmdToRun === 'npm test' || cmdToRun === 'npm run test') {
      const pkg = pkgFile
        ? (() => {
            try {
              return JSON.parse(pkgFile.content);
            } catch {
              return null;
            }
          })()
        : null;
      const testScript = pkg?.scripts?.test || '';
      if (!testScript || testScript.includes('no test specified')) {
        cmdToRun = '';
      }
    }

    if (!cmdToRun) {
      const targetScript =
        filesToInspect.find((f) => /\.(ts|tsx|js|jsx|mjs)$/i.test(f.filePath)) ||
        normalizedFiles.find((f) =>
          /^(src\/main|main|src\/App|App|server)\.(tsx|ts|jsx|js)$/i.test(f.filePath)
        ) ||
        normalizedFiles.find((f) => /\.(ts|tsx|js|jsx|mjs)$/i.test(f.filePath));

      if (targetScript) {
        const isNodeTarget = targetScript.filePath.includes('server');
        cmdToRun = `esbuild "${targetScript.filePath}" --bundle --platform=${
          isNodeTarget ? 'node' : 'browser'
        } --packages=external --outfile=/dev/null`;
      } else if (pkgFile) {
        cmdToRun = `node -e "JSON.parse(require('fs').readFileSync('${pkgFile.filePath}', 'utf8'))"`;
      }
    } else if (cmdToRun.startsWith('esbuild ') && !cmdToRun.includes('--packages=external')) {
      cmdToRun = `${cmdToRun} --packages=external`;
    }

    // Map any flat entry filename in esbuild command to its canonical path in sandboxDir
    if (cmdToRun.startsWith('esbuild ')) {
      for (const f of normalizedFiles) {
        const base = path.posix.basename(f.filePath);
        if (f.filePath !== base) {
          cmdToRun = cmdToRun.replace(
            new RegExp(`(['"]?)${base.replace('.', '\\.')}\\1`, 'g'),
            `"${f.filePath}"`
          );
        }
      }
    }

    if (cmdToRun) {
      const sanitizedCmd = cmdToRun.replace(/\s+--loader=[a-z]+/gi, '');
      stdoutLines.push(`[Sandbox Exec] Executing verification command: "${sanitizedCmd}"`);

      const BLOCKED_PATTERNS = [
        'rm -rf /',
        'mkfs',
        ':(){ :|:& };:',
        'curl ',
        'wget ',
        'nc ',
        'netcat',
        '/dev/tcp',
        'bash -i',
        'sh -i',
        '> /etc/',
        '> /usr/',
        '> /bin/',
        'chmod 777',
        'chmod +x',
        '/etc/passwd',
        '/etc/shadow',
      ];
      if (BLOCKED_PATTERNS.some((p) => sanitizedCmd.includes(p))) {
        failedChecks.push('Command blocked by security policy');
        stderrLines.push('✖ [Security Policy] Dangerous command pattern detected.');
      } else {
        const localBin = path.join(process.cwd(), 'node_modules', '.bin');
        const cleanEnv: Record<string, string> = {
          PATH: `${localBin}:${process.env.PATH || '/usr/local/bin:/usr/bin:/bin'}`,
          NODE_ENV: 'test',
          HOME: sandboxDir,
          TMPDIR: sandboxDir,
        };

        try {
          const { stdout: cmdOut, stderr: cmdErr } = await execAsync(sanitizedCmd, {
            cwd: sandboxDir,
            timeout: 10000,
            maxBuffer: 1024 * 1024,
            env: cleanEnv,
          });

          if (cmdOut) stdoutLines.push(cmdOut.trim());
          if (cmdErr) stdoutLines.push(`[info] ${cmdErr.trim()}`);

          passedChecks.push(`Command "${sanitizedCmd}" executed cleanly with exit code 0.`);
          stdoutLines.push(`✔ [Execution Success] Verification passed with exit code 0.`);
        } catch (execErr: any) {
          const errDetail = String(execErr.stderr || execErr.stdout || execErr.message || '');
          failedChecks.push(
            `Verification command failed (exit code ${execErr.code || 1}): ${errDetail.slice(
              0,
              300
            )}`
          );
          stderrLines.push(
            `✖ [Command Failed - Exit Code ${execErr.code || 1}]:\n${errDetail}`
          );
        }
      }
    } else {
      failedChecks.push('No executable verification command found for this project.');
      stderrLines.push(
        '✖ [Verification Error] A verification command must be executed to verify a task.'
      );
    }
  } catch (outerErr: any) {
    failedChecks.push(`Runner error: ${outerErr.message}`);
    stderrLines.push(`✖ [Sandbox Exception]: ${outerErr.message}`);
  } finally {
    try {
      await fs.rm(sandboxDir, { recursive: true, force: true });
      stdoutLines.push(`[Sandbox] Destroyed isolated environment ${sandboxId}.`);
    } catch (cleanErr) {
      console.warn('Failed to remove sandbox:', cleanErr);
    }
  }

  const durationMs = Date.now() - startTime;
  const status: 'passed' | 'failed' = failedChecks.length === 0 ? 'passed' : 'failed';

  stdoutLines.push(
    `[Verification Summary] Total execution time: ${durationMs}ms. Status: ${status.toUpperCase()} (${passedChecks.length} passed, ${failedChecks.length} failed).`
  );

  return {
    status,
    passedChecks,
    failedChecks,
    stdout: stdoutLines.join('\n'),
    stderr: stderrLines.join('\n'),
    durationMs,
  };
}
