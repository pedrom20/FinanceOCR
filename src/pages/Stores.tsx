import React, { useEffect, useState } from 'react';
import { Store as StoreIcon, Pencil, Check, X, Sparkles, Loader2 } from 'lucide-react';
import { apiFetch, apiJson, ApiError } from '../api';

interface StoreRow {
  storeNif: string;
  storeName: string;
  invoiceCount: number;
  totalSpent: number;
  lastPurchase: string;
}

const keyOf = (s: StoreRow) => s.storeNif || `name:${s.storeName}`;

export const Stores = () => {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  const load = () => {
    setLoading(true);
    apiJson<StoreRow[]>('/api/stores')
      .then(setStores)
      .catch(() => setError('Falha ao carregar lojas.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const startEditing = (s: StoreRow) => {
    setEditingKey(keyOf(s));
    setNameInput(s.storeName);
  };

  const suggestName = async (s: StoreRow) => {
    setSuggesting(true);
    try {
      const data = await apiJson<{ suggestion: string }>('/api/stores/suggest-name', {
        method: 'POST',
        body: JSON.stringify({ storeName: s.storeName }),
      });
      setNameInput(data.suggestion);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Falha ao sugerir nome.');
    } finally {
      setSuggesting(false);
    }
  };

  const save = async (s: StoreRow) => {
    const newName = nameInput.trim();
    if (!newName) return;
    setSaving(true);
    try {
      await apiFetch('/api/stores', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeNif: s.storeNif, storeName: s.storeName, newName }),
      });
      setEditingKey(null);
      load();
    } catch (err) {
      alert('Erro ao guardar loja.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Lojas</h1>
        <p className="text-sm text-slate-400 mt-1">Comerciantes agrupados pelo NIF das tuas faturas. Editar aqui aplica-se a todas as faturas desse comerciante.</p>
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="space-y-3">
        {stores.map(s => {
          const key = keyOf(s);
          const editing = editingKey === key;
          return (
            <div key={key} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
              {editing ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    className="flex-1 min-w-0 border-b py-1 outline-none focus:border-emerald-500 font-bold text-slate-800"
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && save(s)}
                  />
                  <button onClick={() => suggestName(s)} disabled={suggesting} className="text-slate-400 hover:text-emerald-600 disabled:opacity-50 shrink-0" title="Sugerir nome com IA">
                    {suggesting ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                  </button>
                  <button onClick={() => save(s)} disabled={saving} className="text-emerald-600 hover:text-emerald-700 disabled:opacity-50 shrink-0">
                    <Check size={18} />
                  </button>
                  <button onClick={() => setEditingKey(null)} className="text-slate-400 hover:text-red-500 shrink-0">
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
                      <StoreIcon size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 truncate">{s.storeName}</span>
                        <button onClick={() => startEditing(s)} className="text-slate-300 hover:text-emerald-600 shrink-0">
                          <Pencil size={14} />
                        </button>
                      </div>
                      <div className="text-xs text-slate-400 truncate">
                        {s.storeNif && <>NIF: {s.storeNif} · </>}
                        {s.invoiceCount} fatura{s.invoiceCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-black text-emerald-600">{s.totalSpent.toFixed(2)} €</div>
                    <div className="text-xs text-slate-400">{s.lastPurchase?.slice(0, 10)}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {stores.length === 0 && !error && (
          <p className="text-center text-slate-400 text-sm py-8">Ainda não tens faturas guardadas.</p>
        )}
      </div>
    </div>
  );
};
