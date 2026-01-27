import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  UploadCloud, 
  FileText, 
  PieChart, 
  LogOut, 
  Menu, 
  X,
  Receipt,
  Plus,
  Save,
  Trash2,
  Download
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell
} from 'recharts';
import { Invoice, InvoiceItem, ReportData } from './types';

// --- MOCK SERVICE FOR DEMONSTRATION IN BROWSER ---
// In a real scenario, these would fetch from the PHP API provided in backend/ folder
const mockUploadInvoice = async (file: File): Promise<Invoice> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Simulation of OCR result
      resolve({
        invoice_number: "FT " + Math.floor(Math.random() * 10000),
        invoice_date: new Date().toISOString().split('T')[0],
        store_name: "Supermercado Exemplo Lda",
        nif: "123456789",
        total_amount: 45.50,
        payment_method: "MBWAY",
        items: [
          { product_name: "Leite UHT", quantity: 2, unit_price: 0.85, total_price: 1.70 },
          { product_name: "Pão de Forma", quantity: 1, unit_price: 1.50, total_price: 1.50 },
        ]
      });
    }, 1500);
  });
};

// --- COMPONENTS ---

const Sidebar = ({ isOpen, toggleSidebar }: { isOpen: boolean; toggleSidebar: () => void }) => {
  const location = useLocation();
  const navItems = [
    { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { path: '/invoices', label: 'Faturas', icon: <FileText size={20} /> },
    { path: '/upload', label: 'Carregar Fatura', icon: <UploadCloud size={20} /> },
    { path: '/reports', label: 'Relatórios', icon: <PieChart size={20} /> },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black bg-opacity-50 md:hidden"
          onClick={toggleSidebar}
        ></div>
      )}
      
      {/* Sidebar Content */}
      <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:inset-auto ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-2 font-bold text-xl">
            <Receipt className="text-emerald-400" />
            <span>FinOCR</span>
          </div>
          <button onClick={toggleSidebar} className="md:hidden">
            <X size={24} />
          </button>
        </div>
        
        <nav className="mt-8 space-y-2 px-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => window.innerWidth < 768 && toggleSidebar()}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                location.pathname === item.path 
                  ? 'bg-emerald-600 text-white' 
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-slate-700">
          <button className="flex items-center gap-3 text-slate-400 hover:text-white transition-colors w-full">
            <LogOut size={20} />
            <span>Sair</span>
          </button>
        </div>
      </div>
    </>
  );
};

