import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { apiFetch, apiJson } from '../api';
import { Invoice } from '../types';

export const InvoiceList = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiJson<Invoice[]>('/api/invoices')
      .then(setInvoices)
      .catch(() => setError('Falha ao carregar faturas.'));
  }, []);

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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-800">Histórico de Compras</h1>
      {error && <p className="text-red-500 text-sm">{error}</p>}
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
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-700">{inv.storeName}</div>
                  {inv.storeLocation && inv.storeLocation !== inv.storeName && (
                    <div className="text-xs text-slate-400">{inv.storeLocation}</div>
                  )}
                </td>
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
