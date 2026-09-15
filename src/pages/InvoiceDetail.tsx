import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Trash2 } from 'lucide-react';
import { apiFetch, apiJson } from '../api';
import { Invoice } from '../types';

function formatQuantity(quantity: number, unit?: string): string {
  if (unit === 'kg') {
    return `${quantity.toFixed(3).replace(/\.?0+$/, '')} kg`;
  }
  return `${quantity} un`;
}

export const InvoiceDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    apiJson<Invoice>(`/api/invoices/${id}`)
      .then(setInvoice)
      .catch(() => setError('Falha ao carregar fatura.'));
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
          <div>
            <h1 className="font-bold text-xl text-slate-800">{invoice.storeName}</h1>
            {invoice.storeLocation && invoice.storeLocation !== invoice.storeName && (
              <p className="text-sm text-slate-400">{invoice.storeLocation}</p>
            )}
            {invoice.storeNif && <p className="text-xs text-slate-400 mt-1">NIF: {invoice.storeNif}</p>}
          </div>
          <div className="text-right">
            <p className="text-3xl font-black text-emerald-600">{invoice.totalAmount.toFixed(2)} €</p>
            <p className="text-xs text-slate-400">{invoice.invoiceDate} · {invoice.paymentMethod}</p>
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
                <div key={idx} className="border border-slate-100 rounded-xl p-3">
                  <div className="flex justify-between gap-3">
                    <span className="font-semibold text-slate-700 text-sm">{item.productName}</span>
                    <span className="font-bold text-slate-800 text-sm shrink-0">{item.totalPrice.toFixed(2)} €</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
                    <span>{formatQuantity(item.quantity, item.quantityUnit)} × {item.unitPrice.toFixed(2)} €{item.quantityUnit === 'kg' ? '/kg' : ''}</span>
                    {item.vatRate != null && <span>IVA {item.vatRate}%</span>}
                    {item.category && <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full">{item.category}</span>}
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
                    <tr key={idx}>
                      <td className="py-2.5 pr-2 font-semibold text-slate-700">{item.productName}</td>
                      <td className="py-2.5 px-2">
                        {item.category && (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-xs">{item.category}</span>
                        )}
                      </td>
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
      </div>
    </div>
  );
};
