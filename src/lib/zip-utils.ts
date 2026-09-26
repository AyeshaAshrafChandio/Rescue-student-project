import JSZip from 'jszip';
import { ProjectFile } from '../types/index.ts';

const ALLOWED_EXTENSIONS = [
  '.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css', '.scss',
  '.py', '.java', '.c', '.cpp', '.h', '.go', '.rs', '.php', '.rb',
  '.md', '.txt', '.env.example', '.sql', '.yaml', '.yml', '.xml', '.vue', '.svelte'
];

export async function extractZipFile(file: File): Promise<Array<{ filePath: string; content: string; size: number }>> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);
  const files: Array<{ filePath: string; content: string; size: number }> = [];

  const entries = Object.keys(loadedZip.files);

  for (const rawPath of entries) {
    const zipEntry = loadedZip.files[rawPath];
    if (zipEntry.dir) continue;
    if (rawPath.startsWith('__MACOSX/') || rawPath.includes('/.DS_Store') || rawPath.endsWith('.DS_Store')) continue;
    if (rawPath.includes('node_modules/') || rawPath.includes('.git/')) continue;

    // Normalize path (strip common root folder if zipped as folder)
    const cleanPath = rawPath.replace(/^[^\/]+\//, (match) => {
      // only strip if every file has this same prefix
      return match;
    });

    const hasAllowedExt = ALLOWED_EXTENSIONS.some(ext => rawPath.toLowerCase().endsWith(ext));
    if (!hasAllowedExt) continue;

    try {
      const content = await zipEntry.async('string');
      // Limit individual file size to 250KB for text
      if (content.length <= 250000) {
        files.push({
          filePath: rawPath,
          content,
          size: content.length,
        });
      }
    } catch (e) {
      console.warn(`Could not read text for file ${rawPath}:`, e);
    }
  }

  if (files.length === 0) {
    throw new Error('No valid text/source code files found inside the ZIP archive.');
  }

  return files;
}

export async function downloadProjectAsZip(projectName: string, files: ProjectFile[]): Promise<void> {
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
