
import React from 'react';
import { NavItem } from '../types';

interface SidebarProps {
  activeItem: NavItem;
  onNavigate: (item: NavItem) => void;
  onSignOut: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeItem, onNavigate, onSignOut }) => {
  const items: Array<{ name: NavItem; icon: string; displayName: string }> = [
    { name: NavItem.Jobs, icon: 'fa-briefcase', displayName: 'Jobs' },
    { name: NavItem.Resume, icon: 'fa-file-lines', displayName: 'Resume & Projects' },
    { name: NavItem.VisualizeSkills, icon: 'fa-diagram-project', displayName: 'Visualize Skills' },
    { name: NavItem.Profile, icon: 'fa-circle-user', displayName: 'Profile' },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen fixed top-0 left-0 z-50">
      <div className="p-8 flex items-center gap-3">
        <div className="bg-indigo-600 rounded-xl p-2.5 shadow-lg shadow-indigo-100">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-xl text-indigo-900 leading-none">GoodJobs</span>
          <span className="text-[10px] font-bold text-indigo-500 tracking-widest uppercase mt-0.5">Dashboard</span>
        </div>
      </div>

      <nav className="flex-1 px-4 mt-6">
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.name}>
              <button
                onClick={() => onNavigate(item.name)}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 group ${
                  activeItem === item.name
                    ? 'bg-indigo-50 text-indigo-600 border-r-4 border-indigo-600 rounded-r-none'
                    : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                }`}
              >
                <span className="w-5 flex-shrink-0 flex items-center justify-center">
                  <i className={`fa-solid ${item.icon} text-lg transition-transform duration-200 group-hover:scale-110 ${activeItem === item.name ? 'text-indigo-600' : 'text-slate-300'}`}></i>
                </span>
                {item.displayName}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-6 mt-auto space-y-3">
        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-[2rem] p-5 text-white shadow-xl">
          <p className="text-[9px] font-black uppercase tracking-widest opacity-80 mb-1.5">Current Plan</p>
          <h3 className="text-lg font-black mb-0.5">Premium</h3>
          <p className="text-[10px] opacity-80 font-medium mb-3">Unlimited AI matching</p>
          <button className="w-full bg-white/20 hover:bg-white/30 text-white py-2 rounded-xl text-xs font-bold transition-all backdrop-blur-sm">
            Manage Plan
          </button>
        </div>
        
        {/* Sign Out Button */}
        <button 
          onClick={onSignOut}
          className="w-full bg-rose-50 text-rose-600 py-3 rounded-[1.5rem] font-bold text-sm hover:bg-rose-100 active:scale-95 transition-all flex items-center justify-center gap-2 border-2 border-rose-100 shadow-sm"
        >
          <i className="fa-solid fa-arrow-right-from-bracket"></i>
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
