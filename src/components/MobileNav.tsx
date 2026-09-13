import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { NAV_ITEMS } from './Sidebar';

export const MobileNav = () => {
  const location = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 flex z-50">
      {NAV_ITEMS.map(item => {
        const active = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-xs ${active ? 'text-emerald-400' : 'text-slate-400'}`}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};
