
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Job, NavItem, UserProfile, UserPreferences } from './types';
import { MOCK_JOBS } from './constants.tsx';
import Sidebar from './components/Sidebar';
import JobCard from './components/JobCard';
import LandingPage from './components/LandingPage';
import AuthPage from './components/AuthPage';
import PreferencesPage from './components/PreferencesPage';
import ResumeUploadPage from './components/ResumeUploadPage';
import JobDetailModal from './components/JobDetailModal';
import { calculateMatchScore } from './services/geminiService';

const App: React.FC = () => {
  const [isStarted, setIsStarted] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isPreferencesComplete, setIsPreferencesComplete] = useState(false);
  const [isResumeComplete, setIsResumeComplete] = useState(false);
  
  const [activeNav, setActiveNav] = useState<NavItem>(NavItem.Jobs);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [usePreferencesFilter] = useState(true); 
  
  const [jobs, setJobs] = useState<Job[]>(MOCK_JOBS);
  const [analysisProgress, setAnalysisProgress] = useState<{current: number, total: number} | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: 'Steven',
    email: 'steven@example.com',
    resumeContent: '' 
  });

  const handleStart = (mode: 'login' | 'signup') => {
    setAuthMode(mode);
    setIsStarted(true);
  };

  const handleLogin = (email: string, name: string, isNewUser: boolean) => {
    setUserProfile(prev => ({ ...prev, email, name }));
    setIsAuthenticated(true);
    setIsPreferencesComplete(!isNewUser);
    setIsResumeComplete(!isNewUser);
    
    if (!isNewUser) {
      setUserProfile(prev => ({
        ...prev,
        resumeContent: 'Experienced Software Engineer with 5 years in React, TypeScript, and Node.js.'
      }));
    }
  };

  const handlePreferencesComplete = (prefs: UserPreferences) => {
    setUserProfile(prev => ({ ...prev, preferences: prefs }));
    setIsPreferencesComplete(true);
  };

  const handleResumeComplete = (resumeContent: string) => {
    setUserProfile(prev => ({ ...prev, resumeContent }));
    setIsResumeComplete(true);
  };

  const handleSignOut = () => {
    setIsAuthenticated(false);
    setIsStarted(false);
    setIsPreferencesComplete(false);
    setIsResumeComplete(false);
    setActiveNav(NavItem.Jobs);
  };

  const runAnalysis = useCallback(async () => {
    if (!userProfile.resumeContent) return;
    
    setAnalysisProgress({ current: 0, total: jobs.length });
    const updatedJobs = [...jobs];
    
    for (let i = 0; i < updatedJobs.length; i++) {
      setAnalysisProgress({ current: i + 1, total: jobs.length });
      const job = updatedJobs[i];
      const result = await calculateMatchScore(userProfile.resumeContent, job.description);
      
      updatedJobs[i] = { 
        ...job, 
        matchScore: result.score, 
        matchReason: result.reason 
      };
      setJobs([...updatedJobs]);

      if (i < updatedJobs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    const finalSorted = [...updatedJobs].sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
    setJobs(finalSorted);
    setAnalysisProgress(null);
  }, [jobs, userProfile.resumeContent]);

  useEffect(() => {
    if (isAuthenticated && isPreferencesComplete && isResumeComplete) {
      runAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isPreferencesComplete, isResumeComplete]);

  const filteredJobs = useMemo(() => {
    let result = [...jobs];

    if (usePreferencesFilter && userProfile.preferences) {
      const prefs = userProfile.preferences;
      result = result.filter(j => {
        const matchesTitle = j.title.toLowerCase().includes(prefs.jobTitle.toLowerCase()) || 
                             j.category.toLowerCase().includes(prefs.jobTitle.toLowerCase());
        const matchesLocation = prefs.location.toLowerCase() === 'remote' 
          ? j.location.toLowerCase() === 'remote' 
          : j.location.toLowerCase().includes(prefs.location.toLowerCase());
        const matchesWorkType = prefs.workType === 'All' || j.type === prefs.workType;
        
        return matchesTitle || matchesLocation || matchesWorkType;
      });
    }

    return result;
  }, [jobs, usePreferencesFilter, userProfile.preferences]);

  const isMatching = analysisProgress !== null;

  if (!isStarted) return <LandingPage onStart={handleStart} />;
  if (!isAuthenticated) return <AuthPage onLogin={handleLogin} onBack={() => setIsStarted(false)} initialMode={authMode} />;
  if (!isPreferencesComplete) return <PreferencesPage onComplete={handlePreferencesComplete} />;
  if (!isResumeComplete) return <ResumeUploadPage onComplete={handleResumeComplete} onBack={() => setIsPreferencesComplete(false)} />;

  return (
    <div className="min-h-screen bg-[#f8f9fe] animate-in fade-in duration-1000">
      <Sidebar activeItem={activeNav} onNavigate={setActiveNav} />

      <main className="ml-64 p-12 max-w-7xl mx-auto">
        {activeNav === NavItem.Jobs && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-10">
              <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-8">
                <div>
                  <p className="text-slate-400 font-medium mb-1 text-sm tracking-wide">AI-CURATED FEED</p>
                  <h1 className="text-4xl font-extrabold text-[#1a1a3a] tracking-tight">Personalized for You</h1>
                </div>
                
                <div className="flex items-center gap-3">
                   <div className="text-right">
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Matching Identity</p>
                      <p className="text-sm font-bold text-indigo-600">{userProfile.name}</p>
                   </div>
                   <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                      <i className="fa-solid fa-user-gear"></i>
                   </div>
                </div>
              </div>

              {/* Preferences Summary */}
              {userProfile.preferences && (
                <div className="flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-left-4 duration-700">
                  <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl text-xs font-bold border border-slate-100 shadow-sm text-slate-600">
                    <i className="fa-solid fa-briefcase text-indigo-500"></i>
                    {userProfile.preferences.jobTitle}
                  </div>
                  <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl text-xs font-bold border border-slate-100 shadow-sm text-slate-600">
                    <i className="fa-solid fa-location-dot text-purple-500"></i>
                    {userProfile.preferences.location}
                  </div>
                  <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl text-xs font-bold border border-slate-100 shadow-sm text-slate-600">
                    <i className="fa-solid fa-house-laptop text-emerald-500"></i>
                    {userProfile.preferences.workType}
                  </div>
                  {userProfile.preferences.requiresSponsorship && (
                    <div className="flex items-center gap-2 bg-rose-50 text-rose-600 px-4 py-2.5 rounded-2xl text-xs font-bold border border-rose-100/50 shadow-sm">
                      <i className="fa-solid fa-passport opacity-70"></i>
                      Visa Support Required
                    </div>
                  )}
                </div>
              )}
            </header>

            <div className="relative">
              {isMatching && (
                <div className="sticky top-0 mb-8 flex justify-center z-20">
                  <div className="bg-indigo-600 text-white text-[11px] font-black px-8 py-3 rounded-full shadow-2xl shadow-indigo-200 flex items-center gap-3 animate-bounce">
                    <i className="fa-solid fa-wand-magic-sparkles animate-pulse"></i>
                    <span className="tracking-widest uppercase">
                      Gemini Neural Matching {analysisProgress.current} / {analysisProgress.total}
                    </span>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 gap-4">
                {filteredJobs.length > 0 ? (
                  filteredJobs.map(job => (
                    <JobCard key={job.id} job={job} onClick={() => setSelectedJob(job)} />
                  ))
                ) : (
                  <div className="text-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                      <i className="fa-solid fa-magnifying-glass text-2xl text-slate-200"></i>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">No jobs currently match your criteria</h3>
                    <p className="text-slate-400 font-medium max-w-xs mx-auto">Try updating your preferences in the profile tab to broaden your search results.</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {activeNav === NavItem.Resume && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
            <h2 className="text-3xl font-extrabold text-[#1a1a3a] mb-6 tracking-tight">Resume Intelligence</h2>
            <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-100">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                  <i className="fa-solid fa-file-pdf text-xl"></i>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">Active Resume Profile</h4>
                  <p className="text-xs text-slate-400 font-medium">Synced with Matching Engine</p>
                </div>
              </div>
              
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">Document Content</label>
              <textarea
                value={userProfile.resumeContent}
                onChange={(e) => setUserProfile({ ...userProfile, resumeContent: e.target.value })}
                className="w-full h-80 p-8 rounded-3xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-600 outline-none text-slate-600 leading-relaxed text-sm font-medium transition-all"
                placeholder="Paste your resume content here..."
              />
              <button 
                onClick={runAnalysis}
                disabled={isMatching}
                className="mt-8 w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-slate-100 hover:bg-indigo-600 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {isMatching ? (
                  <i className="fa-solid fa-circle-notch animate-spin"></i>
                ) : (
                  <i className="fa-solid fa-bolt"></i>
                )}
                Force Global Re-match
              </button>
            </div>
          </section>
        )}

        {activeNav === NavItem.Profile && (
           <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto space-y-8">
             <h2 className="text-3xl font-extrabold text-[#1a1a3a] tracking-tight">Account & Career Setup</h2>
             
             <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-100">
                <div className="flex items-center gap-8 mb-10">
                  <div className="relative">
                    <img src={`https://picsum.photos/seed/${userProfile.name}/200/200`} alt="Avatar" className="w-28 h-28 rounded-[2.5rem] object-cover ring-8 ring-slate-50" />
                    <button className="absolute -bottom-2 -right-2 w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                      <i className="fa-solid fa-camera text-sm"></i>
                    </button>
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">{userProfile.name}</h3>
                    <p className="text-slate-500 font-medium">{userProfile.email}</p>
                    <div className="flex gap-2 mt-3">
                       <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest">Premium Plan</span>
                       <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest">Verified</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">Display Name</label>
                     <input type="text" value={userProfile.name} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-slate-900" readOnly />
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">Email Address</label>
                     <input type="email" value={userProfile.email} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-slate-900" readOnly />
                   </div>
                </div>
             </div>

             {userProfile.preferences && (
               <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-100 relative overflow-hidden group">
                 <div className="flex items-center justify-between mb-8">
                    <h4 className="text-xl font-black text-slate-900 tracking-tight">Active Matching Preferences</h4>
                    <button className="text-indigo-600 text-sm font-black uppercase tracking-widest hover:underline">Modify</button>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-5 rounded-3xl bg-slate-50 border border-slate-100">
                       <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2">Target Role</p>
                       <p className="font-bold text-slate-900 truncate">{userProfile.preferences.jobTitle}</p>
                    </div>
                    <div className="p-5 rounded-3xl bg-slate-50 border border-slate-100">
                       <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2">Location Preference</p>
                       <p className="font-bold text-slate-900 truncate">{userProfile.preferences.location}</p>
                    </div>
                    <div className="p-5 rounded-3xl bg-slate-50 border border-slate-100">
                       <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2">Work Modality</p>
                       <p className="font-bold text-slate-900 truncate">{userProfile.preferences.workType}</p>
                    </div>
                    <div className="p-5 rounded-3xl bg-slate-50 border border-slate-100">
                       <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2">Visa Sponsorship</p>
                       <p className="font-bold text-slate-900 truncate">{userProfile.preferences.requiresSponsorship ? 'Required' : 'Not Needed'}</p>
                    </div>
                 </div>
               </div>
             )}

             <div className="pt-4 flex gap-4">
               <button 
                  onClick={handleSignOut}
                  className="flex-1 bg-rose-50 text-rose-600 py-5 rounded-[2rem] font-black text-lg hover:bg-rose-100 transition-all flex items-center justify-center gap-3"
               >
                 <i className="fa-solid fa-arrow-right-from-bracket"></i>
                 Sign Out Securely
               </button>
             </div>
           </section>
        )}
      </main>

      {/* Global Job Detail Overlay */}
      {selectedJob && (
        <JobDetailModal job={selectedJob} onClose={() => setSelectedJob(null)} />
      )}
    </div>
  );
};

export default App;
