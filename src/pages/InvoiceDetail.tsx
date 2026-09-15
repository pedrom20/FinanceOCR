import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Pencil, Trash2, Check, X } from 'lucide-react';
import { apiFetch, apiJson } from '../api';
import { Invoice, InvoiceItem } from '../types';

function formatQuantity(quantity: number, unit?: string): string {
  if (unit === 'kg') {
    return `${quantity.toFixed(3).replace(/\.?0+$/, '')} kg`;
  }
  return `${quantity} un`;
}

interface VatBreakdownRow {
  rate: number;
  base: number;
  vat: number;
  total: number;
}

/** Reconstrói a tabela "Taxa / Base Imp. / Val.Total / Val.IVA" que o talão original mostra, a partir do IVA por artigo. */
function vatBreakdown(items: InvoiceItem[]): VatBreakdownRow[] {
  const totals = new Map<number, number>();
  for (const item of items) {
    if (item.vatRate == null) continue;
    totals.set(item.vatRate, (totals.get(item.vatRate) ?? 0) + item.totalPrice);
  }
  return Array.from(totals.entries())
    .sort(([a], [b]) => a - b)
    .map(([rate, total]) => {
      const base = total / (1 + rate / 100);
      return { rate, base, vat: total - base, total };
    });
}

export const InvoiceDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [editingStore, setEditingStore] = useState(false);
  const [storeNameInput, setStoreNameInput] = useState('');
  const [applyToAllWithNif, setApplyToAllWithNif] = useState(true);
  const [savingStore, setSavingStore] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [categoryInput, setCategoryInput] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  useEffect(() => {
    apiJson<Invoice>(`/api/invoices/${id}`)
      .then(setInvoice)
      .catch(() => setError('Falha ao carregar fatura.'));
    apiJson<{ categories: string[] }>('/api/reports/filters')
      .then(data => setCategoryOptions(data.categories))
      .catch(() => {});
  }, [id]);

  const downloadFile = async (fileName: string) => {
    try {
      const response = await apiFetch(`/api/files/${encodeURIComponent(fileName)}`);
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

  const startEditingStore = () => {
    if (!invoice) return;
    setStoreNameInput(invoice.storeName);
    setApplyToAllWithNif(true);
    setEditingStore(true);
  };

  const saveStoreName = async () => {
    if (!invoice) return;
    const newName = storeNameInput.trim();
    if (newName === '') return;
    setSavingStore(true);
    try {
      await apiFetch(`/api/invoices/${invoice.id}/store`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeName: newName, applyToAllWithNif: invoice.storeNif ? applyToAllWithNif : false }),
      });
      setInvoice({ ...invoice, storeName: newName });
      setEditingStore(false);
    } catch (err) {
      alert('Erro ao guardar nome da loja.');
    } finally {
      setSavingStore(false);
    }
  };

  const startEditingCategory = (item: InvoiceItem) => {
    setEditingItemId(item.id ?? null);
    setCategoryInput(item.category ?? '');
  };

  const saveCategory = async (itemId: string) => {
    if (!invoice) return;
    setSavingCategory(true);
    const category = categoryInput.trim();
    try {
      await apiFetch(`/api/invoices/${invoice.id}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category }),
      });
      setInvoice({
        ...invoice,
        items: invoice.items?.map(it => (it.id === itemId ? { ...it, category } : it)),
      });
      setEditingItemId(null);
    } catch (err) {
      alert('Erro ao guardar categoria.');
    } finally {
      setSavingCategory(false);
    }
  };

  const renderCategory = (item: InvoiceItem) => {
    if (!item.id) {
      return item.category ? <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-xs">{item.category}</span> : null;
    }

    if (editingItemId === item.id) {
      return (
        <span className="inline-flex items-center gap-1">
          <input
            list="category-options"
            autoFocus
            className="w-28 border-b py-0.5 outline-none focus:border-emerald-500 text-xs bg-transparent"
            value={categoryInput}
            onChange={e => setCategoryInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveCategory(item.id!)}
          />
          <button onClick={() => saveCategory(item.id!)} disabled={savingCategory} className="text-emerald-600 hover:text-emerald-700 disabled:opacity-50">
            <Check size={14} />
          </button>
          <button onClick={() => setEditingItemId(null)} className="text-slate-400 hover:text-red-500">
            <X size={14} />
          </button>
        </span>
      );
    }

    return (
      <button onClick={() => startEditingCategory(item)} className="inline-flex items-center gap-1 group">
        {item.category ? (
          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-xs">{item.category}</span>
        ) : (
          <span className="text-xs text-slate-300 group-hover:text-emerald-600">+ categoria</span>
        )}
        <Pencil size={10} className="text-slate-300 opacity-0 group-hover:opacity-100 shrink-0" />
      </button>
    );
  };

  const deleteInvoice = async () => {
    if (!invoice) return;
    if (!window.confirm(`Apagar a fatura de "${invoice.storeName}"? Esta ação não pode ser desfeita.`)) {
      return;
    }
    setDeleting(true);
    try {
      await apiFetch(`/api/invoices/${invoice.id}`, { method: 'DELETE' });
      navigate('/invoices');
    } catch (err) {
      alert('Erro ao apagar fatura.');
      setDeleting(false);
    }
  };

  if (error) return <p className="text-red-500 text-sm">{error}</p>;
  if (!invoice) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <Link to="/invoices" className="inline-flex items-center gap-2 text-slate-500 hover:text-emerald-600 text-sm">
          <ArrowLeft size={16} /> Voltar às faturas
        </Link>
        <button
          onClick={deleteInvoice}
          disabled={deleting}
          className="inline-flex items-center gap-2 text-sm text-red-500 hover:text-red-600 disabled:opacity-50"
        >
          <Trash2 size={16} /> {deleting ? 'A apagar...' : 'Apagar fatura'}
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm overflow-hidden border border-slate-100">
        <div className="p-4 sm:p-6 bg-slate-50 border-b flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {editingStore ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    className="border-b py-1 outline-none focus:border-emerald-500 font-bold text-lg text-slate-800 bg-transparent"
                    value={storeNameInput}
                    onChange={e => setStoreNameInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveStoreName()}
                  />
                  <button onClick={saveStoreName} disabled={savingStore} className="text-emerald-600 hover:text-emerald-700 disabled:opacity-50">
                    <Check size={18} />
                  </button>
                  <button onClick={() => setEditingStore(false)} className="text-slate-400 hover:text-red-500">
                    <X size={18} />
                  </button>
                </div>
                {invoice.storeNif && (
                  <label className="flex items-center gap-2 text-xs text-slate-500">
                    <input type="checkbox" checked={applyToAllWithNif} onChange={e => setApplyToAllWithNif(e.target.checked)} />
                    Aplicar a todas as faturas deste comerciante (NIF: {invoice.storeNif})
                  </label>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-xl text-slate-800 truncate">{invoice.storeName}</h1>
                <button onClick={startEditingStore} className="text-slate-300 hover:text-emerald-600 shrink-0">
                  <Pencil size={14} />
                </button>
              </div>
            )}
            {invoice.storeLocation && invoice.storeLocation !== invoice.storeName && (
              <p className="text-sm text-slate-400">{invoice.storeLocation}</p>
            )}
            {invoice.storeNif && <p className="text-xs text-slate-400 mt-1">NIF: {invoice.storeNif}</p>}
          </div>
          <div className="text-right">
            <p className="text-3xl font-black text-emerald-600">{invoice.totalAmount.toFixed(2)} €</p>
            <p className="text-xs text-slate-400">{invoice.invoiceDate}</p>
          </div>
        </div>

        {invoice.fileName && (
          <div className="px-4 sm:px-6 py-3 border-b">
            <button
              onClick={() => downloadFile(invoice.fileName!)}
              className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-600"
            >
              <Download size={16} /> Descarregar documento original
            </button>
          </div>
        )}

        {invoice.items && invoice.items.length > 0 && (
          <div className="p-4 sm:p-6">
            <h2 className="text-xs font-bold text-slate-400 uppercase mb-3">Artigos</h2>

            {/* Mobile: cartões, uma coluna. Desktop: tabela. */}
            <div className="space-y-3 sm:hidden">
              {invoice.items.map((item, idx) => (
                <div key={item.id ?? idx} className="border border-slate-100 rounded-xl p-3">
                  <div className="flex justify-between gap-3">
                    <span className="font-semibold text-slate-700 text-sm">{item.productName}</span>
                    <span className="font-bold text-slate-800 text-sm shrink-0">{item.totalPrice.toFixed(2)} €</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
                    <span>{formatQuantity(item.quantity, item.quantityUnit)} × {item.unitPrice.toFixed(2)} €{item.quantityUnit === 'kg' ? '/kg' : ''}</span>
                    {item.vatRate != null && <span>IVA {item.vatRate}%</span>}
                    {renderCategory(item)}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="text-slate-400 uppercase text-xs">
                    <th className="py-2 pr-2">Artigo</th>
                    <th className="py-2 px-2">Categoria</th>
                    <th className="py-2 px-2 text-right">Quantidade</th>
                    <th className="py-2 px-2 text-right">Preço Unit.</th>
                    <th className="py-2 px-2 text-right">IVA</th>
                    <th className="py-2 pl-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoice.items.map((item, idx) => (
                    <tr key={item.id ?? idx}>
                      <td className="py-2.5 pr-2 font-semibold text-slate-700">{item.productName}</td>
                      <td className="py-2.5 px-2">{renderCategory(item)}</td>
                      <td className="py-2.5 px-2 text-right text-slate-500">
                        {formatQuantity(item.quantity, item.quantityUnit)}
                      </td>
                      <td className="py-2.5 px-2 text-right text-slate-500">
                        {item.unitPrice.toFixed(2)} €{item.quantityUnit === 'kg' ? '/kg' : ''}
                      </td>
                      <td className="py-2.5 px-2 text-right text-slate-500">{item.vatRate != null ? `${item.vatRate}%` : '—'}</td>
                      <td className="py-2.5 pl-2 text-right font-bold text-slate-800">{item.totalPrice.toFixed(2)} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Como no talão original: tabela de IVA por taxa, depois o método de pagamento. */}
        {invoice.items && invoice.items.length > 0 && vatBreakdown(invoice.items).length > 0 && (
          <div className="px-4 sm:px-6 pb-4 sm:pb-6">
            <h2 className="text-xs font-bold text-slate-400 uppercase mb-3">IVA</h2>
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="text-slate-400 uppercase text-xs">
                  <th className="py-1 pr-2">Taxa</th>
                  <th className="py-1 px-2 text-right">Base Imp.</th>
                  <th className="py-1 px-2 text-right">Val. IVA</th>
                  <th className="py-1 pl-2 text-right">Val. Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vatBreakdown(invoice.items).map(row => (
                  <tr key={row.rate}>
                    <td className="py-1.5 pr-2 text-slate-600">{row.rate}%</td>
                    <td className="py-1.5 px-2 text-right text-slate-500">{row.base.toFixed(2)} €</td>
                    <td className="py-1.5 px-2 text-right text-slate-500">{row.vat.toFixed(2)} €</td>
                    <td className="py-1.5 pl-2 text-right text-slate-700">{row.total.toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 sm:p-6 border-t bg-slate-50 flex items-center justify-between">
          <span className="font-bold text-slate-800">{invoice.paymentMethod}</span>
          <span className="text-xl font-black text-emerald-600">{invoice.totalAmount.toFixed(2)} €</span>
        </div>
      </div>

      <datalist id="category-options">
        {categoryOptions.map(c => <option key={c} value={c} />)}
      </datalist>
    </div>
  );
};
