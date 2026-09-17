import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Form, Row, Col, Button, Spinner, Alert, Badge } from 'react-bootstrap';
import { PieChart, Download, Loader2, Filter, ChevronDown, ChevronRight, Sparkles, TrendingUp } from 'lucide-react';
import { apiFetch, apiJson, ApiError } from '../api';
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

interface FiltersResponse {
  stores: string[];
  categories: string[];
  locations: string[];
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
  const [filterOptions, setFilterOptions] = useState<FiltersResponse>({ stores: [], categories: [], locations: [] });
  const [store, setStore] = useState('');
  const [location, setLocation] = useState('');
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
  const [historyGroup, setHistoryGroup] = useState<GroupedItem | null>(null);

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
      if (location) params.set('location', location);
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
  }, [store, location, category, search, dateFrom, dateTo, reloadKey]);

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

  return (
    <div className="d-flex flex-column gap-4">
      <Card className="border-0 shadow-sm text-center">
        <Card.Body className="p-4 p-sm-5">
          <div className="d-inline-flex align-items-center justify-content-center bg-primary bg-opacity-10 text-primary rounded-circle p-3 mb-3" style={{ width: 72, height: 72 }}>
            <PieChart size={36} />
          </div>
          <Card.Title as="h2" className="h4 fw-bold">Relatórios Detalhados</Card.Title>
          <Card.Text className="text-muted mx-auto mb-4" style={{ maxWidth: 420 }}>
            Gera um PDF profissional com todas as tuas despesas para contabilidade ou controlo pessoal.
          </Card.Text>
          <Button variant="dark" disabled={downloading} onClick={downloadPdf} className="d-inline-flex align-items-center gap-2 px-4 py-2 fw-bold">
            {downloading ? <Loader2 className="spin" size={20} /> : <Download size={20} />}
            {downloading ? 'A gerar...' : 'Descarregar PDF'}
          </Button>
        </Card.Body>
      </Card>

      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-light d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div className="d-flex align-items-center gap-2">
            <Filter size={18} className="text-muted" />
            <span className="fw-bold">Filtrar Despesas</span>
          </div>
          <div className="d-flex align-items-center gap-3">
            <Button
              variant="outline-secondary"
              size="sm"
              disabled={categorizing}
              onClick={categorizeMissing}
              className="d-inline-flex align-items-center gap-2"
            >
              {categorizing ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />}
              {categorizing ? 'A categorizar...' : 'Categorizar artigos em falta'}
            </Button>
            {categorizeResult && <span className="text-muted small">{categorizeResult}</span>}
          </div>
        </Card.Header>

        <Card.Body>
          <Row className="g-3">
            <Col xs={12} sm={6} md={4}>
              <Form.Group>
                <Form.Label className="text-muted small text-uppercase fw-bold mb-1">Artigo</Form.Label>
                <Form.Control size="sm" placeholder="ex: limão" value={search} onChange={e => setSearch(e.target.value)} />
              </Form.Group>
            </Col>
            <Col xs={6} md={2}>
              <Form.Group>
                <Form.Label className="text-muted small text-uppercase fw-bold mb-1">Loja</Form.Label>
                <Form.Select size="sm" value={store} onChange={e => setStore(e.target.value)}>
                  <option value="">Todas</option>
                  {filterOptions.stores.map(s => <option key={s} value={s}>{s}</option>)}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col xs={6} md={2}>
              <Form.Group>
                <Form.Label className="text-muted small text-uppercase fw-bold mb-1">Localização</Form.Label>
                <Form.Select size="sm" value={location} onChange={e => setLocation(e.target.value)}>
                  <option value="">Todas</option>
                  {filterOptions.locations.map(l => <option key={l} value={l}>{l}</option>)}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col xs={6} md={2}>
              <Form.Group>
                <Form.Label className="text-muted small text-uppercase fw-bold mb-1">Categoria</Form.Label>
                <Form.Select size="sm" value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="">Todas</option>
                  {filterOptions.categories.map(c => <option key={c} value={c}>{c}</option>)}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col xs={6} md={1}>
              <Form.Group>
                <Form.Label className="text-muted small text-uppercase fw-bold mb-1">De</Form.Label>
                <Form.Control size="sm" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </Form.Group>
            </Col>
            <Col xs={6} md={1}>
              <Form.Group>
                <Form.Label className="text-muted small text-uppercase fw-bold mb-1">Até</Form.Label>
                <Form.Control size="sm" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>

        <div className="px-3 pb-2 d-flex align-items-center justify-content-between">
          <span className="text-muted small">{items.length} artigo{items.length !== 1 ? 's' : ''}</span>
          <span className="fs-4 fw-black text-success">{total.toFixed(2)} €</span>
        </div>

        {error && <Alert variant="danger" className="mx-3">{error}</Alert>}
        {loading && (
          <div className="d-flex justify-content-center py-4"><Spinner animation="border" variant="success" size="sm" /></div>
        )}

        {!loading && groups.length > 0 && (
          <Card.Body className="pt-0 d-flex flex-column gap-2">
            {groups.map(group => {
              const isOpen = expanded.has(group.productName);
              return (
                <div key={group.productName} className="border rounded-3 overflow-hidden">
                  <div className="d-flex align-items-center">
                    <button
                      onClick={() => toggleExpanded(group.productName)}
                      className="btn d-flex align-items-center gap-3 p-3 text-start flex-grow-1 bg-transparent border-0"
                    >
                      {isOpen ? <ChevronDown size={16} className="text-muted flex-shrink-0" /> : <ChevronRight size={16} className="text-muted flex-shrink-0" />}
                      <div className="min-w-0 flex-grow-1 text-truncate">
                        <div className="fw-semibold small text-truncate">{group.productName}</div>
                        <div className="mt-1 text-muted d-flex flex-wrap gap-2" style={{ fontSize: '0.75rem' }}>
                          <span>{group.count} compra{group.count !== 1 ? 's' : ''}</span>
                          {group.category && <Badge bg="success" className="bg-opacity-25 text-success fw-normal">{group.category}</Badge>}
                        </div>
                      </div>
                      <span className="fw-bold small flex-shrink-0">{group.totalSpent.toFixed(2)} €</span>
                    </button>
                    <Button
                      variant="link"
                      className="text-muted flex-shrink-0 me-2"
                      title="Ver variação de preço"
                      onClick={() => setHistoryGroup(group)}
                    >
                      <TrendingUp size={16} />
                    </Button>
                  </div>

                  {isOpen && (
                    <div className="border-top bg-light">
                      {group.occurrences.map((item, idx) => (
                        <Link
                          key={idx}
                          to={`/invoices/${item.invoiceId}`}
                          className="d-flex align-items-center justify-content-between gap-3 px-3 py-2 ps-5 small text-decoration-none text-body border-bottom"
                        >
                          <div className="min-w-0 text-truncate">
                            <div className="text-muted text-truncate">{item.storeName}</div>
                            <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                              {item.invoiceDate} · {formatQuantity(item.quantity, item.quantityUnit)} × {item.unitPrice.toFixed(2)} €{item.quantityUnit === 'kg' ? '/kg' : ''}
                            </div>
                          </div>
                          <span className="fw-semibold flex-shrink-0">{item.totalPrice.toFixed(2)} €</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </Card.Body>
        )}

        {!loading && items.length === 0 && !error && (
          <p className="text-center text-muted small py-4">Sem artigos para os filtros selecionados.</p>
        )}
      </Card>

      {historyGroup && (
        <PriceHistoryModal
          productName={historyGroup.productName}
          occurrences={historyGroup.occurrences}
          onClose={() => setHistoryGroup(null)}
        />
      )}
    </div>
  );
};
