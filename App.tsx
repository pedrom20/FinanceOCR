import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { AppNav } from './src/components/AppNav';
import { AuthPage } from './src/pages/AuthPage';
import { Dashboard } from './src/pages/Dashboard';
import { InvoiceList } from './src/pages/InvoiceList';
import { InvoiceDetail } from './src/pages/InvoiceDetail';
import { InvoiceUpload } from './src/pages/InvoiceUpload';
import { Reports } from './src/pages/Reports';
import { Stores } from './src/pages/Stores';
import { Items } from './src/pages/Items';
import { AdminSettings } from './src/pages/AdminSettings';
import { Users } from './src/pages/Users';

const AppShell = () => {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center vh-100">
        <Spinner animation="border" variant="success" />
      </div>
    );
  }

  if (!user) return <AuthPage />;

  return (
    <HashRouter>
      <AppNav user={user} onLogout={logout} />
      <main className="app-main container-fluid px-3 px-md-4 py-4">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/invoices" element={<InvoiceList />} />
          <Route path="/invoices/:id" element={<InvoiceDetail />} />
          <Route path="/upload" element={<InvoiceUpload />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/stores" element={<Stores />} />
          <Route path="/items" element={<Items />} />
          <Route path="/settings" element={user.role === 'admin' ? <AdminSettings /> : <Navigate to="/" />} />
          <Route path="/users" element={user.role === 'admin' ? <Users /> : <Navigate to="/" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </HashRouter>
  );
};

const App = () => (
  <AuthProvider>
    <AppShell />
  </AuthProvider>
);

export default App;
