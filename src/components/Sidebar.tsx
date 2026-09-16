import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, UploadCloud, FileText, PieChart, Store, Package, Settings, LogOut, Receipt, User as UserIcon } from 'lucide-react';
import { User } from '../types';

export const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { path: '/invoices', label: 'Faturas', icon: <FileText size={20} /> },
  { path: '/upload', label: 'Upload', icon: <UploadCloud size={20} /> },
  { path: '/reports', label: 'Relatórios', icon: <PieChart size={20} /> },
  { path: '/stores', label: 'Lojas', icon: <Store size={20} /> },
  { path: '/items', label: 'Artigos', icon: <Package size={20} /> },
];

export const ADMIN_NAV_ITEM = { path: '/settings', label: 'Definições', icon: <Settings size={20} /> };

export const Sidebar = ({ user, onLogout }: { user: User; onLogout: () => void }) => {
  const location = useLocation();
  const items = user.role === 'admin' ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS;

  return (
    <div className="hidden md:flex flex-col w-64 bg-slate-900 text-white h-screen fixed">
      <div className="p-6 flex items-center gap-3 border-b border-slate-800">
        <Receipt className="text-emerald-400" />
        <span className="font-bold text-xl">FinOCR</span>
      </div>
      <nav className="flex-1 mt-6 px-4 space-y-2">
        {items.map(item => (
          <Link key={item.path} to={item.path} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${location.pathname === item.path ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center"><UserIcon size={16} /></div>
          <span className="text-sm truncate">{user.email}</span>
        </div>
        <button onClick={onLogout} className="flex items-center gap-3 w-full px-4 py-2 text-slate-400 hover:text-red-400">
          <LogOut size={18} />
          <span>Sair</span>
        </button>
      </div>
    </div>
  );
};
