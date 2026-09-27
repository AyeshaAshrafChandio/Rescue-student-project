import JSZip from 'jszip';
import { ProjectFile } from '../types/index.ts';

const ALLOWED_EXTENSIONS = [
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json', '.html', '.css', '.scss', '.less',
  '.py', '.java', '.c', '.cpp', '.h', '.go', '.rs', '.php', '.rb',
  '.md', '.txt', '.env.example', '.sql', '.yaml', '.yml', '.xml', '.toml', '.sh',
  '.vue', '.svelte', '.prisma', '.graphql',
];

const ALLOWED_EXACT_NAMES = new Set([
  'readme',
  'dockerfile',
  'makefile',
  'procfile',
  '.gitignore',
  '.env.example',
]);

const STANDARD_PROJECT_DIRS = new Set([
  'src',
  'public',
  'server',
  'client',
  'lib',
  'app',
  'components',
  'pages',
  'views',
  'api',
  'db',
  'styles',
  'tests',
  'test',
  'config',
  'scripts',
  'utils',
  'types',
  'hooks',
  'context',
  'middleware',
  'assets',
  'routes',
  'models',
]);

export async function extractZipFile(
  file: File
): Promise<Array<{ filePath: string; content: string; size: number }>> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);
  const rawExtracted: Array<{ filePath: string; content: string; size: number }> = [];

  const entries = Object.keys(loadedZip.files);

  for (const rawPath of entries) {
    const zipEntry = loadedZip.files[rawPath];
    if (zipEntry.dir) continue;

    const normalizedRaw = rawPath.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalizedRaw) continue;

    if (
      normalizedRaw.startsWith('__MACOSX/') ||
      normalizedRaw.includes('/.DS_Store') ||
      normalizedRaw.endsWith('.DS_Store') ||
      normalizedRaw.includes('node_modules/') ||
      normalizedRaw.includes('.git/') ||
      normalizedRaw.startsWith('dist/') ||
      normalizedRaw.includes('/dist/') ||
      normalizedRaw.startsWith('build/') ||
      normalizedRaw.includes('/build/') ||
      normalizedRaw.startsWith('.next/') ||
      normalizedRaw.includes('/.next/')
    ) {
      continue;
    }

    const lower = normalizedRaw.toLowerCase();
    const baseName = lower.split('/').pop() || '';
    const hasAllowedExt =
      ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext)) ||
      ALLOWED_EXACT_NAMES.has(baseName);
    if (!hasAllowedExt) continue;

    try {
      const content = await zipEntry.async('string');
      // Limit individual file size to 500KB for text
      if (content.length <= 500000) {
        rawExtracted.push({
          filePath: normalizedRaw,
          content,
          size: content.length,
        });
      }
    } catch (e) {
      console.warn(`Could not read text for file ${normalizedRaw}:`, e);
    }
  }

  if (rawExtracted.length === 0) {
    throw new Error('No valid text/source code files found inside the ZIP archive.');
  }

  // Strip common top-level wrapper folder if the entire archive is wrapped in a single directory
  const allHaveSlash = rawExtracted.every((f) => f.filePath.includes('/'));
  if (allHaveSlash) {
    const firstPrefix = rawExtracted[0].filePath.split('/')[0];
    const allSharePrefix = rawExtracted.every((f) => f.filePath.startsWith(`${firstPrefix}/`));
    if (allSharePrefix && !STANDARD_PROJECT_DIRS.has(firstPrefix.toLowerCase())) {
      return rawExtracted.map((f) => ({
        ...f,
        filePath: f.filePath.slice(firstPrefix.length + 1),
      }));
    }
  }

  return rawExtracted;
}

export async function downloadProjectAsZip(
  projectName: string,
  files: ProjectFile[]
): Promise<void> {
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.filePath, file.content);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  a.download = `${sanitizedName}-rescued-submission.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
