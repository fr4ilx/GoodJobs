/**
 * GitHub service for fetching repository content
 */

interface GitHubFile {
  name: string;
  path: string;
  type: 'file' | 'dir';
  content?: string; // Base64 encoded for files
  size: number;
  download_url?: string;
}

interface GitHubRepoInfo {
  owner: string;
  repo: string;
  path?: string;
}

/**
 * Parse GitHub URL to extract owner, repo, and optional path
 * Supports formats:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo/tree/branch/path
 * - https://github.com/owner/repo/blob/branch/path
 */
export function parseGitHubUrl(url: string): GitHubRepoInfo | null {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname !== 'github.com' && urlObj.hostname !== 'www.github.com') {
      return null;
    }

    const parts = urlObj.pathname.split('/').filter(Boolean);
    if (parts.length < 2) {
      return null;
    }

    const owner = parts[0];
    const repo = parts[1];
    
    // Check if there's a path (tree/blob)
    let path: string | undefined;
    if (parts.length > 2 && (parts[2] === 'tree' || parts[2] === 'blob')) {
      // Skip branch name (parts[3]) and get the rest as path
      if (parts.length > 4) {
        path = parts.slice(4).join('/');
      }
    }

    return { owner, repo, path };
  } catch (error) {
    return null;
  }
}

/**
 * Get GitHub API headers (with optional API key)
 */
function getGitHubHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
  };
  
  // Add GitHub token if available (for private repos and higher rate limits)
  const githubToken = import.meta.env.VITE_GITHUB_TOKEN || (process.env as any).GITHUB_TOKEN;
  if (githubToken) {
    headers['Authorization'] = `token ${githubToken}`;
  }
  
  return headers;
}

/**
 * Fetch repository README content
 */
async function fetchReadme(owner: string, repo: string): Promise<string | null> {
  try {
    // Try common README filenames
    const readmeFiles = ['README.md', 'README.txt', 'README', 'readme.md'];
    const headers = getGitHubHeaders();
    
    for (const filename of readmeFiles) {
      try {
        const response = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${filename}`,
          {
            headers: {
              ...headers,
              'Accept': 'application/vnd.github.v3.raw',
            }
          }
        );

        if (response.ok) {
          const content = await response.text();
          return content;
        }
      } catch (error) {
        // Try next filename
        continue;
      }
    }
    return null;
  } catch (error) {
    console.error('Error fetching README:', error);
    return null;
  }
}

/**
 * Fetch repository file content
 */
async function fetchFileContent(owner: string, repo: string, path: string): Promise<string | null> {
  try {
    const headers = getGitHubHeaders();
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        headers: {
          ...headers,
          'Accept': 'application/vnd.github.v3.raw',
        }
      }
    );

    if (response.ok) {
      const content = await response.text();
      return content;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching file ${path}:`, error);
    return null;
  }
}

/**
 * Fetch repository directory contents (limited to important files)
 */
async function fetchDirectoryContents(owner: string, repo: string, path?: string): Promise<string> {
  try {
    const apiPath = path || '';
    const headers = getGitHubHeaders();
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${apiPath}`,
      {
        headers
      }
    );

    if (!response.ok) {
      const error: any = new Error(`GitHub API error: ${response.status}`);
      error.status = response.status;
      throw error;
    }

    const files: GitHubFile[] = await response.json();
    
    // Filter for important files (README, package.json, requirements.txt, etc.)
    const importantFiles = files.filter(file => 
      file.type === 'file' && (
        file.name.toLowerCase().includes('readme') ||
        file.name === 'package.json' ||
        file.name === 'requirements.txt' ||
        file.name === 'pom.xml' ||
        file.name === 'build.gradle' ||
        file.name === 'Cargo.toml' ||
        file.name === 'go.mod' ||
        file.name === 'composer.json' ||
        file.name.endsWith('.md') ||
        file.name.endsWith('.txt')
      )
    ).slice(0, 10); // Limit to 10 files

    let content = `Repository: ${owner}/${repo}\n`;
    if (path) {
      content += `Path: ${path}\n`;
    }
    content += `\nImportant Files:\n`;

    // Fetch content for each important file
    for (const file of importantFiles) {
      if (file.size > 100000) continue; // Skip files > 100KB
      
      const fileContent = await fetchFileContent(owner, repo, file.path);
      if (fileContent) {
        content += `\n--- ${file.name} ---\n${fileContent}\n`;
      }
    }

    return content;
  } catch (error: any) {
    console.error('Error fetching directory contents:', error);
    // Re-throw with status code if available
    if (error.status) {
      const newError: any = new Error(error.message || 'GitHub API error');
      newError.status = error.status;
      throw newError;
    }
    throw error;
  }
}

/**
 * Fetch GitHub repository content for analysis
 * Returns the content as a string, or null if inaccessible
 * @param url - GitHub repository URL
 */
export async function fetchGitHubContent(url: string): Promise<{ content: string; accessible: boolean; reason?: string }> {
  try {
    const repoInfo = parseGitHubUrl(url);
    if (!repoInfo) {
      return {
        content: '',
        accessible: false,
        reason: 'Invalid GitHub URL format'
      };
    }

    const { owner, repo, path } = repoInfo;

    // If specific file path, fetch that file
    if (path) {
      const fileContent = await fetchFileContent(owner, repo, path);
      if (fileContent) {
        return {
          content: `GitHub Repository: ${owner}/${repo}\nFile: ${path}\n\n${fileContent}`,
          accessible: true
        };
      }
    }

    // Try to fetch README first
    const readme = await fetchReadme(owner, repo);
    if (readme) {
      return {
        content: `GitHub Repository: ${owner}/${repo}\n\nREADME:\n${readme}`,
        accessible: true
      };
    }

    // If no README, fetch directory contents
    try {
      const dirContent = await fetchDirectoryContents(owner, repo, path);
      if (dirContent && dirContent.trim().length > 0) {
        return {
          content: dirContent,
          accessible: true
        };
      } else {
        return {
          content: '',
          accessible: false,
          reason: 'Repository exists but no readable content found (may be empty or contain only binary files)'
        };
      }
    } catch (error: any) {
      // Handle rate limiting
      if (error?.status === 403 || error?.message?.includes('rate limit') || error?.message?.includes('403')) {
        return {
          content: '',
          accessible: false,
          reason: 'GitHub API rate limit exceeded or repository is private. Add VITE_GITHUB_TOKEN to .env.local for private repos and higher rate limits.'
        };
      }

      // Handle not found
      if (error?.status === 404 || error?.message?.includes('404')) {
        return {
          content: '',
          accessible: false,
          reason: 'Repository not found or is private. If private, add VITE_GITHUB_TOKEN to .env.local.'
        };
      }

      return {
        content: '',
        accessible: false,
        reason: `Repository exists but content could not be fetched: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  } catch (error: any) {
    // Handle rate limiting
    if (error?.status === 403 || error?.message?.includes('rate limit') || error?.message?.includes('403')) {
      return {
        content: '',
        accessible: false,
        reason: 'GitHub API rate limit exceeded. Repository may be private or requires authentication. Add VITE_GITHUB_TOKEN to .env.local.'
      };
    }

    // Handle not found
    if (error?.status === 404 || error?.message?.includes('404')) {
      return {
        content: '',
        accessible: false,
        reason: 'Repository not found or is private. If private, add VITE_GITHUB_TOKEN to .env.local.'
      };
    }

    return {
      content: '',
      accessible: false,
      reason: error?.message || 'Unable to access GitHub repository'
    };
  }
}
