# GitHub OAuth Setup Guide

This guide will help you set up GitHub OAuth so users can authorize the app to access their GitHub repositories directly, without requiring a global API token.

## Why GitHub OAuth?

- **User-specific access**: Each user authorizes access to their own repositories
- **Private repositories**: Users can access their private repos
- **Higher rate limits**: 5,000 requests/hour per user (vs 60/hour unauthenticated)
- **Better security**: No need to store a global token

## Step 1: Create a GitHub OAuth App

1. Go to GitHub Settings → Developer settings → OAuth Apps
   - Direct link: https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in the form:
   - **Application name**: `GoodJobs` (or your app name)
   - **Homepage URL**: `http://localhost:5173` (for development) or your production URL
   - **Authorization callback URL**: `http://localhost:5173/github-callback` (for development) or `https://yourdomain.com/github-callback` (for production)
4. Click "Register application"
5. **Copy the Client ID** (you'll need this)
6. **Generate a Client Secret**:
   - Click "Generate a new client secret"
   - **Copy the secret immediately** (you won't see it again!)

## Step 2: Configure Environment Variables

Add these to your `.env.local` file:

```bash
# GitHub OAuth Configuration
VITE_GITHUB_CLIENT_ID=your_client_id_here
VITE_GITHUB_CLIENT_SECRET=your_client_secret_here
VITE_GITHUB_REDIRECT_URI=http://localhost:5173/github-callback

# Optional: If you have a backend proxy for token exchange (recommended for production)
# VITE_GITHUB_OAUTH_PROXY=https://your-backend.com/api/github/oauth
```

**Important Security Note**: 
- The `VITE_GITHUB_CLIENT_SECRET` will be exposed in the client bundle
- For production, it's recommended to use a backend proxy for token exchange
- See "Backend Proxy Setup" below for more details

## Step 3: Update Callback URL for Production

When deploying to production:

1. Update the OAuth App's "Authorization callback URL" in GitHub settings
2. Update `VITE_GITHUB_REDIRECT_URI` in your production environment variables

## How It Works

1. **User clicks "Connect GitHub"** in the Profile tab
2. **User is redirected to GitHub** to authorize the app
3. **GitHub redirects back** with an authorization code
4. **App exchanges code for access token** (stored in user's Firestore profile)
5. **Token is used** when fetching GitHub repository content

## Backend Proxy Setup (Recommended for Production)

For better security, you can set up a backend endpoint to handle the token exchange:

### Backend Endpoint Example (Node.js/Express)

```javascript
app.post('/api/github/oauth', async (req, res) => {
  const { code, state } = req.body;
  
  // Verify state (CSRF protection)
  // ... your state verification logic ...
  
  // Exchange code for token
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET, // Safe on backend
      code: code,
      state: state,
      redirect_uri: process.env.GITHUB_REDIRECT_URI
    })
  });
  
  const data = await response.json();
  res.json({ access_token: data.access_token });
});
```

Then set `VITE_GITHUB_OAUTH_PROXY` to your backend URL. The client will use this proxy instead of making the request directly.

## Troubleshooting

### "Invalid state parameter"
- The OAuth state doesn't match. This usually happens if:
  - Session storage was cleared
  - Multiple tabs are open
  - The callback was accessed directly

### "Failed to exchange code for token"
- Check that `VITE_GITHUB_CLIENT_ID` and `VITE_GITHUB_CLIENT_SECRET` are set correctly
- Verify the callback URL matches exactly in GitHub OAuth App settings
- Check browser console for detailed error messages

### "Repository not found or is private"
- User needs to connect their GitHub account first
- For private repos, the user's token must have `repo` scope (included by default)

### Token not persisting
- Check Firestore security rules allow writing to `users/{userId}`
- Verify the user is authenticated when connecting

## Testing

1. Start your dev server: `npm run dev`
2. Sign in to your app
3. Go to Profile tab
4. Click "Connect GitHub"
5. Authorize the app on GitHub
6. You should be redirected back and see "Connected to GitHub"

## Security Best Practices

1. **Use HTTPS in production** - OAuth requires secure connections
2. **Use backend proxy** - Don't expose client secret in production
3. **Validate state parameter** - Prevents CSRF attacks
4. **Store tokens securely** - Consider encrypting tokens in Firestore
5. **Implement token refresh** - GitHub tokens don't expire, but handle revocation

## Scope Permissions

The app requests these scopes:
- `repo` - Full access to repositories (for private repos)
- `read:user` - Read user profile information

Users can see and approve these permissions when authorizing.
