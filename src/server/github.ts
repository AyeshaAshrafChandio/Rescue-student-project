export interface GitHubRepoFile {
  filePath: string;
  content: string;
  size: number;
}

export async function fetchGitHubRepository(repoInput: string, branch = 'main'): Promise<{ files: GitHubRepoFile[]; repoName: string; defaultBranch: string }> {
  // Normalize input: e.g. "https://github.com/owner/repo" or "owner/repo" or "https://github.com/owner/repo.git"
  let clean = repoInput.trim();
  clean = clean.replace(/\.git$/, '');
  clean = clean.replace(/^https?:\/\/github\.com\//, '');
  clean = clean.replace(/^\//, '');

  const parts = clean.split('/');
  if (parts.length < 2) {
    throw new Error('Invalid GitHub repository format. Please provide "owner/repo" or "https://github.com/owner/repo"');
  }

  const owner = parts[0];
  const repo = parts[1];

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Student-Project-Rescue-App',
  };

  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }

  // 1. Get repo info to find default branch if not specified or fallback
  const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!repoRes.ok) {
    const err = await repoRes.text();
    if (repoRes.status === 404) {
      throw new Error(`GitHub repository "${owner}/${repo}" was not found or is private. Make sure it is public or check the URL.`);
    }
    if (repoRes.status === 403 && err.includes('rate limit')) {
      throw new Error('GitHub API rate limit exceeded. You can configure a GITHUB_TOKEN or upload your project as a ZIP.');
    }
    throw new Error(`GitHub API error (${repoRes.status}): ${err}`);
  }

  const repoData = await repoRes.json();
  const targetBranch = branch || repoData.default_branch || 'main';

  // 2. Get git tree recursively
  const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${targetBranch}?recursive=1`, { headers });
  if (!treeRes.ok) {
    // Try fallback to master
    const fallbackRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`, { headers });
    if (!fallbackRes.ok) {
      throw new Error(`Failed to fetch file tree for branch "${targetBranch}".`);
    }
    return processTree(await fallbackRes.json(), owner, repo, 'master', headers);
  }

  const treeData = await treeRes.json();
  return processTree(treeData, owner, repo, targetBranch, headers);
}

async function processTree(
  treeData: any,
  owner: string,
  repo: string,
  branch: string,
  headers: Record<string, string>
): Promise<{ files: GitHubRepoFile[]; repoName: string; defaultBranch: string }> {
  if (!treeData.tree || !Array.isArray(treeData.tree)) {
    throw new Error('No files found in GitHub repository tree.');
  }

  const ignoredPrefixes = [
    'node_modules/',
    '.git/',
    'dist/',
    'build/',
    '.next/',
    '.cache/',
    'vendor/',
  ];

  const allowedExtensions = [
    '.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css', '.scss',
    '.py', '.java', '.c', '.cpp', '.h', '.go', '.rs', '.php', '.rb',
    '.md', '.txt', '.env.example', '.sql', '.yaml', '.yml', '.xml'
  ];

  const eligibleItems = treeData.tree.filter((item: any) => {
    if (item.type !== 'blob') return false;
    const path = item.path;
    if (ignoredPrefixes.some(pref => path.startsWith(pref))) return false;
    if (item.size && item.size > 250000) return false; // skip huge files > 250KB
    return allowedExtensions.some(ext => path.toLowerCase().endsWith(ext));
  }).slice(0, 45); // Limit to top 45 essential source files

  const files: GitHubRepoFile[] = [];

  // Fetch file contents in small batches
  const batchSize = 6;
  for (let i = 0; i < eligibleItems.length; i += batchSize) {
    const chunk = eligibleItems.slice(i, i + batchSize);
    await Promise.all(
      chunk.map(async (item: any) => {
        try {
          const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${item.path}`;
          const rawRes = await fetch(rawUrl, { headers });
          if (rawRes.ok) {
            const content = await rawRes.text();
            files.push({
              filePath: item.path,
              content,
              size: item.size || content.length,
            });
          }
        } catch (e) {
          console.warn(`Failed to fetch file ${item.path} from GitHub:`, e);
        }
      })
    );
  }

  if (files.length === 0) {
    throw new Error('No readable code files could be retrieved from the repository.');
  }

  return {
    files,
    repoName: `${owner}/${repo}`,
    defaultBranch: branch,
  };
}
