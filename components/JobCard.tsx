
import React from 'react';
import { Job } from '../types';

interface JobCardProps {
  job: Job;
  onClick: () => void;
  onTrack?: () => void;
  isTracked?: boolean;
}

const JobCard: React.FC<JobCardProps> = ({ job, onClick, onTrack, isTracked }) => {
  const hasLogo = !!job.logo && job.logo.startsWith('http');
  return (
    <div 
      onClick={onClick}
      className="bg-white rounded-[2rem] p-6 mb-6 shadow-sm hover:shadow-lg transition-all cursor-pointer group flex items-center justify-between border border-transparent hover:border-indigo-100 relative overflow-hidden"
    >
      <div className="flex items-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-black overflow-hidden flex items-center justify-center p-3 group-hover:scale-105 transition-transform">
          {hasLogo ? (
            <img src={job.logo} alt={job.company} className="w-full h-full object-contain opacity-90" />
          ) : (
            <span className="text-white font-black text-xl">
              {job.company ? job.company.charAt(0).toUpperCase() : '?'}
            </span>
          )}
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors">{job.title}</h3>
          <p className="text-slate-500 font-medium text-sm">{job.company} • {job.location}</p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        {job.analysis?.keywordMatchScore !== undefined ? (
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col items-center justify-center min-w-[120px] transition-all group-hover:bg-indigo-50/50 group-hover:border-indigo-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Matching Score</span>
            <span className="text-2xl font-black text-slate-900 group-hover:text-indigo-600">{job.analysis.keywordMatchScore}%</span>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col items-center justify-center min-w-[120px] transition-all group-hover:bg-indigo-50/50 group-hover:border-indigo-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Matching Score</span>
            <span className="text-2xl font-black text-slate-400">?</span>
          </div>
        )}
        
        <div className="flex items-center gap-3">
          {onTrack && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onTrack();
              }}
              disabled={!!isTracked}
              className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                isTracked 
                  ? 'bg-emerald-50 text-emerald-600' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100'
              }`}
            >
              {isTracked ? 'Tracked' : 'Track Job'}
            </button>
          )}
          <div className="text-slate-200 group-hover:text-indigo-600 transition-colors">
            <i className="fa-solid fa-chevron-right text-lg"></i>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobCard;
