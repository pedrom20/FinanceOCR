/// <reference types="vite/client" />
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { 
  LayoutDashboard, UploadCloud, FileText, PieChart, LogOut, Receipt, Plus, Download, User as UserIcon, Loader2
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, addDoc, query, where, getDocs, orderBy, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { Invoice } from './types';

// Em produção (build), a API está no mesmo domínio (relativo). Em dev, usa localhost via Proxy ou direto.
const API_BASE_URL = import.meta.env.PROD ? "" : "http://localhost:3000";

// --- AUTH PAGE ---
const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message);
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
            <div>
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full mt-1 px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full mt-1 px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500" required />
            </div>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 transition-colors">
              {isLogin ? 'Entrar' : 'Registar'}
            </button>
          </form>
          <button onClick={() => setIsLogin(!isLogin)} className="w-full mt-4 text-sm text-slate-500 hover:text-emerald-600">
            {isLogin ? 'Não tem conta? Registe-se' : 'Já tem conta? Faça Login'}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- MAIN COMPONENTS ---
const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { path: '/invoices', label: 'Faturas', icon: <FileText size={20} /> },
  { path: '/upload', label: 'Upload', icon: <UploadCloud size={20} /> },
  { path: '/reports', label: 'Relatórios', icon: <PieChart size={20} /> },
];

