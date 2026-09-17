import React, { useEffect, useState } from 'react';
import { Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { Store as StoreIcon, Pencil, Check, X, Sparkles, Loader2, ChevronDown, ChevronRight, MapPin } from 'lucide-react';
import { apiFetch, apiJson, ApiError } from '../api';

interface StoreLocation {
  location: string;
  invoiceCount: number;
  totalSpent: number;
  lastPurchase: string;
}

interface StoreRow {
  storeNif: string;
  storeName: string;
  invoiceCount: number;
  totalSpent: number;
  lastPurchase: string;
  locations: StoreLocation[];
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpanded = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

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

  if (loading) return <div className="d-flex justify-content-center py-5"><Spinner animation="border" variant="success" /></div>;

  return (
    <div className="d-flex flex-column gap-3 mx-auto" style={{ maxWidth: 720 }}>
      <div className="page-header">
        <div>
          <h1>Lojas</h1>
          <p>
            Comerciantes agrupados pelo NIF das tuas faturas. Editar aqui aplica-se a todas as faturas desse comerciante.
            Quando um comerciante tem mais que uma loja (ex: Lidl), a divisão por loja fica visível ao expandir.
          </p>
        </div>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}

      <div className="d-flex flex-column gap-3">
        {stores.map(s => {
          const key = keyOf(s);
          const editing = editingKey === key;
          return (
            <Card key={key}>
              <Card.Body>
                {editing ? (
                  <div className="d-flex align-items-center gap-2">
                    <Form.Control
                      autoFocus
                      className="fw-bold"
                      value={nameInput}
                      onChange={e => setNameInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && save(s)}
                    />
                    <Button variant="link" className="text-muted flex-shrink-0" disabled={suggesting} title="Sugerir nome com IA" onClick={() => suggestName(s)}>
                      {suggesting ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
                    </Button>
                    <Button variant="link" className="text-success flex-shrink-0" disabled={saving} onClick={() => save(s)}>
                      <Check size={18} />
                    </Button>
                    <Button variant="link" className="text-danger flex-shrink-0" onClick={() => setEditingKey(null)}>
                      <X size={18} />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="d-flex align-items-center justify-content-between gap-3">
                      <div className="d-flex align-items-center gap-3 min-w-0">
                        {s.locations.length > 0 ? (
                          <Button
                            variant="light"
                            className="rounded-circle d-flex align-items-center justify-content-center text-success flex-shrink-0 p-0"
                            style={{ width: 40, height: 40 }}
                            onClick={() => toggleExpanded(key)}
                          >
                            {expanded.has(key) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          </Button>
                        ) : (
                          <div className="bg-success bg-opacity-10 text-success rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 40, height: 40 }}>
                            <StoreIcon size={18} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="d-flex align-items-center gap-2">
                            <span className="fw-bold text-truncate">{s.storeName}</span>
                            <Button variant="link" className="text-muted p-0 flex-shrink-0" onClick={() => startEditing(s)}>
                              <Pencil size={14} />
                            </Button>
                          </div>
                          <div className="text-muted small text-truncate">
                            {s.storeNif && <>NIF: {s.storeNif} · </>}
                            {s.invoiceCount} fatura{s.invoiceCount !== 1 ? 's' : ''}
                            {s.locations.length > 0 && <> · {s.locations.length} lojas</>}
                          </div>
                        </div>
                      </div>
                      <div className="text-end flex-shrink-0">
                        <div className="fw-black text-success">{s.totalSpent.toFixed(2)} €</div>
                        <div className="text-muted small">{s.lastPurchase?.slice(0, 10)}</div>
                      </div>
                    </div>

                    {expanded.has(key) && s.locations.length > 0 && (
                      <div className="mt-3 pt-3 border-top d-flex flex-column gap-2">
                        {s.locations.map(loc => (
                          <div key={loc.location || '(sem loja)'} className="d-flex align-items-center justify-content-between gap-3 small" style={{ paddingLeft: '3.25rem' }}>
                            <div className="d-flex align-items-center gap-2 min-w-0 text-muted">
                              <MapPin size={14} className="flex-shrink-0" />
                              <span className="text-truncate">{loc.location || 'Sem loja identificada'}</span>
                            </div>
                            <div className="text-end flex-shrink-0">
                              <span className="fw-semibold">{loc.totalSpent.toFixed(2)} €</span>
                              <span className="text-muted ms-2">{loc.invoiceCount}×</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </Card.Body>
            </Card>
          );
        })}
        {stores.length === 0 && !error && (
          <p className="text-center text-muted small py-4">Ainda não tens faturas guardadas.</p>
        )}
      </div>
    </div>
  );
};
