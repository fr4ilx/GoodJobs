# GitHub Integration Setup

The Visualize Skills feature can automatically read content from GitHub repositories when you add GitHub links to your projects.

## How It Works

When you add a GitHub repository link (e.g., `https://github.com/username/repo`), the system will:

1. **Parse the GitHub URL** to extract owner, repository, and optional path
2. **Fetch repository content** including:
   - README files (README.md, README.txt, etc.)
   - Important configuration files (package.json, requirements.txt, etc.)
   - Specific files if a path is provided in the URL
3. **Include the content** in the skills analysis

## Public Repositories

Public repositories can be accessed **without authentication**. The system will automatically:
- Fetch README files
- Read important project files
- Extract relevant content for skills analysis

## Private Repositories (Optional)

If you want to analyze **private repositories**, you can optionally add a GitHub Personal Access Token.

### Creating a GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a name (e.g., "GoodJobs Skills Analysis")
4. Select scopes:
   - `repo` (Full control of private repositories) - if you want to access private repos
   - Or just leave it without `repo` scope for public repos only (higher rate limits)
5. Click "Generate token"
6. Copy the token immediately (you won't see it again)

### Adding the Token

Add the token to your `.env.local` file:

```bash
VITE_GITHUB_TOKEN=your_github_token_here
```

**Note:** The token is optional. If not provided, the system will:
- Still work for public repositories
- Have lower rate limits (60 requests/hour for unauthenticated)
- Not be able to access private repositories

## Rate Limits

- **Without token:** 60 requests/hour
- **With token:** 5,000 requests/hour

## Supported URL Formats

The system supports these GitHub URL formats:

- `https://github.com/owner/repo` - Fetches README and important files
- `https://github.com/owner/repo/tree/branch/path` - Fetches specific directory
- `https://github.com/owner/repo/blob/branch/path/to/file` - Fetches specific file

## Troubleshooting

### "Repository not found or is private"
- If it's a private repo, add `VITE_GITHUB_TOKEN` to your `.env.local`
- Make sure the token has the `repo` scope

### "GitHub API rate limit exceeded"
- Add `VITE_GITHUB_TOKEN` to increase rate limits
- Wait for the rate limit to reset (usually 1 hour)

### "Invalid GitHub URL format"
- Make sure the URL is a valid GitHub repository URL
- Check that the repository exists and is accessible
