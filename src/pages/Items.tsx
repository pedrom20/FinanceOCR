import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { apiJson, apiFetch, ApiError } from '../api';
import { Modal } from '../components/Modal';

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

type GroupBy = 'product' | 'store' | 'category';

interface Group {
  key: string;
  count: number;
  totalSpent: number;
  occurrences: ReportItem[];
  category?: string;
}

function groupItems(items: ReportItem[], by: GroupBy): Group[] {
  const map = new Map<string, Group>();
  for (const item of items) {
    const key = by === 'product' ? item.productName : by === 'store' ? item.storeName : (item.category || '(sem categoria)');
    let g = map.get(key);
    if (!g) {
      g = { key, count: 0, totalSpent: 0, occurrences: [], category: by === 'product' ? item.category : undefined };
      map.set(key, g);
    }
    g.count += 1;
    g.totalSpent += item.totalPrice;
    g.occurrences.push(item);
  }
  return Array.from(map.values()).sort((a, b) => b.totalSpent - a.totalSpent);
}

function formatQuantity(quantity: number, unit?: string): string {
  if (unit === 'kg') return `${quantity.toFixed(3).replace(/\.?0+$/, '')} kg`;
  return `${quantity} un`;
}

export const Items = () => {
  const [items, setItems] = useState<ReportItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<GroupBy>('product');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const load = () => {
    setLoading(true);
    apiJson<{ items: ReportItem[]; total: number }>('/api/reports/items')
      .then(data => setItems(data.items))
      .catch(() => setError('Falha ao carregar artigos.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);
  useEffect(() => {
    apiJson<{ categories: string[] }>('/api/reports/filters')
      .then(data => setCategoryOptions(data.categories))
      .catch(() => {});
  }, []);

  const groups = useMemo(() => groupItems(items, groupBy), [items, groupBy]);

  const toggleExpanded = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const startEditing = (g: Group) => {
    setEditingGroup(g);
    setNameInput(g.key);
    setCategoryInput(g.category ?? '');
    setSaveError('');
  };

  const saveEdit = async () => {
    if (!editingGroup) return;
    const newName = nameInput.trim();
    const newCategory = categoryInput.trim();
    if (!newName) return;
    setSaving(true);
    setSaveError('');
    try {
      if (newName !== editingGroup.key) {
        await apiFetch('/api/items/rename', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productName: editingGroup.key, newName }),
        });
      }
      if (newCategory !== (editingGroup.category ?? '')) {
        await apiFetch('/api/items/category', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productName: newName, category: newCategory }),
        });
      }
      setEditingGroup(null);
      load();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Falha ao guardar.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Artigos</h1>
          <p className="text-sm text-slate-400 mt-1">Editar nome ou categoria aqui aplica-se a todas as compras desse artigo — e fica guardado para faturas futuras não criarem um artigo novo.</p>
        </div>
        <select
          value={groupBy}
          onChange={e => setGroupBy(e.target.value as GroupBy)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white shrink-0"
        >
          <option value="product">Agrupar por Artigo</option>
          <option value="store">Agrupar por Loja</option>
          <option value="category">Agrupar por Categoria</option>
        </select>
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="space-y-2">
        {groups.map(g => {
          const isOpen = expanded.has(g.key);
          return (
            <div key={g.key} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <button onClick={() => toggleExpanded(g.key)} className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50">
                {isOpen ? <ChevronDown size={16} className="text-slate-400 shrink-0" /> : <ChevronRight size={16} className="text-slate-400 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 truncate">{g.key}</span>
                    {groupBy === 'product' && (
                      <span
                        role="button"
                        onClick={e => { e.stopPropagation(); startEditing(g); }}
                        className="text-slate-300 hover:text-emerald-600 shrink-0"
                      >
                        <Pencil size={14} />
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 flex items-center flex-wrap gap-x-2 gap-y-1">
                    <span>{g.count} compra{g.count !== 1 ? 's' : ''}</span>
                    {groupBy === 'product' && g.category && (
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full">{g.category}</span>
                    )}
                  </div>
                </div>
                <span className="font-black text-emerald-600 shrink-0">{g.totalSpent.toFixed(2)} €</span>
              </button>

              {isOpen && (
                <div className="divide-y divide-slate-100 border-t border-slate-100 bg-slate-50">
                  {g.occurrences.map((item, idx) => (
                    <Link key={idx} to={`/invoices/${item.invoiceId}`} className="flex items-center justify-between gap-3 px-4 py-2.5 pl-11 text-sm hover:bg-white">
                      <div className="min-w-0">
                        <div className="text-slate-600 truncate">
                          {groupBy === 'product' ? item.storeName : item.productName}
                        </div>
                        <div className="text-xs text-slate-400">
                          {item.invoiceDate} · {formatQuantity(item.quantity, item.quantityUnit)} × {item.unitPrice.toFixed(2)} €{item.quantityUnit === 'kg' ? '/kg' : ''}
                        </div>
                      </div>
                      <span className="font-semibold text-slate-700 shrink-0">{item.totalPrice.toFixed(2)} €</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {groups.length === 0 && !error && (
          <p className="text-center text-slate-400 text-sm py-8">Ainda não tens artigos guardados.</p>
        )}
      </div>

      {editingGroup && (
        <Modal title="Editar artigo" onClose={() => !saving && setEditingGroup(null)}>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase">Nome</label>
            <input
              autoFocus
              className="w-full mt-1 border-b py-2 outline-none focus:border-emerald-500"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase">Categoria</label>
            <input
              list="items-category-options"
              className="w-full mt-1 border-b py-2 outline-none focus:border-emerald-500"
              value={categoryInput}
              onChange={e => setCategoryInput(e.target.value)}
            />
            <datalist id="items-category-options">
              {categoryOptions.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
          {saveError && <p className="text-red-500 text-sm">{saveError}</p>}
          <div className="flex justify-end gap-3">
            <button onClick={() => setEditingGroup(null)} disabled={saving} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 disabled:opacity-50">
              Cancelar
            </button>
            <button
              onClick={saveEdit}
              disabled={saving}
              className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving && <Loader2 className="animate-spin" size={16} />}
              {saving ? 'A guardar...' : 'Guardar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
