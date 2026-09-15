import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Download, Loader2, Filter, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { apiFetch, apiJson, ApiError } from '../api';

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

interface GroupedItem {
  productName: string;
  category?: string;
  count: number;
  totalSpent: number;
  occurrences: ReportItem[];
}

function groupByProduct(items: ReportItem[]): GroupedItem[] {
  const map = new Map<string, GroupedItem>();
  for (const item of items) {
    let group = map.get(item.productName);
    if (!group) {
      group = { productName: item.productName, category: item.category, count: 0, totalSpent: 0, occurrences: [] };
      map.set(item.productName, group);
    }
    group.count += 1;
    group.totalSpent += item.totalPrice;
    group.occurrences.push(item);
  }
  return Array.from(map.values()).sort((a, b) => b.totalSpent - a.totalSpent);
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [categorizing, setCategorizing] = useState(false);
  const [categorizeResult, setCategorizeResult] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const groups = useMemo(() => groupByProduct(items), [items]);
  const toggleExpanded = (productName: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(productName) ? next.delete(productName) : next.add(productName);
      return next;
    });
  };

  useEffect(() => {
    apiJson<FiltersResponse>('/api/reports/filters')
      .then(setFilterOptions)
      .catch(() => {});
  }, [reloadKey]);

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
  }, [store, category, search, dateFrom, dateTo, reloadKey]);

  const categorizeMissing = async () => {
    setCategorizing(true);
    setCategorizeResult('');
    try {
      const result = await apiJson<{ updated: number; total: number }>('/api/invoices/categorize-missing', { method: 'POST' });
      setCategorizeResult(result.total === 0 ? 'Não há artigos por categorizar.' : `${result.updated} de ${result.total} artigos categorizados.`);
      setReloadKey(k => k + 1);
    } catch (err) {
      setCategorizeResult(err instanceof ApiError ? err.message : 'Falha ao categorizar.');
    } finally {
      setCategorizing(false);
    }
  };

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
        <div className="p-4 sm:p-6 bg-slate-50 border-b flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-slate-400" />
            <h3 className="font-bold text-slate-800">Filtrar Despesas</h3>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={categorizeMissing}
              disabled={categorizing}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-emerald-600 disabled:opacity-40 border border-slate-200 rounded-lg px-3 py-1.5"
            >
              {categorizing ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
              {categorizing ? 'A categorizar...' : 'Categorizar artigos em falta'}
            </button>
            {categorizeResult && <span className="text-xs text-slate-500">{categorizeResult}</span>}
          </div>
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

        {!loading && groups.length > 0 && (
          <div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-2">
            {groups.map(group => {
              const isOpen = expanded.has(group.productName);
              return (
                <div key={group.productName} className="border border-slate-100 rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleExpanded(group.productName)}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-50"
                  >
                    {isOpen ? <ChevronDown size={16} className="text-slate-400 shrink-0" /> : <ChevronRight size={16} className="text-slate-400 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-700 text-sm truncate">{group.productName}</div>
                      <div className="mt-0.5 text-xs text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
                        <span>{group.count} compra{group.count !== 1 ? 's' : ''}</span>
                        {group.category && <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full">{group.category}</span>}
                      </div>
                    </div>
                    <span className="font-bold text-slate-800 text-sm shrink-0">{group.totalSpent.toFixed(2)} €</span>
                  </button>

                  {isOpen && (
                    <div className="divide-y divide-slate-100 border-t border-slate-100 bg-slate-50">
                      {group.occurrences.map((item, idx) => (
                        <Link
                          key={idx}
                          to={`/invoices/${item.invoiceId}`}
                          className="flex items-center justify-between gap-3 px-3 py-2.5 pl-8 text-sm hover:bg-white"
                        >
                          <div className="min-w-0">
                            <div className="text-slate-600 truncate">{item.storeName}</div>
                            <div className="text-xs text-slate-400">{item.invoiceDate} · {formatQuantity(item.quantity, item.quantityUnit)} × {item.unitPrice.toFixed(2)} €{item.quantityUnit === 'kg' ? '/kg' : ''}</div>
                          </div>
                          <span className="font-semibold text-slate-700 shrink-0">{item.totalPrice.toFixed(2)} €</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!loading && items.length === 0 && !error && (
          <p className="text-center text-slate-400 text-sm py-8">Sem artigos para os filtros selecionados.</p>
        )}
      </div>
    </div>
  );
};
