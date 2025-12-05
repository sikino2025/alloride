import React from 'react';
import { Home, Search, PlusCircle, Wallet, User, Trophy, ShieldAlert } from 'lucide-react';
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
    { id: 'post', icon: PlusCircle, label: t.post, highlight: true },
    { id: 'leaderboard', icon: Trophy, label: t.top },
    { id: 'wallet', icon: Wallet, label: t.wallet },
    { id: 'profile', icon: User, label: t.profile },
    { id: 'admin', icon: ShieldAlert, label: 'Admin' }, // Added Admin Tab
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 pb-safe pt-2 px-2 shadow-lg z-50">
      <div className="flex justify-around items-end pb-2">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          const Icon = item.icon;
          
          if (item.highlight) {
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id as ViewState)}
                className="flex flex-col items-center justify-center -mt-8"
                aria-label={item.label}
              >
                <div className="bg-primary text-white p-4 rounded-full shadow-lg shadow-indigo-300 transform transition-transform active:scale-95">
                  <Icon size={28} strokeWidth={2.5} />
                </div>
                <span className="text-xs font-medium text-primary mt-1">{item.label}</span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => setView(item.id as ViewState)}
              className={`flex flex-col items-center justify-center w-12 transition-colors ${isActive ? 'text-primary' : 'text-slate-400'}`}
              aria-label={item.label}
            >
              <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium mt-1">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};