const Dashboard = () => {
  const data = [
    { name: 'Jan', total: 400 },
    { name: 'Fev', total: 300 },
    { name: 'Mar', total: 600 },
    { name: 'Abr', total: 200 },
    { name: 'Mai', total: 500 },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500 mb-1">Total Gasto (Mês)</p>
          <h2 className="text-3xl font-bold text-slate-800">543,20 €</h2>
          <span className="text-xs text-emerald-500 font-medium">+12% vs mês anterior</span>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500 mb-1">Faturas Processadas</p>
          <h2 className="text-3xl font-bold text-slate-800">24</h2>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500 mb-1">Top Categoria</p>
          <h2 className="text-3xl font-bold text-slate-800">Alimentação</h2>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-semibold mb-6 text-slate-700">Despesas por Mês</h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: '#f1f5f9' }} />
              <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const InvoiceUpload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [invoiceData, setInvoiceData] = useState<Invoice | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleProcess = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      // In production: const formData = new FormData(); formData.append('invoice', file); 
      // await fetch('/api/invoices/upload', { method: 'POST', body: formData });
      const data = await mockUploadInvoice(file);
      setInvoiceData(data);
    } catch (error) {
      console.error("Erro ao processar", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    if (!invoiceData) return;
    const newItems = [...invoiceData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Recalculate total if quantity or price changes
    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].total_price = Number((newItems[index].quantity * newItems[index].unit_price).toFixed(2));
    }

    // Recalculate Invoice Total
    const newTotal = newItems.reduce((sum, item) => sum + item.total_price, 0);

    setInvoiceData({ ...invoiceData, items: newItems, total_amount: newTotal });
  };

  const addItem = () => {
    if (!invoiceData) return;
    setInvoiceData({
      ...invoiceData,
      items: [...invoiceData.items, { product_name: '', quantity: 1, unit_price: 0, total_price: 0 }]
    });
  };

  const removeItem = (index: number) => {
    if (!invoiceData) return;
    const newItems = invoiceData.items.filter((_, i) => i !== index);
    const newTotal = newItems.reduce((sum, item) => sum + item.total_price, 0);
    setInvoiceData({ ...invoiceData, items: newItems, total_amount: newTotal });
  };

  const handleSave = async () => {
    alert("Fatura guardada com sucesso! (Simulado)");
    setFile(null);
    setInvoiceData(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Carregar Fatura</h1>

      {!invoiceData ? (
        <div className="bg-white p-10 rounded-xl shadow-sm border-2 border-dashed border-slate-300 hover:border-emerald-500 transition-colors flex flex-col items-center justify-center text-center">
          <UploadCloud size={64} className="text-slate-400 mb-4" />
          <h3 className="text-xl font-medium text-slate-700 mb-2">Arraste ou selecione a fatura</h3>
          <p className="text-slate-500 mb-6">Suporta PDF, JPG, PNG</p>
          <input 
            type="file" 
            id="file-upload" 
            className="hidden" 
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileChange}
          />
          <label 
            htmlFor="file-upload" 
            className="bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-emerald-700 cursor-pointer transition-colors"
          >
            Selecionar Ficheiro
          </label>
          {file && (
            <div className="mt-4 w-full max-w-sm">
              <p className="text-sm font-medium text-slate-700 mb-2">Ficheiro selecionado: {file.name}</p>
              <button 
                onClick={handleProcess}
                disabled={isProcessing}
                className="w-full bg-slate-800 text-white py-2 rounded-lg hover:bg-slate-900 disabled:opacity-50"
              >
                {isProcessing ? 'A processar OCR...' : 'Extrair Dados'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h2 className="font-bold text-lg text-slate-800">Validar Extração</h2>
            <button onClick={() => setInvoiceData(null)} className="text-sm text-red-600 hover:text-red-700">Cancelar</button>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Loja</label>
              <input 
                type="text" 
                value={invoiceData.store_name} 
                onChange={(e) => setInvoiceData({...invoiceData, store_name: e.target.value})}
                className="w-full border border-slate-300 rounded px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">NIF</label>
              <input 
                type="text" 
                value={invoiceData.nif}
                onChange={(e) => setInvoiceData({...invoiceData, nif: e.target.value})}
                className="w-full border border-slate-300 rounded px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Número Fatura</label>
              <input 
                type="text" 
                value={invoiceData.invoice_number}
                onChange={(e) => setInvoiceData({...invoiceData, invoice_number: e.target.value})}
                className="w-full border border-slate-300 rounded px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
              <input 
                type="date" 
                value={invoiceData.invoice_date}
                onChange={(e) => setInvoiceData({...invoiceData, invoice_date: e.target.value})}
                className="w-full border border-slate-300 rounded px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none" 
              />
            </div>
          </div>

          <div className="p-6 border-t border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-slate-800">Artigos</h3>
              <button onClick={addItem} className="flex items-center gap-1 text-sm text-emerald-600 font-medium">
                <Plus size={16} /> Adicionar
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-2">Produto</th>
                    <th className="px-4 py-2 w-24">Qtd</th>
                    <th className="px-4 py-2 w-32">Preço Unit.</th>
                    <th className="px-4 py-2 w-32">Total</th>
                    <th className="px-4 py-2 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceData.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-50">
                      <td className="px-4 py-2">
                        <input 
                          type="text" 
                          value={item.product_name} 
                          onChange={(e) => handleItemChange(idx, 'product_name', e.target.value)}
                          className="w-full bg-transparent outline-none focus:border-b border-emerald-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input 
                          type="number" 
                          value={item.quantity} 
                          onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value))}
                          className="w-full bg-transparent outline-none focus:border-b border-emerald-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input 
                          type="number" 
                          step="0.01"
                          value={item.unit_price} 
                          onChange={(e) => handleItemChange(idx, 'unit_price', parseFloat(e.target.value))}
                          className="w-full bg-transparent outline-none focus:border-b border-emerald-500"
                        />
                      </td>
                      <td className="px-4 py-2 font-medium">
                        {item.total_price.toFixed(2)} €
                      </td>
                      <td className="px-4 py-2">
                        <button onClick={() => removeItem(idx)} className="text-slate-400 hover:text-red-500">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end mt-4 text-xl font-bold text-slate-800">
              Total: {invoiceData.total_amount.toFixed(2)} €
            </div>
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
             <button 
               onClick={handleSave}
               className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
             >
               <Save size={18} /> Confirmar e Guardar
             </button>
          </div>
        </div>
      )}
    </div>
  );
};

