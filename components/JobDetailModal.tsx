
import React from 'react';
import { Job } from '../types';

interface JobDetailModalProps {
  job: Job;
  onClose: () => void;
  onTrack?: () => void;
  isTracked?: boolean;
}

const JobDetailModal: React.FC<JobDetailModalProps> = ({ job, onClose, onTrack, isTracked }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-end p-4 sm:p-6 lg:p-10">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-2xl h-full bg-white rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right-full duration-500 ease-out">
        
        {/* Header Section */}
        <div className="p-8 pb-4 flex justify-between items-start">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-[1.5rem] bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-black text-3xl">
                {job.company ? job.company.charAt(0).toUpperCase() : '?'}
              </span>
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-900 leading-tight">{job.title}</h2>
              <p className="text-indigo-600 font-bold text-lg">{job.company}</p>
              <p className="text-slate-500 font-medium text-sm">{job.location}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all"
          >
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-8 pt-4 space-y-10 custom-scrollbar">
          
          {/* Quick Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Location</p>
              <p className="font-bold text-slate-700">{job.location}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Employment</p>
              <p className="font-bold text-slate-700">{job.type}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2 sm:col-span-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Category</p>
              <p className="font-bold text-slate-700">{job.category}</p>
            </div>
          </div>

          {/* AI Matching Analysis */}
          {job.matchScore !== undefined && (
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-xl shadow-indigo-100">
              <div className="absolute top-0 right-0 p-6 opacity-10">
                <i className="fa-solid fa-wand-magic-sparkles text-8xl"></i>
              </div>
              
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-white/20 p-2 rounded-lg backdrop-blur-md">
                    <i className="fa-solid fa-robot text-sm"></i>
                  </div>
                  <span className="text-xs font-black uppercase tracking-[0.2em]">Gemini AI Match Analysis</span>
                </div>
                
                <div className="flex items-end gap-4 mb-6">
                  <span className="text-6xl font-black leading-none">{job.matchScore.toFixed(0)}%</span>
                  <span className="text-sm font-bold opacity-80 mb-2">Likelihood of compatibility</span>
                </div>

                <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/10">
                  <p className="text-sm font-medium leading-relaxed italic">"{job.matchReason}"</p>
                </div>
              </div>
            </div>
          )}

          {/* Job Description Section */}
          <div className="space-y-4">
            <h4 className="text-xl font-black text-slate-900 flex items-center gap-3">
              <i className="fa-solid fa-align-left text-indigo-500 text-sm"></i>
              Job Description
            </h4>
            <div 
              className="text-slate-600 leading-relaxed font-medium whitespace-pre-wrap"
              style={{
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
                maxWidth: '100%'
              }}
            >
              {job.description}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
          {job.jobUrl ? (
            <a 
              href={job.jobUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-indigo-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all text-center"
            >
              Apply Now
            </a>
          ) : (
            <button 
              disabled
              className="flex-1 bg-slate-300 text-white py-5 rounded-2xl font-black text-lg cursor-not-allowed opacity-50"
            >
              Apply Now
            </button>
          )}
          {onTrack && (
            <button 
              onClick={onTrack}
              disabled={!!isTracked}
              className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center transition-all ${isTracked ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-100'}`}
            >
              {isTracked ? <i className="fa-solid fa-check text-xl"></i> : <i className="fa-solid fa-list-check text-xl"></i>}
            </button>
          )}
        </div>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
};

export default JobDetailModal;
