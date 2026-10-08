import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Form, Button, Modal, Alert, Spinner, Badge } from 'react-bootstrap';
import { Pencil, ChevronDown, ChevronRight, Loader2, TrendingUp, X, Plus, ImagePlus, Image as ImageIcon } from 'lucide-react';
import { apiJson, apiFetch, ApiError } from '../api';
import { PriceHistoryModal } from '../components/PriceHistoryModal';
import { AuthImage } from '../components/AuthImage';

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
  imagePath?: string | null;
}

type GroupBy = 'product' | 'store' | 'category';

interface Group {
  key: string;
  count: number;
  totalSpent: number;
  occurrences: ReportItem[];
  category?: string;
  imagePath?: string | null;
}

function groupItems(items: ReportItem[], by: GroupBy): Group[] {
  const map = new Map<string, Group>();
  for (const item of items) {
    const key = by === 'product' ? item.productName : by === 'store' ? item.storeName : (item.category || '(sem categoria)');
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        count: 0,
        totalSpent: 0,
        occurrences: [],
        category: by === 'product' ? item.category : undefined,
        imagePath: by === 'product' ? item.imagePath : undefined,
      };
      map.set(key, g);
    }
    g.count += 1;
    g.totalSpent += item.totalPrice;
    g.occurrences.push(item);
    if (by === 'product' && !g.imagePath && item.imagePath) g.imagePath = item.imagePath;
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
  const [aliases, setAliases] = useState<string[]>([]);
  const [aliasInput, setAliasInput] = useState('');
  const [aliasBusy, setAliasBusy] = useState(false);
  const [aliasError, setAliasError] = useState('');
  const [editingImagePath, setEditingImagePath] = useState<string | null | undefined>(undefined);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState('');
  const [similarNames, setSimilarNames] = useState<string[]>([]);
  const [similarInput, setSimilarInput] = useState('');
  const [similarBusy, setSimilarBusy] = useState(false);
  const [similarError, setSimilarError] = useState('');

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
  // Agrupamento por artigo independente do modo de visualização atual — para
  // conseguir mostrar o último preço/loja de um artigo semelhante ligado,
  // mesmo quando o ecrã está agrupado por loja ou categoria.
  const productGroups = useMemo(() => groupItems(items, 'product'), [items]);
  const productGroupsByKey = useMemo(() => new Map(productGroups.map(g => [g.key, g])), [productGroups]);
  const allProductNames = useMemo(() => productGroups.map(g => g.key).sort(), [productGroups]);

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
    setAliasInput('');
    setAliasError('');
    setEditingImagePath(g.imagePath);
    setImageError('');
    setSimilarInput('');
    setSimilarError('');
    loadAliases(g.key);
    loadSimilar(g.key);
  };

  const loadSimilar = (productName: string) => {
    apiJson<{ similar: string[] }>(`/api/items/similar?productName=${encodeURIComponent(productName)}`)
      .then(data => setSimilarNames(data.similar))
      .catch(() => setSimilarNames([]));
  };

  const addSimilarProduct = async () => {
    if (!editingGroup) return;
    const similarName = similarInput.trim();
    if (!similarName) return;
    setSimilarBusy(true);
    setSimilarError('');
    try {
      await apiFetch('/api/items/similar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName: editingGroup.key, similarName }),
      });
      setSimilarInput('');
      loadSimilar(editingGroup.key);
    } catch (err) {
      setSimilarError(err instanceof ApiError ? err.message : 'Falha ao ligar artigo semelhante.');
    } finally {
      setSimilarBusy(false);
    }
  };

  const removeSimilarProduct = async (similarName: string) => {
    if (!editingGroup) return;
    setSimilarBusy(true);
    setSimilarError('');
    try {
      await apiFetch(`/api/items/similar?productName=${encodeURIComponent(editingGroup.key)}&similarName=${encodeURIComponent(similarName)}`, {
        method: 'DELETE',
      });
      loadSimilar(editingGroup.key);
    } catch (err) {
      setSimilarError(err instanceof ApiError ? err.message : 'Falha ao remover artigo semelhante.');
    } finally {
      setSimilarBusy(false);
    }
  };

  const uploadImage = async (file: File) => {
    if (!editingGroup) return;
    setImageBusy(true);
    setImageError('');
    try {
      const formData = new FormData();
      formData.append('productName', editingGroup.key);
      formData.append('image', file);
      const response = await apiFetch('/api/items/image', { method: 'POST', body: formData });
      const data = await response.json();
      setEditingImagePath(data.imagePath);
      load();
    } catch (err) {
      setImageError(err instanceof ApiError ? err.message : 'Falha ao enviar imagem.');
    } finally {
      setImageBusy(false);
    }
  };

  const removeImage = async () => {
    if (!editingGroup) return;
    setImageBusy(true);
    setImageError('');
    try {
      await apiFetch('/api/items/image', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName: editingGroup.key }),
      });
      setEditingImagePath(null);
      load();
    } catch (err) {
      setImageError(err instanceof ApiError ? err.message : 'Falha ao remover imagem.');
    } finally {
      setImageBusy(false);
    }
  };

  const loadAliases = (canonicalName: string) => {
    apiJson<{ aliases: string[] }>(`/api/items/aliases?productName=${encodeURIComponent(canonicalName)}`)
      .then(data => setAliases(data.aliases))
      .catch(() => setAliases([]));
  };

  const addAlias = async () => {
    if (!editingGroup) return;
    const alias = aliasInput.trim();
    if (!alias) return;
    setAliasBusy(true);
    setAliasError('');
    try {
      await apiFetch('/api/items/alias', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canonicalName: editingGroup.key, alias }),
      });
      setAliasInput('');
      loadAliases(editingGroup.key);
      load();
    } catch (err) {
      setAliasError(err instanceof ApiError ? err.message : 'Falha ao adicionar nome alternativo.');
    } finally {
      setAliasBusy(false);
    }
  };

  const removeAlias = async (alias: string) => {
    if (!editingGroup) return;
    setAliasBusy(true);
    setAliasError('');
    try {
      await apiFetch(`/api/items/alias?canonicalName=${encodeURIComponent(editingGroup.key)}&alias=${encodeURIComponent(alias)}`, {
        method: 'DELETE',
      });
      loadAliases(editingGroup.key);
    } catch (err) {
      setAliasError(err instanceof ApiError ? err.message : 'Falha ao remover nome alternativo.');
    } finally {
      setAliasBusy(false);
    }
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
      <div className="page-header">
        <div>
          <h1>Artigos</h1>
          <p>
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
            <Card key={g.key}>
              <div className="d-flex align-items-center">
                <button onClick={() => toggleExpanded(g.key)} className="btn d-flex align-items-center gap-3 p-3 text-start flex-grow-1 bg-transparent border-0">
                  {isOpen ? <ChevronDown size={16} className="text-muted flex-shrink-0" /> : <ChevronRight size={16} className="text-muted flex-shrink-0" />}
                  {groupBy === 'product' && g.imagePath && (
                    <AuthImage
                      path={g.imagePath}
                      alt={g.key}
                      className="rounded border flex-shrink-0"
                      style={{ width: 36, height: 36, objectFit: 'cover' }}
                    />
                  )}
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

          <Form.Group>
            <Form.Label className="text-muted small text-uppercase fw-bold">
              Nomes alternativos
            </Form.Label>
            <p className="text-muted mb-2" style={{ fontSize: '0.75rem' }}>
              Útil para o mesmo artigo em idiomas diferentes (ex: "Agua" / "Água") — junta já as compras existentes com esse nome e aplica-se às faturas futuras.
            </p>
            {aliases.length > 0 && (
              <div className="d-flex flex-wrap gap-2 mb-2">
                {aliases.map(alias => (
                  <Badge key={alias} bg="light" text="dark" className="border fw-normal d-inline-flex align-items-center gap-1 py-2 px-2">
                    {alias}
                    <X role="button" size={12} onClick={() => !aliasBusy && removeAlias(alias)} />
                  </Badge>
                ))}
              </div>
            )}
            <div className="d-flex gap-2">
              <Form.Control
                size="sm"
                placeholder="ex: Agua"
                value={aliasInput}
                onChange={e => setAliasInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addAlias())}
              />
              <Button variant="outline-secondary" size="sm" disabled={aliasBusy || !aliasInput.trim()} onClick={addAlias} className="flex-shrink-0 d-inline-flex align-items-center gap-1">
                {aliasBusy ? <Loader2 className="spin" size={14} /> : <Plus size={14} />}
                Adicionar
              </Button>
            </div>
            {aliasError && <Alert variant="danger" className="py-2 small mt-2 mb-0">{aliasError}</Alert>}
          </Form.Group>

          <Form.Group>
            <Form.Label className="text-muted small text-uppercase fw-bold">Imagem</Form.Label>
            <div className="d-flex align-items-center gap-3">
              {editingImagePath ? (
                <AuthImage
                  path={editingImagePath}
                  alt={editingGroup?.key ?? ''}
                  className="rounded border"
                  style={{ width: 64, height: 64, objectFit: 'cover' }}
                />
              ) : (
                <div className="rounded border d-flex align-items-center justify-content-center text-muted bg-light flex-shrink-0" style={{ width: 64, height: 64 }}>
                  <ImageIcon size={22} />
                </div>
              )}
              <div className="d-flex flex-column gap-2">
                <Form.Label
                  className={`btn btn-outline-secondary btn-sm mb-0 d-inline-flex align-items-center gap-1 ${imageBusy ? 'disabled' : ''}`}
                >
                  {imageBusy ? <Loader2 className="spin" size={14} /> : <ImagePlus size={14} />}
                  {editingImagePath ? 'Trocar' : 'Carregar'}
                  <Form.Control
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="d-none"
                    disabled={imageBusy}
                    onChange={e => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) uploadImage(file);
                      (e.target as HTMLInputElement).value = '';
                    }}
                  />
                </Form.Label>
                {editingImagePath && (
                  <Button variant="link" size="sm" className="text-danger p-0" disabled={imageBusy} onClick={removeImage}>
                    Remover
                  </Button>
                )}
              </div>
            </div>
            {imageError && <Alert variant="danger" className="py-2 small mt-2 mb-0">{imageError}</Alert>}
          </Form.Group>

          <Form.Group>
            <Form.Label className="text-muted small text-uppercase fw-bold">Artigos semelhantes</Form.Label>
            <p className="text-muted mb-2" style={{ fontSize: '0.75rem' }}>
              Para comparar marcas próprias diferentes (ex: a água de marca do Lidl vs. a do Aldi) — ao contrário dos
              nomes alternativos, isto não junta as compras, só liga os dois artigos para comparares o preço.
            </p>
            {similarNames.length > 0 && (
              <div className="d-flex flex-column gap-2 mb-2">
                {similarNames.map(name => {
                  const info = productGroupsByKey.get(name);
                  const lastOccurrence = info?.occurrences[0];
                  return (
                    <div key={name} className="d-flex align-items-center justify-content-between gap-2 border rounded-3 px-3 py-2">
                      <div className="min-w-0">
                        <div className="fw-semibold small text-truncate">{name}</div>
                        {lastOccurrence && (
                          <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                            {lastOccurrence.unitPrice.toFixed(2)} € · {lastOccurrence.storeName}
                          </div>
                        )}
                      </div>
                      <X role="button" size={14} className="text-muted flex-shrink-0" onClick={() => !similarBusy && removeSimilarProduct(name)} />
                    </div>
                  );
                })}
              </div>
            )}
            <div className="d-flex gap-2">
              <Form.Control
                size="sm"
                list="items-similar-options"
                placeholder="ex: Água 1,5L (Aldi)"
                value={similarInput}
                onChange={e => setSimilarInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSimilarProduct())}
              />
              <datalist id="items-similar-options">
                {allProductNames.filter(n => n !== editingGroup?.key).map(n => <option key={n} value={n} />)}
              </datalist>
              <Button variant="outline-secondary" size="sm" disabled={similarBusy || !similarInput.trim()} onClick={addSimilarProduct} className="flex-shrink-0 d-inline-flex align-items-center gap-1">
                {similarBusy ? <Loader2 className="spin" size={14} /> : <Plus size={14} />}
                Ligar
              </Button>
            </div>
            {similarError && <Alert variant="danger" className="py-2 small mt-2 mb-0">{similarError}</Alert>}
          </Form.Group>
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
