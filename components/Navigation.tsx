import React from 'react';
import { Home, Search, Plus, Wallet, User, Trophy, ShieldAlert } from 'lucide-react';
import { ViewState } from '../types';
import { translations, Language } from '../utils/translations';

interface NavigationProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
  lang: Language;
}

export const Navigation: React.FC<NavigationProps> = ({ currentView, setView, lang }) => {
  const t = translations[lang];

  const navItems = [
    { id: 'home', icon: Home, label: t.home },
    { id: 'search', icon: Search, label: t.search },
    { id: 'post', icon: Plus, label: t.post, isFab: true },
    { id: 'wallet', icon: Wallet, label: t.wallet },
    { id: 'profile', icon: User, label: t.profile },
  ];

  // Optional: Add Admin if needed via a hidden logic or different view, currently included in profile usually or specific route
  // For simplicity matching previous logic, we can keep Admin accessible or put it in profile. 
  // Let's keep it clean for the main dock.

  return (
    <div className="fixed bottom-6 left-0 w-full px-4 z-50 pointer-events-none">
      <nav className="glass mx-auto max-w-md rounded-[2rem] border border-white/50 shadow-2xl shadow-indigo-900/10 pointer-events-auto flex items-center justify-between px-2 py-2">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          const Icon = item.icon;
          
          if (item.isFab) {
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id as ViewState)}
                className="relative -top-6 mx-2 group"
                aria-label={item.label}
              >
                <div className="absolute inset-0 bg-secondary rounded-full blur-md opacity-40 group-hover:opacity-60 transition-opacity"></div>
                <div className="relative bg-gradient-to-tr from-primary to-secondary text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center transform transition-all active:scale-90 group-hover:-translate-y-1">
                  <Icon size={28} strokeWidth={2.5} />
                </div>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => setView(item.id as ViewState)}
              className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all ${isActive ? 'bg-indigo-50 text-primary scale-105' : 'text-slate-400 hover:text-slate-600'}`}
              aria-label={item.label}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              {isActive && <span className="text-[10px] font-bold mt-0.5">{item.label}</span>}
            </button>
          );
        })}
      </nav>
    </div>
  );
};