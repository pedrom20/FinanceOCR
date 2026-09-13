import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { Sidebar } from './src/components/Sidebar';
import { MobileNav } from './src/components/MobileNav';
import { AuthPage } from './src/pages/AuthPage';
import { Dashboard } from './src/pages/Dashboard';
import { InvoiceList } from './src/pages/InvoiceList';
import { InvoiceUpload } from './src/pages/InvoiceUpload';
import { Reports } from './src/pages/Reports';

const AppShell = () => {
  const { user, loading, logout } = useAuth();

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-emerald-500" size={48} /></div>;

  if (!user) return <AuthPage />;

  return (
    <HashRouter>
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar user={user} onLogout={logout} />
        <main className="flex-1 md:ml-64 p-4 pb-24 md:p-10">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/invoices" element={<InvoiceList />} />
            <Route path="/upload" element={<InvoiceUpload />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
        <MobileNav />
      </div>
    </HashRouter>
  );
};

const App = () => (
  <AuthProvider>
    <AppShell />
  </AuthProvider>
);

export default App;
