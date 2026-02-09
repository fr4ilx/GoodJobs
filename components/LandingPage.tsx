
import React from 'react';

interface LandingPageProps {
  onStart: (mode: 'login' | 'signup') => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  return (
    <div className="min-h-screen bg-[#fcfdff] overflow-hidden selection:bg-indigo-100 selection:text-indigo-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-xl border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/jobstudio-logo.png" alt="Job Studio" className="w-9 h-9 rounded-xl object-contain flex-shrink-0" />
          <span className="font-black text-xl text-slate-900 tracking-tight">Job Studio</span>
        </div>
        <div className="flex items-center gap-4 md:gap-8">
          <a href="#" className="hidden md:block text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors">Features</a>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => onStart('login')}
              className="text-sm font-bold text-slate-600 hover:text-indigo-600 px-4 py-2.5 transition-colors"
            >
              Sign In
            </button>
            <button 
              onClick={() => onStart('signup')}
              className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-600 transition-all shadow-xl shadow-slate-200"
            >
              Join Now!
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6">
        {/* Background blobs */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[500px] h-[500px] bg-indigo-100/50 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[400px] h-[400px] bg-purple-100/50 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="max-w-6xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-600 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest mb-8 animate-in fade-in slide-in-from-top-4 duration-1000">
            <i className="fa-solid fa-briefcase"></i>
            Job search & project management for entry-level engineers
          </div>
          <h1 className="text-6xl md:text-8xl font-black text-slate-900 tracking-tight leading-[1.05] mb-8 animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-100">
            Track jobs. Tailor resumes.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-500">
              Get referred, not lost in the pile.
            </span>
          </h1>
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-500 font-medium leading-relaxed mb-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
            79% of jobs are filled through networking. Job Studio helps you manage your pipeline—from matching to roles and tailoring your resume to building the connections that lead to warm introductions and referrals.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-300">
            <button 
              onClick={() => onStart('signup')}
              className="w-full sm:w-auto bg-indigo-600 text-white px-10 py-5 rounded-2xl font-black text-lg shadow-2xl shadow-indigo-200 hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              Join Now!
              <i className="fa-solid fa-arrow-right"></i>
            </button>
            <button 
              onClick={() => onStart('login')}
              className="w-full sm:w-auto bg-white border border-slate-200 text-slate-900 px-10 py-5 rounded-2xl font-black text-lg hover:border-indigo-200 transition-all flex items-center justify-center gap-3"
            >
              Sign In
              <i className="fa-solid fa-user-check text-xs"></i>
            </button>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="px-6 py-20 bg-white">
        <div className="max-w-7xl mx-auto">
          <p className="text-slate-400 font-bold mb-2 text-xs uppercase tracking-[0.3em] text-center">How it works</p>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight text-center mb-12">One workflow: track, tailor, connect</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-10 rounded-[2.5rem] bg-slate-50 border border-slate-100 hover:border-indigo-100 hover:shadow-2xl hover:shadow-indigo-50 transition-all group">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm mb-8 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                <i className="fa-solid fa-table-columns text-2xl"></i>
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">Pipeline & Tracking</h3>
              <p className="text-slate-500 font-medium leading-relaxed">
                Track jobs from saved to customize, connect, apply, and done. One place to manage your entire search so nothing slips through the cracks.
              </p>
            </div>

            <div className="p-10 rounded-[2.5rem] bg-slate-50 border border-slate-100 hover:border-indigo-100 hover:shadow-2xl hover:shadow-indigo-50 transition-all group">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-purple-600 shadow-sm mb-8 group-hover:bg-purple-600 group-hover:text-white transition-all">
                <i className="fa-solid fa-pen-nib text-2xl"></i>
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">Tailored Resumes</h3>
              <p className="text-slate-500 font-medium leading-relaxed">
                AI tailors your resume to each role so you highlight the right projects and skills. One portfolio, many targeted versions—ready when a referral turns into an application.
              </p>
            </div>

            <div className="p-10 rounded-[2.5rem] bg-slate-50 border border-slate-100 hover:border-indigo-100 hover:shadow-2xl hover:shadow-indigo-50 transition-all group">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm mb-8 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                <i className="fa-solid fa-comments text-2xl"></i>
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">Connect & Referrals</h3>
              <p className="text-slate-500 font-medium leading-relaxed">
                Add contacts, find emails, and draft outreach for each job. Referrals are 5x more likely to get hired—Job Studio helps you build the connections that lead there.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <footer className="px-6 py-12 border-t border-slate-100 bg-slate-50/50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">Powered By</span>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-white rounded-full shadow-sm border border-slate-100">
               <div className="w-2 h-2 rounded-full bg-blue-500"></div>
               <span className="text-xs font-bold text-slate-600">Google Gemini</span>
            </div>
          </div>
          <div className="flex gap-8 text-xs font-bold text-slate-400">
            <span>© 2025 Job Studio</span>
            <a href="#" className="hover:text-indigo-600">Privacy Policy</a>
            <a href="#" className="hover:text-indigo-600">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