const InvoiceList = () => {
  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Minhas Faturas</h1>
        <div className="flex gap-2">
          <input type="date" className="border border-slate-300 rounded px-3 py-1.5 text-sm" />
          <input type="text" placeholder="Filtrar por loja..." className="border border-slate-300 rounded px-3 py-1.5 text-sm" />
        </div>
       </div>

       <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
         <table className="w-full text-left text-sm text-slate-600">
           <thead className="bg-slate-50 font-medium text-slate-700">
             <tr>
               <th className="px-6 py-3">Data</th>
               <th className="px-6 py-3">Loja</th>
               <th className="px-6 py-3">Nº Fatura</th>
               <th className="px-6 py-3">Método</th>
               <th className="px-6 py-3 text-right">Total</th>
               <th className="px-6 py-3 text-center">Ações</th>
             </tr>
           </thead>
           <tbody className="divide-y divide-slate-100">
             {/* Example Rows */}
             <tr className="hover:bg-slate-50">
               <td className="px-6 py-3">2023-10-25</td>
               <td className="px-6 py-3 font-medium text-slate-800">Continente</td>
               <td className="px-6 py-3">FT 2023/1293</td>
               <td className="px-6 py-3"><span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">Visa</span></td>
               <td className="px-6 py-3 text-right font-bold">124.50 €</td>
               <td className="px-6 py-3 text-center">
                 <button className="text-emerald-600 hover:text-emerald-800 font-medium text-xs">Ver Detalhes</button>
               </td>
             </tr>
             <tr className="hover:bg-slate-50">
               <td className="px-6 py-3">2023-10-22</td>
               <td className="px-6 py-3 font-medium text-slate-800">IKEA</td>
               <td className="px-6 py-3">FT 99999</td>
               <td className="px-6 py-3"><span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">MBWAY</span></td>
               <td className="px-6 py-3 text-right font-bold">45.00 €</td>
               <td className="px-6 py-3 text-center">
                 <button className="text-emerald-600 hover:text-emerald-800 font-medium text-xs">Ver Detalhes</button>
               </td>
             </tr>
           </tbody>
         </table>
       </div>
    </div>
  );
};

const Reports = () => {
  const dataPie = [
    { name: 'Alimentação', value: 400 },
    { name: 'Casa', value: 300 },
    { name: 'Transporte', value: 200 },
    { name: 'Lazer', value: 100 },
  ];
  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

  const handleExportPDF = () => {
    // In production: window.open('/api/reports/export?type=pdf', '_blank');
    alert("Inicia download do PDF gerado pelo backend PHP...");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Relatórios</h1>
        <button 
          onClick={handleExportPDF}
          className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-900"
        >
          <Download size={16} /> Exportar PDF
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold mb-6 text-slate-700">Gastos por Categoria (Lojas)</h3>
          <div className="h-64 w-full flex justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie
                  data={dataPie}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {dataPie.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </RePieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
           <h3 className="text-lg font-semibold mb-4 text-slate-700">Top Artigos</h3>
           <ul className="space-y-3">
             <li className="flex justify-between items-center p-3 bg-slate-50 rounded">
               <span className="font-medium text-slate-700">Leite UHT Meio Gordo</span>
               <span className="text-emerald-600 font-bold">45 Unid.</span>
             </li>
             <li className="flex justify-between items-center p-3 bg-slate-50 rounded">
               <span className="font-medium text-slate-700">Café Delta</span>
               <span className="text-emerald-600 font-bold">12 Unid.</span>
             </li>
             <li className="flex justify-between items-center p-3 bg-slate-50 rounded">
               <span className="font-medium text-slate-700">Arroz Agulha</span>
               <span className="text-emerald-600 font-bold">10 Unid.</span>
             </li>
           </ul>
        </div>
      </div>
    </div>
  );
};

const MainLayout = ({ children }: { children: React.ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar isOpen={sidebarOpen} toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm h-16 flex items-center px-6 md:hidden">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-600">
            <Menu size={24} />
          </button>
          <span className="ml-4 font-bold text-lg text-slate-800">FinOCR</span>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <HashRouter>
      <MainLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/invoices" element={<InvoiceList />} />
          <Route path="/upload" element={<InvoiceUpload />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MainLayout>
    </HashRouter>
  );
};

export default App;