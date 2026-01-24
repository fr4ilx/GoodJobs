
import React from 'react';
import { Job } from '../types';

interface JobCardProps {
  job: Job;
  onClick: () => void;
}

const JobCard: React.FC<JobCardProps> = ({ job, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className="bg-white rounded-[2rem] p-6 mb-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer group flex items-center justify-between border border-transparent hover:border-indigo-100"
    >
      <div className="flex items-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
          <span className="text-white font-black text-xl">
            {job.company ? job.company.charAt(0).toUpperCase() : '?'}
          </span>
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900 mb-1">{job.title}</h3>
          <p className="text-indigo-600 font-bold text-sm mb-1">{job.company}</p>
          <p className="text-slate-500 font-medium text-xs">{job.location}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {job.matchScore !== undefined ? (
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col items-center justify-center min-w-[120px]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Matching Score</span>
            <span className="text-2xl font-black text-slate-900">{job.matchScore.toFixed(2)}%</span>
          </div>
        ) : (
          <div className="text-xs font-bold text-slate-300 italic">Score Pending...</div>
        )}
        <div className="text-slate-300 group-hover:text-indigo-600 transition-colors">
           <i className="fa-solid fa-chevron-right text-lg"></i>
        </div>
      </div>
    </div>
  );
};

export default JobCard;
