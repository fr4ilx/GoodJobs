
import React, { useState } from 'react';
import { UserPreferences } from '../types';

interface PreferencesPageProps {
  onComplete: (prefs: UserPreferences) => void;
}

const PreferencesPage: React.FC<PreferencesPageProps> = ({ onComplete }) => {
  const [prefs, setPrefs] = useState<UserPreferences>({
    jobTitle: '',
    location: '',
    workType: 'All',
    requiresSponsorship: false,
  });

  const categories = ['Software Engineering', 'Data Science', 'Product Management', 'Design', 'Marketing'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onComplete(prefs);
  };

  return (
    <div className="min-h-screen bg-[#f8f9fe] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-[40%] h-[40%] bg-indigo-100/50 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[30%] h-[30%] bg-purple-100/50 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-2xl relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 p-12 border border-slate-100">
          
          {/* Header & Progress */}
          <div className="mb-10 text-center">
             <div className="flex items-center justify-center gap-2 mb-6">
                <div className="w-8 h-1.5 rounded-full bg-indigo-600"></div>
                <div className="w-8 h-1.5 rounded-full bg-slate-100"></div>
                <div className="w-8 h-1.5 rounded-full bg-slate-100"></div>
             </div>
             <h2 className="text-3xl font-black text-slate-900 tracking-tight">Step 1: Your Preferences</h2>
             <p className="text-slate-500 font-medium mt-2">Let's refine what you're looking for.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Job Title */}
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Desired Job Title</label>
              <input 
                type="text" 
                required
                value={prefs.jobTitle}
                onChange={(e) => setPrefs({...prefs, jobTitle: e.target.value})}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-slate-900 font-bold placeholder:text-slate-300 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all" 
                placeholder="e.g. Senior Frontend Engineer" 
              />
              <div className="flex flex-wrap gap-2 pt-1">
                 {categories.slice(0, 3).map(cat => (
                   <button 
                     key={cat}
                     type="button"
                     onClick={() => setPrefs({...prefs, jobTitle: cat})}
                     className="text-[10px] font-black uppercase tracking-wider px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                   >
                     {cat}
                   </button>
                 ))}
              </div>
            </div>

            {/* Location */}
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Preferred Location</label>
              <div className="relative">
                <i className="fa-solid fa-location-dot absolute left-5 top-1/2 -translate-y-1/2 text-slate-300"></i>
                <input 
                  type="text" 
                  required
                  value={prefs.location}
                  onChange={(e) => setPrefs({...prefs, location: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-6 text-slate-900 font-bold placeholder:text-slate-300 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all" 
                  placeholder="e.g. San Francisco, CA or Remote" 
                />
              </div>
            </div>

            {/* Work Type & Sponsorship Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Work Environment</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Remote', 'Hybrid', 'On-site', 'All'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setPrefs({...prefs, workType: type as any})}
                      className={`py-3 rounded-xl text-sm font-bold transition-all border-2 ${
                        prefs.workType === type 
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' 
                          : 'bg-white border-slate-100 text-slate-500 hover:border-indigo-100'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Visa Sponsorship</label>
                <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100 relative h-[52px]">
                   <div 
                    className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-xl shadow-sm transition-all duration-300 ${prefs.requiresSponsorship ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0'}`}
                  ></div>
                  <button 
                    type="button"
                    onClick={() => setPrefs({...prefs, requiresSponsorship: false})}
                    className={`flex-1 relative z-10 text-xs font-black uppercase tracking-widest transition-colors ${!prefs.requiresSponsorship ? 'text-indigo-600' : 'text-slate-400'}`}
                  >
                    Not Needed
                  </button>
                  <button 
                    type="button"
                    onClick={() => setPrefs({...prefs, requiresSponsorship: true})}
                    className={`flex-1 relative z-10 text-xs font-black uppercase tracking-widest transition-colors ${prefs.requiresSponsorship ? 'text-indigo-600' : 'text-slate-400'}`}
                  >
                    Required
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 italic px-2">Do you require visa sponsorship to work in the target location?</p>
              </div>
            </div>

            <button 
              type="submit"
              className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-slate-200 hover:bg-indigo-600 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-4"
            >
              Continue to Resume
              <i className="fa-solid fa-arrow-right"></i>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PreferencesPage;
