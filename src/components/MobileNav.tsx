import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { NAV_ITEMS, ADMIN_NAV_ITEM } from './Sidebar';
import { useAuth } from '../auth/AuthContext';

export const MobileNav = () => {
  const location = useLocation();
  const { user } = useAuth();
  const items = user?.role === 'admin' ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 flex z-50">
      {items.map(item => {
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