const Sidebar = ({ user }: { user: any }) => {
  const location = useLocation();

  return (
    <div className="hidden md:flex flex-col w-64 bg-slate-900 text-white h-screen fixed">
      <div className="p-6 flex items-center gap-3 border-b border-slate-800">
        <Receipt className="text-emerald-400" />
        <span className="font-bold text-xl">FinOCR</span>
      </div>
      <nav className="flex-1 mt-6 px-4 space-y-2">
        {NAV_ITEMS.map(item => (
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
        <button onClick={() => signOut(auth)} className="flex items-center gap-3 w-full px-4 py-2 text-slate-400 hover:text-red-400">
          <LogOut size={18} />
          <span>Sair</span>
        </button>
      </div>
    </div>
  );
};

const MobileNav = () => {
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

const Dashboard = ({ userId }: { userId: string }) => {
  const [stats, setStats] = useState({ totalMonth: 0, count: 0 });
  const chartData = [{ name: 'Jan', total: 400 }, { name: 'Fev', total: 300 }, { name: 'Mar', total: 600 }];

  useEffect(() => {
    const fetchStats = async () => {
      const q = query(collection(db, 'invoices'), where('userId', '==', userId));
      const snap = await getDocs(q);
      let total = 0;
      snap.forEach(doc => total += doc.data().totalAmount || 0);
      setStats({ totalMonth: total, count: snap.size });
    };
    fetchStats();
  }, [userId]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-800">Olá de novo! 👋</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500">Gasto Total</p>
          <h2 className="text-3xl font-black text-slate-900 mt-1">{stats.totalMonth.toFixed(2)} €</h2>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500">Faturas Processadas</p>
          <h2 className="text-3xl font-black text-slate-900 mt-1">{stats.count}</h2>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 bg-emerald-50 border-emerald-100">
          <p className="text-sm text-emerald-700 font-medium">Economia Sugerida</p>
          <h2 className="text-3xl font-black text-emerald-900 mt-1">15%</h2>
        </div>
      </div>
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-700 mb-6">Histórico de Despesas</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} />
              <Tooltip cursor={{fill: '#f8fafc'}} />
              <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const InvoiceUpload = ({ userId }: { userId: string }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [invoice, setInvoice] = useState<any>(null);

  const handleProcess = async () => {
    if (!file) return;
    setLoading(true);
    try {
      // Envia o ficheiro diretamente para a API, que faz o OCR em memória
      // (sem passar pelo Firebase Storage, que exige o plano pago).
      const idToken = await auth.currentUser?.getIdToken();
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/api/ocr/process-invoice`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${idToken}` },
        body: formData
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error || 'Falha ao processar OCR');
      }
      const data = await response.json();
      setInvoice(data);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao processar ficheiro.");
    } finally {
      setLoading(false);
    }
  };

  const saveToFirestore = async () => {
    try {
      const docRef = await addDoc(collection(db, 'invoices'), {
        ...invoice,
        userId,
        createdAt: serverTimestamp()
      });
      // Adicionar itens se existirem
      if (invoice.items) {
        for (const item of invoice.items) {
          await addDoc(collection(db, 'invoices', docRef.id, 'invoiceItems'), item);
        }
      }
      alert("Fatura guardada com sucesso!");
      setInvoice(null);
      setFile(null);
    } catch (err) {
      alert("Erro ao guardar.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {!invoice ? (
        <div className="bg-white p-12 rounded-3xl shadow-sm border-2 border-dashed border-slate-200 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
            <UploadCloud size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Novo Documento</h2>
          <p className="text-slate-500 mb-8">Arraste a sua fatura ou selecione um ficheiro</p>
          <input type="file" accept="image/jpeg,image/png,image/webp,image/bmp,application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} className="mb-6 block mx-auto text-sm text-slate-500" />
          <button 
            disabled={!file || loading}
            onClick={handleProcess}
            className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-black disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" /> : <Plus size={20} />}
            {loading ? 'A ler com Tesseract...' : 'Processar Agora'}
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden border border-slate-100">
          <div className="p-6 bg-slate-50 border-b flex justify-between items-center">
            <h3 className="font-bold text-slate-800">Confirmar Dados Extraídos</h3>
            <button onClick={() => setInvoice(null)} className="text-red-500 text-sm">Cancelar</button>
          </div>
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-4">
                <div><label className="text-xs font-bold text-slate-400 uppercase">Loja</label><input className="w-full border-b py-2 outline-none focus:border-emerald-500" value={invoice.storeName} onChange={e => setInvoice({...invoice, storeName: e.target.value})} /></div>
                <div><label className="text-xs font-bold text-slate-400 uppercase">NIF</label><input className="w-full border-b py-2 outline-none focus:border-emerald-500" value={invoice.storeNif} onChange={e => setInvoice({...invoice, storeNif: e.target.value})} /></div>
             </div>
             <div className="space-y-4">
                <div><label className="text-xs font-bold text-slate-400 uppercase">Data</label><input type="date" className="w-full border-b py-2 outline-none focus:border-emerald-500" value={invoice.invoiceDate} onChange={e => setInvoice({...invoice, invoiceDate: e.target.value})} /></div>
                <div><label className="text-xs font-bold text-slate-400 uppercase">Total</label><input type="number" className="w-full border-b py-2 outline-none focus:border-emerald-500 text-2xl font-bold" value={invoice.totalAmount} onChange={e => setInvoice({...invoice, totalAmount: parseFloat(e.target.value)})} /></div>
             </div>
          </div>
          <div className="p-8 border-t bg-slate-50 flex justify-end">
            <button onClick={saveToFirestore} className="bg-emerald-600 text-white px-10 py-3 rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200">
              Guardar na Cloud
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const InvoiceList = ({ userId }: { userId: string }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const q = query(collection(db, 'invoices'), where('userId', '==', userId), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
      setInvoices(list);
    };
    fetch();
  }, [userId]);

  const downloadFile = async (fileName: string) => {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch(`${API_BASE_URL}/api/files/${encodeURIComponent(fileName)}`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (!response.ok) throw new Error('Falha ao descarregar ficheiro');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Erro ao descarregar ficheiro.');
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-800">Histórico de Compras</h1>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-sm uppercase">
              <th className="px-6 py-4">Data</th>
              <th className="px-6 py-4">Loja</th>
              <th className="px-6 py-4 text-right">Valor</th>
              <th className="px-6 py-4 text-center">Ficheiro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.map(inv => (
              <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-sm">{inv.invoiceDate}</td>
                <td className="px-6 py-4 font-bold text-slate-700">{inv.storeName}</td>
                <td className="px-6 py-4 text-right font-black text-emerald-600">{inv.totalAmount.toFixed(2)} €</td>
                <td className="px-6 py-4 text-center">
                  {inv.fileName && (
                    <button onClick={() => downloadFile(inv.fileName!)} className="text-slate-400 hover:text-emerald-500">
                      <Download size={18} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Reports = ({ userId }: { userId: string }) => {
  const [downloading, setDownloading] = useState(false);

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch(`${API_BASE_URL}/api/reports/pdf`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (!response.ok) throw new Error('Falha ao gerar relatório');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'relatorio-finocr.pdf';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Erro ao descarregar relatório.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="bg-white p-12 rounded-3xl shadow-sm text-center">
      <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
        <PieChart size={40} />
      </div>
      <h2 className="text-2xl font-bold mb-2">Relatórios Detalhados</h2>
      <p className="text-slate-500 mb-8 max-w-sm mx-auto">Gere um PDF profissional com todas as suas despesas para contabilidade ou controlo pessoal.</p>
      <button onClick={downloadPdf} disabled={downloading} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-3 mx-auto hover:bg-black disabled:opacity-50 transition-all">
        {downloading ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
        {downloading ? 'A gerar...' : 'Descarregar PDF (Gerado via Node.js)'}
      </button>
    </div>
  );
};

// --- APP ROOT ---
const App = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, u => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-emerald-500" size={48} /></div>;

  if (!user) return <AuthPage />;

  return (
    <HashRouter>
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar user={user} />
        <main className="flex-1 md:ml-64 p-4 pb-24 md:p-10">
          <Routes>
            <Route path="/" element={<Dashboard userId={user.uid} />} />
            <Route path="/invoices" element={<InvoiceList userId={user.uid} />} />
            <Route path="/upload" element={<InvoiceUpload userId={user.uid} />} />
            <Route path="/reports" element={<Reports userId={user.uid} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
        <MobileNav />
      </div>
    </HashRouter>
  );
};

export default App;