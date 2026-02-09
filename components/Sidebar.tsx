
import React from 'react';
import { NavItem } from '../types';

interface SidebarProps {
  activeItem: NavItem;
  onNavigate: (item: NavItem) => void;
  onSignOut: () => void;
  onResetForDemo?: () => void;
  isResettingDemo?: boolean;
}

const BLOCK_1: Array<{ name: NavItem; icon: string; displayName: string }> = [
  { name: NavItem.Resume, icon: 'fa-file-lines', displayName: 'Resume & Projects' },
  { name: NavItem.VisualizeSkills, icon: 'fa-diagram-project', displayName: 'Visualize Skills' },
  { name: NavItem.Profile, icon: 'fa-circle-user', displayName: 'Profile' },
];

const BLOCK_2: Array<{ name: NavItem; icon: string; displayName: string }> = [
  { name: NavItem.Jobs, icon: 'fa-briefcase', displayName: 'Jobs' },
  { name: NavItem.Track, icon: 'fa-table-columns', displayName: 'Current Progress' },
  { name: NavItem.Customize, icon: 'fa-pen-nib', displayName: 'Customize' },
  { name: NavItem.Connect, icon: 'fa-comments', displayName: 'Connect' },
];

const NavBlock: React.FC<{
  items: Array<{ name: NavItem; icon: string; displayName: string }>;
  activeItem: NavItem;
  onNavigate: (item: NavItem) => void;
}> = ({ items, activeItem, onNavigate }) => (
  <div className="rounded-[1.75rem] bg-gradient-to-b from-slate-50 to-slate-100/50 border border-slate-200/60 p-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.8)]">
    {items.map((item) => (
      <button
        key={item.name}
        onClick={() => onNavigate(item.name)}
        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group ${
          activeItem === item.name
            ? 'bg-white text-indigo-600 shadow-md border border-indigo-100/80'
            : 'text-slate-500 hover:bg-white/70 hover:text-slate-700 border border-transparent'
        }`}
      >
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
          activeItem === item.name ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
        }`}>
          <i className={`fa-solid ${item.icon} text-sm`}></i>
        </span>
        {item.displayName}
      </button>
    ))}
  </div>
);

const Sidebar: React.FC<SidebarProps> = ({ activeItem, onNavigate, onSignOut, onResetForDemo, isResettingDemo }) => {
  return (
    <aside className="w-72 bg-white border-r border-slate-200 flex flex-col h-screen fixed top-0 left-0 z-50">
      <div className="p-8 flex items-center gap-3">
        <img src="/jobstudio-logo.png" alt="Job Studio" className="w-10 h-10 rounded-xl object-contain flex-shrink-0" />
        <div className="flex flex-col">
          <span className="font-bold text-xl text-indigo-900 leading-none">Job Studio</span>
          <span className="text-[10px] font-bold text-indigo-500 tracking-widest uppercase mt-0.5">Dashboard</span>
        </div>
      </div>

      <nav className="flex-1 px-4 mt-6 space-y-6 overflow-y-auto">
        <NavBlock items={BLOCK_1} activeItem={activeItem} onNavigate={onNavigate} />
        <NavBlock items={BLOCK_2} activeItem={activeItem} onNavigate={onNavigate} />
      </nav>

      <div className="p-6 mt-auto space-y-3">
        <div className="rounded-[1.75rem] bg-gradient-to-br from-indigo-600 to-purple-600 p-5 text-white shadow-xl border border-indigo-500/20 shadow-indigo-200/30">
          <p className="text-[9px] font-black uppercase tracking-widest opacity-80 mb-1.5">Current Plan</p>
          <h3 className="text-lg font-black mb-0.5">Premium</h3>
          <p className="text-[10px] opacity-80 font-medium mb-3">Unlimited AI matching</p>
          <button className="w-full bg-white/20 hover:bg-white/30 text-white py-2 rounded-xl text-xs font-bold transition-all backdrop-blur-sm">
            Manage Plan
          </button>
        </div>
        
        {onResetForDemo && (
          <button
            onClick={onResetForDemo}
            disabled={isResettingDemo}
            className="w-full bg-amber-50 text-amber-700 py-2.5 rounded-[1.5rem] font-bold text-xs hover:bg-amber-100 active:scale-95 transition-all flex items-center justify-center gap-2 border-2 border-amber-200 disabled:opacity-50"
          >
            <i className="fa-solid fa-rotate-right text-sm"></i>
            {isResettingDemo ? 'Clearing...' : 'Reset for Demo'}
          </button>
        )}
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
