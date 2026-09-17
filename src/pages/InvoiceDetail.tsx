import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Card, Table, Button, Badge, Form, Modal, Alert } from 'react-bootstrap';
import { ArrowLeft, Download, Pencil, RefreshCw, Trash2, Check, X } from 'lucide-react';
import { apiFetch, apiJson, ApiError } from '../api';
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
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [categoryInput, setCategoryInput] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const [showReprocessModal, setShowReprocessModal] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessError, setReprocessError] = useState('');

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
      return item.category ? <Badge bg="success" className="bg-opacity-25 text-success fw-normal">{item.category}</Badge> : null;
    }

    if (editingItemId === item.id) {
      return (
        <span className="d-inline-flex align-items-center gap-1">
          <Form.Control
            list="category-options"
            autoFocus
            size="sm"
            style={{ width: 130 }}
            value={categoryInput}
            onChange={e => setCategoryInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveCategory(item.id!)}
          />
          <Button variant="link" className="text-success p-0" disabled={savingCategory} onClick={() => saveCategory(item.id!)}>
            <Check size={16} />
          </Button>
          <Button variant="link" className="text-danger p-0" onClick={() => setEditingItemId(null)}>
            <X size={16} />
          </Button>
        </span>
      );
    }

    return (
      <span role="button" className="d-inline-flex align-items-center gap-1 text-decoration-none" onClick={() => startEditingCategory(item)}>
        {item.category ? (
          <Badge bg="success" className="bg-opacity-25 text-success fw-normal">{item.category}</Badge>
        ) : (
          <span className="text-muted small">+ categoria</span>
        )}
        <Pencil size={10} className="text-muted" />
      </span>
    );
  };

  const reprocessInvoice = async () => {
    if (!invoice) return;
    setReprocessing(true);
    setReprocessError('');
    try {
      const updated = await apiJson<Invoice>(`/api/invoices/${invoice.id}/reprocess`, { method: 'POST' });
      setInvoice(updated);
      setShowReprocessModal(false);
    } catch (err) {
      setReprocessError(err instanceof ApiError ? err.message : 'Falha ao reprocessar fatura.');
    } finally {
      setReprocessing(false);
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

  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!invoice) return null;

  return (
    <div className="d-flex flex-column gap-3 mx-auto" style={{ maxWidth: 900 }}>
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <Link to="/invoices" className="d-inline-flex align-items-center gap-2 text-muted text-decoration-none small">
          <ArrowLeft size={16} /> Voltar às faturas
        </Link>
        <div className="d-flex align-items-center gap-3">
          {invoice.fileName && (
            <Button variant="link" className="text-muted text-decoration-none p-0 d-inline-flex align-items-center gap-2 small" onClick={() => setShowReprocessModal(true)}>
              <RefreshCw size={16} /> Reprocessar
            </Button>
          )}
          <Button variant="link" className="text-danger text-decoration-none p-0 d-inline-flex align-items-center gap-2 small" disabled={deleting} onClick={deleteInvoice}>
            <Trash2 size={16} /> {deleting ? 'A apagar...' : 'Apagar fatura'}
          </Button>
        </div>
      </div>

      <Modal show={showReprocessModal} onHide={() => !reprocessing && setShowReprocessModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title className="h6">Reprocessar fatura</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="small text-muted">
            Isto volta a correr o OCR sobre o documento original desta fatura e substitui os dados extraídos (loja, data, total, artigos) pelo resultado novo. Correções que tenhas feito à mão (nomes, categorias) podem ser substituídas se a extração vier diferente.
          </p>
          {reprocessError && <Alert variant="danger" className="py-2 small mb-0">{reprocessError}</Alert>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" disabled={reprocessing} onClick={() => setShowReprocessModal(false)}>Cancelar</Button>
          <Button variant="primary" disabled={reprocessing} onClick={reprocessInvoice} className="d-inline-flex align-items-center gap-2">
            <RefreshCw size={16} className={reprocessing ? 'spin' : ''} />
            {reprocessing ? 'A reprocessar...' : 'Reprocessar'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Card>
        <Card.Header className="bg-light d-flex flex-wrap justify-content-between align-items-start gap-3">
          <div>
            <h1 className="h5 fw-bold mb-0">{invoice.storeName}</h1>
            {invoice.storeLocation && invoice.storeLocation !== invoice.storeName && (
              <p className="text-muted small mb-0">{invoice.storeLocation}</p>
            )}
            {invoice.storeNif && <p className="text-muted small mb-0">NIF: {invoice.storeNif}</p>}
            <Link to="/stores" className="small">Editar loja</Link>
          </div>
          <div className="text-end">
            <p className="fs-3 fw-black text-success mb-0">{invoice.totalAmount.toFixed(2)} €</p>
            <p className="text-muted small mb-0">{invoice.invoiceDate}</p>
          </div>
        </Card.Header>

        {invoice.fileName && (
          <Card.Body className="border-bottom py-3">
            <Button variant="link" className="text-muted text-decoration-none p-0 d-inline-flex align-items-center gap-2" onClick={() => downloadFile(invoice.fileName!)}>
              <Download size={16} /> Descarregar documento original
            </Button>
          </Card.Body>
        )}

        {invoice.items && invoice.items.length > 0 && (
          <Card.Body>
            <h2 className="text-muted text-uppercase small fw-bold mb-3">Artigos</h2>
            <Table responsive className="align-middle mb-0">
              <thead>
                <tr className="text-muted text-uppercase small">
                  <th>Artigo</th>
                  <th>Categoria</th>
                  <th className="text-end">Quantidade</th>
                  <th className="text-end">Preço Unit.</th>
                  <th className="text-end">IVA</th>
                  <th className="text-end">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, idx) => (
                  <tr key={item.id ?? idx}>
                    <td className="fw-semibold">{item.productName}</td>
                    <td>{renderCategory(item)}</td>
                    <td className="text-end text-muted">{formatQuantity(item.quantity, item.quantityUnit)}</td>
                    <td className="text-end text-muted">
                      {item.unitPrice.toFixed(2)} €{item.quantityUnit === 'kg' ? '/kg' : ''}
                    </td>
                    <td className="text-end text-muted">{item.vatRate != null ? `${item.vatRate}%` : '—'}</td>
                    <td className="text-end fw-bold">{item.totalPrice.toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        )}

        {invoice.items && invoice.items.length > 0 && vatBreakdown(invoice.items).length > 0 && (
          <Card.Body className="pt-0">
            <h2 className="text-muted text-uppercase small fw-bold mb-3">IVA</h2>
            <Table responsive size="sm" className="mb-0">
              <thead>
                <tr className="text-muted text-uppercase small">
                  <th>Taxa</th>
                  <th className="text-end">Base Imp.</th>
                  <th className="text-end">Val. IVA</th>
                  <th className="text-end">Val. Total</th>
                </tr>
              </thead>
              <tbody>
                {vatBreakdown(invoice.items).map(row => (
                  <tr key={row.rate}>
                    <td>{row.rate}%</td>
                    <td className="text-end text-muted">{row.base.toFixed(2)} €</td>
                    <td className="text-end text-muted">{row.vat.toFixed(2)} €</td>
                    <td className="text-end">{row.total.toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        )}

        <Card.Footer className="bg-light d-flex justify-content-between align-items-center">
          <span className="fw-bold">{invoice.paymentMethod}</span>
          <span className="fs-5 fw-bold text-success">{invoice.totalAmount.toFixed(2)} €</span>
        </Card.Footer>
      </Card>

      <datalist id="category-options">
        {categoryOptions.map(c => <option key={c} value={c} />)}
      </datalist>
    </div>
  );
};
