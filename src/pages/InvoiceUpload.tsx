import React, { useState } from 'react';
import { UploadCloud, Plus, Loader2, Trash2 } from 'lucide-react';
import { apiFetch, ApiError } from '../api';

export const InvoiceUpload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [invoice, setInvoice] = useState<any>(null);

  const handleProcess = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiFetch('/api/ocr/process-invoice', { method: 'POST', body: formData });
      setInvoice(await response.json());
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Erro ao processar ficheiro.');
    } finally {
      setLoading(false);
    }
  };

  const saveInvoice = async () => {
    setSaving(true);
    try {
      await apiFetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoice),
      });
      alert('Fatura guardada com sucesso!');
      setInvoice(null);
      setFile(null);
    } catch (err) {
      console.error('Erro ao guardar fatura:', err);
      alert(err instanceof ApiError ? `Erro ao guardar: ${err.message}` : 'Erro ao guardar fatura.');
    } finally {
      setSaving(false);
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
            {loading ? 'A processar OCR...' : 'Processar Agora'}
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
              <div><label className="text-xs font-bold text-slate-400 uppercase">Loja</label><input className="w-full border-b py-2 outline-none focus:border-emerald-500" value={invoice.storeName} onChange={e => setInvoice({ ...invoice, storeName: e.target.value })} /></div>
              <div><label className="text-xs font-bold text-slate-400 uppercase">NIF</label><input className="w-full border-b py-2 outline-none focus:border-emerald-500" value={invoice.storeNif} onChange={e => setInvoice({ ...invoice, storeNif: e.target.value })} /></div>
            </div>
            <div className="space-y-4">
              <div><label className="text-xs font-bold text-slate-400 uppercase">Data</label><input type="date" className="w-full border-b py-2 outline-none focus:border-emerald-500" value={invoice.invoiceDate} onChange={e => setInvoice({ ...invoice, invoiceDate: e.target.value })} /></div>
              <div><label className="text-xs font-bold text-slate-400 uppercase">Total</label><input type="number" className="w-full border-b py-2 outline-none focus:border-emerald-500 text-2xl font-bold" value={invoice.totalAmount} onChange={e => setInvoice({ ...invoice, totalAmount: parseFloat(e.target.value) })} /></div>
            </div>
          </div>
          {invoice.items && invoice.items.length > 0 && (
            <div className="px-8 pb-8">
              <label className="text-xs font-bold text-slate-400 uppercase">Artigos</label>
              <div className="mt-3 divide-y divide-slate-100 border rounded-xl overflow-hidden">
                {invoice.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-3 px-4 py-2.5">
                    <input
                      className="flex-1 outline-none text-sm text-slate-700 bg-transparent"
                      value={item.productName}
                      onChange={e => {
                        const items = [...invoice.items];
                        items[idx] = { ...items[idx], productName: e.target.value };
                        setInvoice({ ...invoice, items });
                      }}
                    />
                    <input
                      type="number"
                      step="0.01"
                      className="w-24 outline-none text-sm text-right font-semibold text-slate-700 bg-transparent"
                      value={item.unitPrice}
                      onChange={e => {
                        const price = parseFloat(e.target.value) || 0;
                        const items = [...invoice.items];
                        items[idx] = { ...items[idx], unitPrice: price, totalPrice: price };
                        setInvoice({ ...invoice, items });
                      }}
                    />
                    <button
                      onClick={() => setInvoice({ ...invoice, items: invoice.items.filter((_: any, i: number) => i !== idx) })}
                      className="text-slate-300 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="p-8 border-t bg-slate-50 flex justify-end">
            <button
              onClick={saveInvoice}
              disabled={saving}
              className="bg-emerald-600 text-white px-10 py-3 rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="animate-spin" size={18} />}
              {saving ? 'A guardar...' : 'Guardar Fatura'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
