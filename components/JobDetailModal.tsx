
import React from 'react';
import { Job } from '../types';

interface JobDetailModalProps {
  job: Job;
  onClose: () => void;
  onTrack?: () => void;
  isTracked?: boolean;
  mySkills?: string[];
}

const JobDetailModal: React.FC<JobDetailModalProps> = ({ job, onClose, onTrack, isTracked, mySkills = [] }) => {
  const mySkillsSet = new Set(mySkills.map(s => s.toLowerCase().trim()));
  const analysis = job.analysis;
  const matchedKeywords = analysis?.keywords?.filter(k => mySkillsSet.has(k.toLowerCase().trim())) ?? [];
  const missingKeywords = analysis?.keywords?.filter(k => !mySkillsSet.has(k.toLowerCase().trim())) ?? [];
  const displayScore = analysis?.keywordMatchScore ?? job.matchScore;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-end p-4 sm:p-6 lg:p-10">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Modal Content - Expanded with right panel */}
      <div className="relative w-full max-w-6xl h-full bg-white rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right-full duration-500 ease-out">
        
        {/* Header Section */}
        <div className="p-8 pb-4 flex justify-between items-start flex-shrink-0">
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

        {/* Main content: left (job) + right (fit analysis) */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Left: Job details */}
          <div className="flex-1 overflow-y-auto p-8 pt-2 space-y-6 custom-scrollbar border-r border-slate-100">
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

            {/* Keyword Match Score + Keywords */}
            {(displayScore !== undefined || analysis?.keywords?.length) ? (
              <div className="space-y-4">
                {displayScore !== undefined && (
                  <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[2rem] p-6 text-white relative overflow-hidden shadow-xl shadow-indigo-100">
                    <div className="flex items-end gap-4">
                      <span className="text-5xl font-black leading-none">{displayScore}%</span>
                      <span className="text-sm font-bold opacity-80 mb-1">Keyword match (skills you have / job keywords)</span>
                    </div>
                  </div>
                )}
                {analysis?.keywords?.length ? (
                  <div>
                    <h4 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <i className="fa-solid fa-tags text-indigo-500"></i>
                      Extracted keywords
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {matchedKeywords.map((k, i) => (
                        <span key={`ok-${i}`} className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-700 text-xs font-bold">
                          {k}
                        </span>
                      ))}
                      {missingKeywords.map((k, i) => (
                        <span key={`mk-${i}`} className="px-3 py-1.5 rounded-xl bg-blue-100 text-blue-700 text-xs font-bold">
                          {k}
                        </span>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2">
                      <span className="inline-block w-3 h-3 rounded-full bg-emerald-400 mr-1 align-middle"></span> You have
                      <span className="inline-block w-3 h-3 rounded-full bg-blue-400 ml-3 mr-1 align-middle"></span> Job requires
                    </p>
                  </div>
                ) : null}
              </div>
            ) : job.matchScore !== undefined && (
              <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-xl shadow-indigo-100">
                <div className="flex items-end gap-4 mb-6">
                  <span className="text-6xl font-black leading-none">{job.matchScore.toFixed(0)}%</span>
                  <span className="text-sm font-bold opacity-80 mb-2">AI Match Analysis</span>
                </div>
                {job.matchReason && (
                  <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/10">
                    <p className="text-sm font-medium leading-relaxed italic">"{job.matchReason}"</p>
                  </div>
                )}
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

          {/* Right panel: What looks good / What is missing */}
          {analysis && (analysis.whatLooksGood || analysis.whatIsMissing) && (
            <div className="w-[380px] flex-shrink-0 flex flex-col bg-slate-50/80 border-l border-slate-100">
              <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                <div>
                  <h4 className="text-sm font-black text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <i className="fa-solid fa-circle-check"></i>
                    What looks good
                  </h4>
                  <p className="text-sm text-slate-700 leading-relaxed font-medium">
                    {analysis.whatLooksGood || '—'}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-black text-blue-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <i className="fa-solid fa-lightbulb"></i>
                    What is missing
                  </h4>
                  <p className="text-sm text-slate-700 leading-relaxed font-medium">
                    {analysis.whatIsMissing || '—'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4 flex-shrink-0">
          {onTrack && (
            <button 
              onClick={onTrack}
              disabled={!!isTracked}
              className={`flex-1 py-5 rounded-2xl font-black text-lg shadow-xl transition-all text-center flex items-center justify-center gap-3 ${
                isTracked 
                  ? 'bg-emerald-50 border-2 border-emerald-200 text-emerald-600 shadow-emerald-100' 
                  : 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              {isTracked ? (
                <>
                  <i className="fa-solid fa-check text-xl"></i>
                  Tracked
                </>
              ) : (
                <>
                  <i className="fa-solid fa-list-check text-xl"></i>
                  Track Job
                </>
              )}
            </button>
          )}
          {job.jobUrl ? (
            <a 
              href={job.jobUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-5 rounded-2xl font-black text-sm border-2 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300 transition-all flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-external-link"></i>
              Apply Now
            </a>
          ) : (
            <button 
              disabled
              className="px-8 py-5 rounded-2xl font-black text-sm border-2 border-slate-100 text-slate-300 cursor-not-allowed"
            >
              <i className="fa-solid fa-external-link mr-2"></i>
              Apply Now
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
