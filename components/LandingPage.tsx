
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
          <div className="bg-indigo-600 rounded-xl p-2 shadow-lg shadow-indigo-100">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="font-black text-xl text-slate-900 tracking-tight">GoodJobs</span>
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
            <i className="fa-solid fa-wand-magic-sparkles"></i>
            Now Powered by Gemini 3 Pro
          </div>
          <h1 className="text-6xl md:text-8xl font-black text-slate-900 tracking-tight leading-[1.05] mb-8 animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-100">
            Stop applying blindly.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-500">
              Start matching intelligently.
            </span>
          </h1>
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-500 font-medium leading-relaxed mb-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
            The world's first AI-native job board. GoodJobs uses deep neural analysis to score your unique resume against thousands of listings in real-time.
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-10 rounded-[2.5rem] bg-slate-50 border border-slate-100 hover:border-indigo-100 hover:shadow-2xl hover:shadow-indigo-50 transition-all group">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm mb-8 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                <i className="fa-solid fa-bullseye text-2xl"></i>
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">Semantic Matching</h3>
              <p className="text-slate-500 font-medium leading-relaxed">
                We don't just search for keywords. Our AI understands the context of your achievements and maps them to technical requirements.
              </p>
            </div>

            <div className="p-10 rounded-[2.5rem] bg-slate-50 border border-slate-100 hover:border-indigo-100 hover:shadow-2xl hover:shadow-indigo-50 transition-all group">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-purple-600 shadow-sm mb-8 group-hover:bg-purple-600 group-hover:text-white transition-all">
                <i className="fa-solid fa-chart-line text-2xl"></i>
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">Precision Scoring</h3>
              <p className="text-slate-500 font-medium leading-relaxed">
                Get a transparent percentage score for every job post. Know exactly how you rank before you even hit apply.
              </p>
            </div>

            <div className="p-10 rounded-[2.5rem] bg-slate-50 border border-slate-100 hover:border-indigo-100 hover:shadow-2xl hover:shadow-indigo-50 transition-all group">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm mb-8 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                <i className="fa-solid fa-sparkles text-2xl"></i>
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">Resume Tuning</h3>
              <p className="text-slate-500 font-medium leading-relaxed">
                Receive instant AI-driven suggestions to optimize your resume for specific industries and high-growth sectors.
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
            <span>© 2025 GoodJobs AI Inc.</span>
            <a href="#" className="hover:text-indigo-600">Privacy Policy</a>
            <a href="#" className="hover:text-indigo-600">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
