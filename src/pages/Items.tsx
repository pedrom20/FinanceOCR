import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Form, Button, Modal, Alert, Spinner, Badge } from 'react-bootstrap';
import { Pencil, ChevronDown, ChevronRight, Loader2, TrendingUp } from 'lucide-react';
import { apiJson, apiFetch, ApiError } from '../api';
import { PriceHistoryModal } from '../components/PriceHistoryModal';

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
  const [historyGroup, setHistoryGroup] = useState<Group | null>(null);

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

  if (loading) return <div className="d-flex justify-content-center py-5"><Spinner animation="border" variant="success" /></div>;

  return (
    <div className="d-flex flex-column gap-3 mx-auto" style={{ maxWidth: 720 }}>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
        <div>
          <h1 className="h3 fw-bold">Artigos</h1>
          <p className="text-muted small mb-0">
            Editar nome ou categoria aqui aplica-se a todas as compras desse artigo — e fica guardado para faturas futuras não criarem um artigo novo.
          </p>
        </div>
        <Form.Select style={{ width: 'auto' }} size="sm" value={groupBy} onChange={e => setGroupBy(e.target.value as GroupBy)}>
          <option value="product">Agrupar por Artigo</option>
          <option value="store">Agrupar por Loja</option>
          <option value="category">Agrupar por Categoria</option>
        </Form.Select>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}

      <div className="d-flex flex-column gap-2">
        {groups.map(g => {
          const isOpen = expanded.has(g.key);
          return (
            <Card key={g.key} className="border-0 shadow-sm">
              <div className="d-flex align-items-center">
                <button onClick={() => toggleExpanded(g.key)} className="btn d-flex align-items-center gap-3 p-3 text-start flex-grow-1 bg-transparent border-0">
                  {isOpen ? <ChevronDown size={16} className="text-muted flex-shrink-0" /> : <ChevronRight size={16} className="text-muted flex-shrink-0" />}
                  <div className="min-w-0 flex-grow-1">
                    <div className="d-flex align-items-center gap-2">
                      <span className="fw-bold text-truncate">{g.key}</span>
                      {groupBy === 'product' && (
                        <span role="button" onClick={e => { e.stopPropagation(); startEditing(g); }} className="text-muted flex-shrink-0">
                          <Pencil size={14} />
                        </span>
                      )}
                    </div>
                    <div className="text-muted small d-flex flex-wrap align-items-center gap-2">
                      <span>{g.count} compra{g.count !== 1 ? 's' : ''}</span>
                      {groupBy === 'product' && g.category && (
                        <Badge bg="success" className="bg-opacity-25 text-success fw-normal">{g.category}</Badge>
                      )}
                    </div>
                  </div>
                  <span className="fw-black text-success flex-shrink-0">{g.totalSpent.toFixed(2)} €</span>
                </button>
                {groupBy === 'product' && (
                  <Button variant="link" className="text-muted flex-shrink-0 me-2" title="Ver variação de preço" onClick={() => setHistoryGroup(g)}>
                    <TrendingUp size={16} />
                  </Button>
                )}
              </div>

              {isOpen && (
                <div className="border-top bg-light">
                  {g.occurrences.map((item, idx) => (
                    <Link key={idx} to={`/invoices/${item.invoiceId}`} className="d-flex align-items-center justify-content-between gap-3 px-3 py-2 ps-5 small text-decoration-none text-body border-bottom">
                      <div className="min-w-0 text-truncate">
                        <div className="text-muted text-truncate">
                          {groupBy === 'product' ? item.storeName : item.productName}
                        </div>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                          {item.invoiceDate} · {formatQuantity(item.quantity, item.quantityUnit)} × {item.unitPrice.toFixed(2)} €{item.quantityUnit === 'kg' ? '/kg' : ''}
                        </div>
                      </div>
                      <span className="fw-semibold flex-shrink-0">{item.totalPrice.toFixed(2)} €</span>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
        {groups.length === 0 && !error && (
          <p className="text-center text-muted small py-4">Ainda não tens artigos guardados.</p>
        )}
      </div>

      <Modal show={!!editingGroup} onHide={() => !saving && setEditingGroup(null)}>
        <Modal.Header closeButton>
          <Modal.Title className="h6 mb-0">Editar artigo</Modal.Title>
        </Modal.Header>
        <Modal.Body className="d-flex flex-column gap-3">
          <Form.Group>
            <Form.Label className="text-muted small text-uppercase fw-bold">Nome</Form.Label>
            <Form.Control autoFocus value={nameInput} onChange={e => setNameInput(e.target.value)} />
          </Form.Group>
          <Form.Group>
            <Form.Label className="text-muted small text-uppercase fw-bold">Categoria</Form.Label>
            <Form.Control list="items-category-options" value={categoryInput} onChange={e => setCategoryInput(e.target.value)} />
            <datalist id="items-category-options">
              {categoryOptions.map(c => <option key={c} value={c} />)}
            </datalist>
          </Form.Group>
          {saveError && <Alert variant="danger" className="py-2 small mb-0">{saveError}</Alert>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" disabled={saving} onClick={() => setEditingGroup(null)}>Cancelar</Button>
          <Button variant="primary" disabled={saving} onClick={saveEdit} className="d-inline-flex align-items-center gap-2">
            {saving && <Loader2 className="spin" size={16} />}
            {saving ? 'A guardar...' : 'Guardar'}
          </Button>
        </Modal.Footer>
      </Modal>

      {historyGroup && (
        <PriceHistoryModal
          productName={historyGroup.key}
          occurrences={historyGroup.occurrences}
          onClose={() => setHistoryGroup(null)}
        />
      )}
    </div>
  );
};
