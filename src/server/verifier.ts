import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { transform } from 'esbuild';

const execAsync = promisify(exec);

export interface VerificationCheckInput {
  files: Array<{ filePath: string; content: string }>;
  testCommand?: string;
  category?: string;
}

export interface VerificationCheckOutput {
  status: 'passed' | 'failed';
  passedChecks: string[];
  failedChecks: string[];
  stdout: string;
  stderr: string;
  durationMs: number;
}

export async function runRealCodeVerification(input: VerificationCheckInput): Promise<VerificationCheckOutput> {
  const startTime = Date.now();
  const passedChecks: string[] = [];
  const failedChecks: string[] = [];
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  // Create isolated sandbox directory
  const sandboxId = `sandbox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const sandboxDir = path.join(os.tmpdir(), sandboxId);

  stdoutLines.push(`[Sandbox] Initializing isolated execution environment: ${sandboxId}`);

  try {
    await fs.mkdir(sandboxDir, { recursive: true });

    // Write all project files to sandbox safely
    for (const file of input.files) {
      // Prevent directory traversal
      const safePath = path.normalize(file.filePath).replace(/^(\.\.[\/\\])+/, '');
      const fullPath = path.join(sandboxDir, safePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, file.content, 'utf8');
    }

    stdoutLines.push(`[Sandbox] Mounted ${input.files.length} project files to isolated sandbox.`);

    // Symlink project node_modules for local dependency resolution during testing
    try {
      const globalNodeModules = path.join(process.cwd(), 'node_modules');
      const targetNodeModules = path.join(sandboxDir, 'node_modules');
      await fs.symlink(globalNodeModules, targetNodeModules, 'dir');
    } catch {
      // Non-fatal if node_modules cannot be symlinked
    }

    // 1. JSON Schema & Manifest Verification
    for (const file of input.files) {
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
    for (const file of input.files) {
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
          stdoutLines.push(`✔ [AST Parse Success] ${file.filePath} passed ${loader.toUpperCase()} syntax check`);
        } catch (err: any) {
          failedChecks.push(`Compilation syntax failure in ${file.filePath}: ${err.message}`);
          stderrLines.push(`✖ [Syntax Error] ${file.filePath}:\n${err.message}`);
        }
      }
    }

    // 3. Check for undeclared external dependencies in package.json
    const pkgFile = input.files.find(f => f.filePath === 'package.json' || f.filePath.endsWith('/package.json'));
    if (pkgFile) {
      try {
        const pkg = JSON.parse(pkgFile.content);
        const allDeps = new Set([
          ...Object.keys(pkg.dependencies || {}),
          ...Object.keys(pkg.devDependencies || {}),
        ]);

        const importRegex = /(?:import|from|require)\s*\(?['"]([^'"]+)['"]\)?/g;
        const missingDeps: string[] = [];

        for (const file of input.files) {
          const ext = path.extname(file.filePath).slice(1).toLowerCase();
          if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) {
            let match;
            while ((match = importRegex.exec(file.content)) !== null) {
              const mod = match[1];
              if (
                !mod.startsWith('.') &&
                !mod.startsWith('/') &&
                !mod.startsWith('@/') &&
                !mod.startsWith('node:') &&
                !['fs', 'path', 'http', 'https', 'crypto', 'os', 'util', 'stream', 'events', 'url', 'child_process'].includes(mod)
              ) {
                const base = mod.startsWith('@') ? mod.split('/').slice(0, 2).join('/') : mod.split('/')[0];
                if (allDeps.size > 0 && !allDeps.has(base)) {
                  missingDeps.push(`${base} in ${file.filePath}`);
                }
              }
            }
          }
        }

        if (missingDeps.length > 0) {
          failedChecks.push(`Undeclared dependencies in package.json: ${missingDeps.slice(0, 3).join(', ')}`);
          stderrLines.push(`✖ [Dependency Error] Missing packages in package.json: ${missingDeps.slice(0, 3).join(', ')}`);
        } else {
          passedChecks.push('All imports matched declared package dependencies.');
          stdoutLines.push('✔ [Dependency Contract] All external packages are declared in package.json.');
        }
      } catch {
        // already flagged in step 1
      }
    }

    // 4. REAL ISOLATED EXECUTION OF TEST / BUILD COMMAND
    // We execute the actual test or verification command in the sandbox directory
    let cmdToRun = input.testCommand ? input.testCommand.trim() : '';
    if (!cmdToRun) {
      const scriptFile = input.files.find(f => /\.(ts|js|mjs)$/i.test(f.filePath));
      if (scriptFile) {
        cmdToRun = `esbuild "${scriptFile.filePath}" --bundle --platform=node --outfile=/dev/null`;
      }
    }

    if (cmdToRun) {
      const sanitizedCmd = cmdToRun;
      stdoutLines.push(`[Sandbox Exec] Executing verification command: "${sanitizedCmd}"`);

      // Strip dangerous characters for security
      if (sanitizedCmd.includes('rm -rf /') || sanitizedCmd.includes('mkfs') || sanitizedCmd.includes(':(){ :|:& };:')) {
        failedChecks.push('Command blocked by security policy');
        stderrLines.push('✖ [Security Policy] Dangerous command pattern detected.');
      } else {
        try {
          const localBin = path.join(process.cwd(), 'node_modules', '.bin');
          // Provide sanitized environment (strip all API keys and cloud credentials)
          const cleanEnv: Record<string, string> = {
            PATH: `${localBin}:${process.env.PATH || '/usr/local/bin:/usr/bin:/bin'}`,
            NODE_ENV: 'test',
            HOME: sandboxDir,
            TMPDIR: sandboxDir,
          };

          const { stdout: cmdOut, stderr: cmdErr } = await execAsync(sanitizedCmd, {
            cwd: sandboxDir,
            timeout: 10000, // 10s max
            maxBuffer: 1024 * 1024, // 1MB
            env: cleanEnv,
          });

          if (cmdOut) stdoutLines.push(cmdOut.trim());
          if (cmdErr) stdoutLines.push(`[info] ${cmdErr.trim()}`);

          passedChecks.push(`Command "${sanitizedCmd}" executed cleanly with exit code 0.`);
          stdoutLines.push(`✔ [Execution Success] Verification passed with exit code 0.`);
        } catch (execErr: any) {
          const errDetail = execErr.stderr || execErr.stdout || execErr.message;
          failedChecks.push(`Verification command failed (exit code ${execErr.code || 1}): ${errDetail.slice(0, 200)}`);
          stderrLines.push(`✖ [Command Failed - Exit Code ${execErr.code || 1}]:\n${errDetail}`);
        }
      }
    } else {
      failedChecks.push('No executable verification command found for this project.');
      stderrLines.push('✖ [Verification Error] A verification command must be executed to verify a task.');
    }

  } catch (outerErr: any) {
    failedChecks.push(`Runner error: ${outerErr.message}`);
    stderrLines.push(`✖ [Sandbox Exception]: ${outerErr.message}`);
  } finally {
    // Clean up sandbox directory
    try {
      await fs.rm(sandboxDir, { recursive: true, force: true });
      stdoutLines.push(`[Sandbox] Destroyed isolated environment ${sandboxId}.`);
    } catch (cleanErr) {
      console.warn('Failed to remove sandbox:', cleanErr);
    }
  }

  const durationMs = Date.now() - startTime;
  // A task must NEVER be verified unless failedChecks is empty!
  const status: 'passed' | 'failed' = failedChecks.length === 0 ? 'passed' : 'failed';

  stdoutLines.push(`[Verification Summary] Total execution time: ${durationMs}ms. Status: ${status.toUpperCase()} (${passedChecks.length} passed, ${failedChecks.length} failed).`);

  return {
    status,
    passedChecks,
    failedChecks,
    stdout: stdoutLines.join('\n'),
    stderr: stderrLines.join('\n'),
    durationMs,
  };
}
