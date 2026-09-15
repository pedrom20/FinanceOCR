import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Download, Loader2, Filter } from 'lucide-react';
import { apiFetch, apiJson } from '../api';

interface ReportItem {
  invoiceId: string;
  invoiceDate: string;
  storeName: string;
  storeLocation?: string;
  productName: string;
  quantity: number;
  quantityUnit?: string;
  unitPrice: number;
  totalPrice: number;
  vatRate?: number | null;
  category?: string;
}

interface FiltersResponse {
  stores: string[];
  categories: string[];
}

function formatQuantity(quantity: number, unit?: string): string {
  if (unit === 'kg') {
    return `${quantity.toFixed(3).replace(/\.?0+$/, '')} kg`;
  }
  return `${quantity} un`;
}

export const Reports = () => {
  const [downloading, setDownloading] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FiltersResponse>({ stores: [], categories: [] });
  const [store, setStore] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [items, setItems] = useState<ReportItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiJson<FiltersResponse>('/api/reports/filters')
      .then(setFilterOptions)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      const params = new URLSearchParams();
      if (store) params.set('store', store);
      if (category) params.set('category', category);
      if (search) params.set('search', search);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      setLoading(true);
      setError('');
      apiJson<{ items: ReportItem[]; total: number }>(`/api/reports/items?${params.toString()}`)
        .then(data => {
          setItems(data.items);
          setTotal(data.total);
        })
        .catch(() => setError('Falha ao carregar relatório.'))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [store, category, search, dateFrom, dateTo]);

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const response = await apiFetch('/api/reports/pdf');
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

  const inputClass = 'w-full border-b py-2 outline-none focus:border-emerald-500 text-sm bg-transparent';

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 sm:p-12 rounded-3xl shadow-sm text-center">
        <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <PieChart size={40} />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold mb-2">Relatórios Detalhados</h2>
        <p className="text-slate-500 mb-8 max-w-sm mx-auto text-sm sm:text-base">Gere um PDF profissional com todas as suas despesas para contabilidade ou controlo pessoal.</p>
        <button onClick={downloadPdf} disabled={downloading} className="w-full sm:w-auto bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 mx-auto hover:bg-black disabled:opacity-50 transition-all">
          {downloading ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
          {downloading ? 'A gerar...' : 'Descarregar PDF'}
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 sm:p-6 bg-slate-50 border-b flex items-center gap-2">
          <Filter size={18} className="text-slate-400" />
          <h3 className="font-bold text-slate-800">Filtrar Despesas</h3>
        </div>

        <div className="p-4 sm:p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label className="text-xs font-bold text-slate-400 uppercase">Artigo</label>
            <input className={inputClass} placeholder="ex: limão" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase">Loja</label>
            <select className={inputClass} value={store} onChange={e => setStore(e.target.value)}>
              <option value="">Todas</option>
              {filterOptions.stores.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase">Categoria</label>
            <select className={inputClass} value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">Todas</option>
              {filterOptions.categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase">De</label>
            <input type="date" className={inputClass} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase">Até</label>
            <input type="date" className={inputClass} value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        </div>

        <div className="px-4 sm:px-6 pb-2 flex items-center justify-between">
          <span className="text-sm text-slate-400">{items.length} artigo{items.length !== 1 ? 's' : ''}</span>
          <span className="text-xl font-black text-emerald-600">{total.toFixed(2)} €</span>
        </div>

        {error && <p className="text-red-500 text-sm px-4 sm:px-6">{error}</p>}
        {loading && (
          <div className="flex justify-center py-6"><Loader2 className="animate-spin text-emerald-500" size={24} /></div>
        )}

        {!loading && items.length > 0 && (
          <div className="pb-4 sm:pb-6">
            {/* Mobile: cartões. Desktop: tabela. */}
            <div className="space-y-2 px-4 sm:hidden">
              {items.map((item, idx) => (
                <Link key={idx} to={`/invoices/${item.invoiceId}`} className="block border border-slate-100 rounded-xl p-3 active:bg-slate-50">
                  <div className="flex justify-between gap-3">
                    <span className="font-semibold text-slate-700 text-sm">{item.productName}</span>
                    <span className="font-bold text-slate-800 text-sm shrink-0">{item.totalPrice.toFixed(2)} €</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
                    <span>{item.invoiceDate}</span>
                    <span>{item.storeName}</span>
                    <span>{formatQuantity(item.quantity, item.quantityUnit)}</span>
                    {item.category && <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full">{item.category}</span>}
                  </div>
                </Link>
              ))}
            </div>

            <div className="hidden sm:block overflow-x-auto px-6">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="text-slate-400 uppercase text-xs">
                    <th className="py-2 pr-2">Data</th>
                    <th className="py-2 px-2">Loja</th>
                    <th className="py-2 px-2">Artigo</th>
                    <th className="py-2 px-2">Categoria</th>
                    <th className="py-2 px-2 text-right">Quantidade</th>
                    <th className="py-2 pl-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2.5 pr-2 text-slate-500">
                        <Link to={`/invoices/${item.invoiceId}`} className="hover:text-emerald-600">{item.invoiceDate}</Link>
                      </td>
                      <td className="py-2.5 px-2 text-slate-600">{item.storeName}</td>
                      <td className="py-2.5 px-2 font-semibold text-slate-700">{item.productName}</td>
                      <td className="py-2.5 px-2">
                        {item.category && (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-xs">{item.category}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-right text-slate-500">{formatQuantity(item.quantity, item.quantityUnit)}</td>
                      <td className="py-2.5 pl-2 text-right font-bold text-slate-800">{item.totalPrice.toFixed(2)} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && items.length === 0 && !error && (
          <p className="text-center text-slate-400 text-sm py-8">Sem artigos para os filtros selecionados.</p>
        )}
      </div>
    </div>
  );
};
