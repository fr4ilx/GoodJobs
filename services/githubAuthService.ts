/**
 * GitHub OAuth service for user authentication
 * Allows users to authorize the app to access their GitHub repositories
 */

// GitHub OAuth configuration
// These should be set in environment variables
const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = import.meta.env.VITE_GITHUB_CLIENT_SECRET || '';
const GITHUB_REDIRECT_URI = import.meta.env.VITE_GITHUB_REDIRECT_URI || 
  (typeof window !== 'undefined' ? `${window.location.origin}/github-callback` : '');

/**
 * Generate GitHub OAuth authorization URL
 */
export function getGitHubAuthUrl(): string {
  const state = generateRandomState();
  // Store state in sessionStorage for verification
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('github_oauth_state', state);
  }
  
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: GITHUB_REDIRECT_URI,
    scope: 'repo read:user', // Access to repositories and user info
    state: state,
    allow_signup: 'true'
  });
  
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 * Note: This should ideally be done on a backend server for security
 * For now, we'll use a proxy or handle it client-side (less secure but works)
 */
export async function exchangeGitHubCode(code: string, state: string): Promise<string> {
  // Verify state
  if (typeof window !== 'undefined') {
    const storedState = sessionStorage.getItem('github_oauth_state');
    if (storedState !== state) {
      throw new Error('Invalid state parameter. Possible CSRF attack.');
    }
    sessionStorage.removeItem('github_oauth_state');
  }
  
  // Exchange code for token
  // NOTE: In production, this should be done on a backend server
  // because GITHUB_CLIENT_SECRET should never be exposed to the client
  // For now, we'll use a proxy endpoint or handle it server-side
  
  try {
    // Option 1: Use a backend proxy (recommended)
    // Replace this URL with your backend endpoint
    const proxyUrl = import.meta.env.VITE_GITHUB_OAUTH_PROXY || '';
    
    if (proxyUrl) {
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, state })
      });
      
      if (!response.ok) {
        throw new Error('Failed to exchange code for token');
      }
      
      const data = await response.json();
      return data.access_token;
    }
    
    // Option 2: Direct client-side exchange (NOT RECOMMENDED for production)
    // This exposes the client secret, but works for development
    if (!GITHUB_CLIENT_SECRET) {
      throw new Error('GitHub OAuth proxy URL or client secret must be configured');
    }
    
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code: code,
        state: state,
        redirect_uri: GITHUB_REDIRECT_URI
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to exchange code for token');
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error_description || data.error);
    }
    
    return data.access_token;
  } catch (error) {
    console.error('Error exchanging GitHub code:', error);
    throw error;
  }
}

/**
 * Get GitHub user info using access token
 */
export async function getGitHubUserInfo(accessToken: string): Promise<{ login: string; name: string; avatar_url: string }> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch GitHub user info');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching GitHub user info:', error);
    throw error;
  }
}

/**
 * Verify if a GitHub token is valid
 */
export async function verifyGitHubToken(token: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Generate random state for OAuth CSRF protection
 */
function generateRandomState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Handle GitHub OAuth callback
 * Extracts code and state from URL
 */
export function handleGitHubCallback(): { code: string; state: string } | null {
  if (typeof window === 'undefined') return null;
  
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');
  const error = urlParams.get('error');
  
  if (error) {
    throw new Error(`GitHub OAuth error: ${error}`);
  }
  
  if (!code || !state) {
    return null;
  }
  
  return { code, state };
}
