import React, { useState } from 'react';
import { Receipt } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api';
import { GoogleSignInButton } from '../components/GoogleSignInButton';

export const AuthPage = () => {
  const { login, register, loginWithGoogle } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro de autenticação.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleCredential = async (credential: string) => {
    setError('');
    setSubmitting(true);
    try {
      await loginWithGoogle(credential);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro de autenticação com Google.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="p-8 bg-slate-900 text-white flex flex-col items-center">
          <div className="p-3 bg-emerald-500 rounded-xl mb-4">
            <Receipt size={32} />
          </div>
          <h1 className="text-2xl font-bold">FinOCR Manager</h1>
          <p className="text-slate-400 text-sm">Controle as suas finanças num piscar de olhos</p>
        </div>
        <div className="p-8">
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-slate-700">Nome</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full mt-1 px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500" required />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full mt-1 px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full mt-1 px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500" required minLength={6} />
            </div>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button disabled={submitting} className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50">
              {submitting ? 'A processar...' : isLogin ? 'Entrar' : 'Registar'}
            </button>
          </form>
          <button onClick={() => { setIsLogin(!isLogin); setError(''); }} className="w-full mt-4 text-sm text-slate-500 hover:text-emerald-600">
            {isLogin ? 'Não tem conta? Registe-se' : 'Já tem conta? Faça Login'}
          </button>
          <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
            <div className="flex-1 h-px bg-slate-200" />
            ou
            <div className="flex-1 h-px bg-slate-200" />
          </div>
          <GoogleSignInButton onCredential={handleGoogleCredential} />
        </div>
      </div>
    </div>
  );
};
