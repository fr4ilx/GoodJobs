import React, { useState } from 'react';
import { signInWithEmail, signInWithGoogle, resetPassword } from '../services/authService';

interface SignInPageProps {
  onBack: () => void;
  onSwitchToSignUp: () => void;
}

const SignInPage: React.FC<SignInPageProps> = ({ onBack, onSwitchToSignUp }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await signInWithEmail(email, password);
      // User will be redirected automatically via AuthContext
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsLoading(true);

    try {
      await signInWithGoogle();
      // User will be redirected automatically via AuthContext
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      setError('Please enter your email address first');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      await resetPassword(email);
      setResetEmailSent(true);
      setTimeout(() => {
        setShowResetPassword(false);
        setResetEmailSent(false);
        setEmail('');
      }, 5000);
    } catch (err: any) {
      console.error('Password reset error:', err);
      
      // Handle specific Firebase errors
      if (err.message.includes('user-not-found') || err.message.includes('auth/user-not-found')) {
        setError('No account found with this email address. Please check and try again.');
      } else if (err.message.includes('invalid-email') || err.message.includes('auth/invalid-email')) {
        setError('Invalid email address format. Please check and try again.');
      } else if (err.message.includes('too-many-requests') || err.message.includes('auth/too-many-requests')) {
        setError('Too many reset attempts. Please try again later.');
      } else {
        setError(err.message || 'Failed to send reset email. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fe] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Abstract Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-200/30 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-200/30 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-700">
        <button 
          onClick={onBack}
          className="mb-8 flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-bold text-sm transition-colors group"
        >
          <i className="fa-solid fa-arrow-left group-hover:-translate-x-1 transition-transform"></i>
          Back to home
        </button>

        <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 p-10 border border-slate-100">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center bg-indigo-600 rounded-2xl p-3 shadow-lg shadow-indigo-100 mb-6">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Welcome Back</h2>
            <p className="text-slate-500 font-medium mt-2">Enter your details to access your dashboard</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl">
              <p className="text-rose-600 text-sm font-bold">{error}</p>
            </div>
          )}

          {resetEmailSent && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
              <div className="flex items-start gap-3">
                <i className="fa-solid fa-circle-check text-emerald-600 text-xl mt-0.5"></i>
                <div>
                  <p className="text-emerald-600 text-sm font-bold mb-1">Password reset email sent!</p>
                  <p className="text-emerald-600 text-xs">
                    Check your inbox at <span className="font-bold">{email}</span>. 
                    Don't forget to check your spam folder if you don't see it within a few minutes.
                  </p>
                </div>
              </div>
            </div>
          )}

          {showResetPassword ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                <div className="relative">
                  <i className="fa-solid fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
                  <input 
                    type="email" 
                    required 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-900 font-bold placeholder:text-slate-300 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all" 
                    placeholder="name@company.com" 
                  />
                </div>
              </div>

              <button 
                onClick={handlePasswordReset}
                disabled={isLoading}
                className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-70"
              >
                {isLoading ? (
                  <i className="fa-solid fa-circle-notch animate-spin"></i>
                ) : (
                  'Send Reset Email'
                )}
              </button>

              <button 
                onClick={() => setShowResetPassword(false)}
                className="w-full text-slate-500 py-3 text-sm font-bold hover:text-indigo-600 transition-colors"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                <div className="relative">
                  <i className="fa-solid fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
                  <input 
                    type="email" 
                    required 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-900 font-bold placeholder:text-slate-300 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all" 
                    placeholder="name@company.com" 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                  <button 
                    type="button"
                    onClick={() => setShowResetPassword(true)}
                    className="text-xs font-bold text-indigo-600 hover:underline"
                  >
                    Forgot?
                  </button>
                </div>
                <div className="relative">
                  <i className="fa-solid fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    required 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-12 text-slate-900 font-bold placeholder:text-slate-300 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all" 
                    placeholder="••••••••" 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-70"
              >
                {isLoading ? (
                  <i className="fa-solid fa-circle-notch animate-spin"></i>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
          )}

          {!showResetPassword && (
            <>
              <div className="relative my-8 text-center">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                <span className="relative px-4 bg-white text-xs font-black text-slate-300 uppercase tracking-widest">Or continue with</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-3 py-4 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-all group disabled:opacity-70"
                >
                  <i className="fa-brands fa-google text-slate-400 group-hover:text-red-500 transition-colors"></i>
                  <span className="text-sm font-bold text-slate-600">Google</span>
                </button>
                <button 
                  disabled={isLoading}
                  className="flex items-center justify-center gap-3 py-4 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-all group disabled:opacity-70"
                >
                  <i className="fa-brands fa-linkedin text-slate-400 group-hover:text-blue-600 transition-colors"></i>
                  <span className="text-sm font-bold text-slate-600">LinkedIn</span>
                </button>
              </div>

              <div className="mt-8 text-center">
                <p className="text-slate-500 text-sm">
                  Don't have an account?{' '}
                  <button 
                    onClick={onSwitchToSignUp}
                    className="text-indigo-600 font-bold hover:underline"
                  >
                    Sign Up
                  </button>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignInPage;
