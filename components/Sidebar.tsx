
import React from 'react';
import { NavItem } from '../types';

interface SidebarProps {
  activeItem: NavItem;
  onNavigate: (item: NavItem) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeItem, onNavigate }) => {
  const items = [
    { name: NavItem.Jobs, icon: 'fa-briefcase' },
    { name: NavItem.Resume, icon: 'fa-file-lines' },
    { name: NavItem.Profile, icon: 'fa-circle-user' },
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
                <i className={`fa-solid ${item.icon} text-lg transition-transform duration-200 group-hover:scale-110 ${activeItem === item.name ? 'text-indigo-600' : 'text-slate-300'}`}></i>
                {item.name}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-6 mt-auto">
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
          <p className="text-xs font-medium text-slate-500 mb-1">Current Plan</p>
          <p className="text-sm font-bold text-slate-900">Premium Pro</p>
          <button className="mt-3 w-full bg-indigo-600 text-white py-2 text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors">
            Upgrade Now
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
