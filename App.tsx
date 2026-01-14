
import React, { useState, useEffect, useCallback } from 'react';
import { Job, NavItem, UserProfile } from './types';
import { MOCK_JOBS, CATEGORIES } from './constants.tsx';
import Sidebar from './components/Sidebar';
import JobCard from './components/JobCard';
import { calculateMatchScore } from './services/geminiService';

const App: React.FC = () => {
  const [activeNav, setActiveNav] = useState<NavItem>(NavItem.Jobs);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>(MOCK_JOBS);
  const [isMatching, setIsMatching] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: 'Steven',
    email: 'steven@example.com',
    resumeContent: 'Experienced Software Engineer with 5 years in React, TypeScript, and Node.js. Proficient in cloud systems and API design.'
  });

  const runAnalysis = useCallback(async () => {
    setIsMatching(true);
    const updatedJobs = await Promise.all(
      jobs.map(async (job) => {
        const result = await calculateMatchScore(userProfile.resumeContent, job.description);
        return { ...job, matchScore: result.score, matchReason: result.reason };
      })
    );
    // Sort by match score descending
    updatedJobs.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
    setJobs(updatedJobs);
    setIsMatching(false);
  }, [jobs, userProfile.resumeContent]);

  useEffect(() => {
    // Initial analysis on load
    runAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredJobs = selectedCategory 
    ? jobs.filter(j => j.category === selectedCategory)
    : jobs;

  return (
    <div className="min-h-screen bg-[#f8f9fe]">
      <Sidebar activeItem={activeNav} onNavigate={setActiveNav} />

      <main className="ml-64 p-12 max-w-7xl mx-auto">
        {activeNav === NavItem.Jobs && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-10">
              <p className="text-slate-400 font-medium mb-1">Hi {userProfile.name},</p>
              <h1 className="text-4xl font-extrabold text-[#1a1a3a] mb-8">Welcome to GoodJobs!</h1>

              <div className="flex items-center justify-between">
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                      className={`px-6 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
                        selectedCategory === cat
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                          : 'bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="relative">
                   <button className="flex items-center gap-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-6 py-2.5 rounded-full font-bold shadow-lg shadow-indigo-100 hover:scale-105 transition-transform">
                      Recommended
                      <i className="fa-solid fa-chevron-down text-xs"></i>
                   </button>
                </div>
              </div>
            </header>

            <div className="relative">
              {isMatching && (
                <div className="absolute inset-x-0 -top-4 flex justify-center z-10">
                  <div className="bg-indigo-600 text-white text-[10px] font-bold px-4 py-1.5 rounded-full animate-pulse tracking-widest uppercase">
                    AI Analysis in Progress...
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 gap-1">
                {filteredJobs.length > 0 ? (
                  filteredJobs.map(job => (
                    <JobCard key={job.id} job={job} onClick={() => {}} />
                  ))
                ) : (
                  <div className="text-center py-20 bg-white rounded-[2rem] border-2 border-dashed border-slate-200">
                    <i className="fa-solid fa-magnifying-glass text-4xl text-slate-200 mb-4"></i>
                    <p className="text-slate-400 font-medium">No jobs found for this category.</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {activeNav === NavItem.Resume && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
            <h2 className="text-3xl font-extrabold text-[#1a1a3a] mb-6">Manage Your Resume</h2>
            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100">
              <label className="block text-sm font-bold text-slate-700 mb-4">Resume Content (Paste Here)</label>
              <textarea
                value={userProfile.resumeContent}
                onChange={(e) => setUserProfile({ ...userProfile, resumeContent: e.target.value })}
                className="w-full h-80 p-6 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-slate-600 leading-relaxed text-sm font-medium transition-all"
                placeholder="Paste your professional experience, skills, and education here..."
              />
              <button 
                onClick={runAnalysis}
                disabled={isMatching}
                className="mt-6 w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {isMatching ? (
                  <>
                    <i className="fa-solid fa-circle-notch animate-spin"></i>
                    Recalculating Scores...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-wand-magic-sparkles"></i>
                    Update & Re-match Jobs
                  </>
                )}
              </button>
              <p className="text-center mt-4 text-xs text-slate-400 italic">
                Our AI uses Gemini Pro to score your resume against all active job listings.
              </p>
            </div>
          </section>
        )}

        {activeNav === NavItem.Profile && (
           <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
             <h2 className="text-3xl font-extrabold text-[#1a1a3a] mb-6">User Profile</h2>
             <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100">
                <div className="flex items-center gap-6 mb-8">
                  <img src="https://picsum.photos/seed/steven/200/200" alt="Avatar" className="w-24 h-24 rounded-[2rem] object-cover ring-4 ring-indigo-50" />
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">{userProfile.name}</h3>
                    <p className="text-slate-500">{userProfile.email}</p>
                  </div>
                </div>

                <div className="space-y-6">
                   <div>
                     <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Display Name</label>
                     <input type="text" value={userProfile.name} className="w-full p-4 rounded-xl bg-slate-50 border-none font-semibold text-slate-900" readOnly />
                   </div>
                   <div>
                     <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Email Address</label>
                     <input type="email" value={userProfile.email} className="w-full p-4 rounded-xl bg-slate-50 border-none font-semibold text-slate-900" readOnly />
                   </div>
                   <div className="pt-4 flex gap-3">
                     <button className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors">Edit Profile</button>
                     <button className="flex-1 bg-rose-50 text-rose-600 py-3 rounded-xl font-bold hover:bg-rose-100 transition-colors">Sign Out</button>
                   </div>
                </div>
             </div>
           </section>
        )}
      </main>
    </div>
  );
};

export default App;
