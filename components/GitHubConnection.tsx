import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserProfile, saveUserProfile } from '../services/firestoreService';
import { getGitHubAuthUrl, verifyGitHubToken, getGitHubUserInfo } from '../services/githubAuthService';

interface GitHubConnectionProps {
  onTokenUpdate?: () => void;
}

const GitHubConnection: React.FC<GitHubConnectionProps> = ({ onTokenUpdate }) => {
  const { currentUser } = useAuth();
  const [githubToken, setGithubToken] = useState<string | null>(null);
  const [githubUsername, setGithubUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (currentUser) {
      loadGitHubStatus();
    }
  }, [currentUser]);

  const loadGitHubStatus = async () => {
    if (!currentUser) return;
    
    try {
      const userData = await getUserProfile(currentUser.uid);
      if (userData) {
        const token = (userData as any).githubToken;
        const username = (userData as any).githubUsername;
        
        if (token) {
          setGithubToken(token);
          setGithubUsername(username || null);
          
          // Verify token is still valid
          setIsVerifying(true);
          const isValid = await verifyGitHubToken(token);
          setIsVerifying(false);
          
          if (!isValid) {
            // Token is invalid, clear it
            await disconnectGitHub();
          } else if (!username) {
            // Token is valid but username is missing, fetch it
            try {
              const userInfo = await getGitHubUserInfo(token);
              setGithubUsername(userInfo.login);
              await saveUserProfile(currentUser.uid, {
                githubUsername: userInfo.login
              });
            } catch (error) {
              console.error('Error fetching GitHub username:', error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading GitHub status:', error);
    }
  };

  const connectGitHub = () => {
    const authUrl = getGitHubAuthUrl();
    window.location.href = authUrl;
  };

  const disconnectGitHub = async () => {
    if (!currentUser) return;
    
    setIsLoading(true);
    try {
      await saveUserProfile(currentUser.uid, {
        githubToken: null,
        githubUsername: null
      });
      setGithubToken(null);
      setGithubUsername(null);
      if (onTokenUpdate) {
        onTokenUpdate();
      }
    } catch (error) {
      console.error('Error disconnecting GitHub:', error);
      alert('Failed to disconnect GitHub. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
          <span className="text-sm font-medium text-slate-600">Verifying GitHub connection...</span>
        </div>
      </div>
    );
  }

  if (githubToken) {
    return (
      <div className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center">
              <i className="fa-brands fa-github text-white text-lg"></i>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">
                Connected to GitHub
              </p>
              {githubUsername && (
                <p className="text-xs text-slate-500">@{githubUsername}</p>
              )}
              <p className="text-xs text-slate-400 mt-1">
                Private repositories and higher rate limits enabled
              </p>
            </div>
          </div>
          <button
            onClick={disconnectGitHub}
            disabled={isLoading}
            className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-sm font-bold hover:bg-rose-100 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Disconnecting...' : 'Disconnect'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center">
            <i className="fa-brands fa-github text-white text-lg"></i>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">
              Connect GitHub Account
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Access private repositories and increase rate limits
            </p>
          </div>
        </div>
        <button
          onClick={connectGitHub}
          className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 active:scale-95 transition-all flex items-center gap-2"
        >
          <i className="fa-brands fa-github"></i>
          Connect
        </button>
      </div>
    </div>
  );
};

export default GitHubConnection;
