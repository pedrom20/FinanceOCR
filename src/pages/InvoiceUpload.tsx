import React, { useState } from 'react';
import { Card, Form, Button, Row, Col, ListGroup, InputGroup } from 'react-bootstrap';
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

  if (!invoice) {
    return (
      <Card className="border-2 border-dashed text-center mx-auto" style={{ maxWidth: 640 }}>
        <Card.Body className="p-4 p-sm-5">
          <div className="d-inline-flex bg-success bg-opacity-10 text-success rounded-circle p-3 mb-3">
            <UploadCloud size={32} />
          </div>
          <Card.Title as="h2" className="h4 fw-bold">Novo Documento</Card.Title>
          <Card.Text className="text-muted">Arraste a sua fatura ou selecione um ficheiro</Card.Text>
          <Form.Control
            type="file"
            accept="image/jpeg,image/png,image/webp,image/bmp,application/pdf"
            onChange={e => setFile((e.target as HTMLInputElement).files?.[0] || null)}
            className="mb-4 mx-auto"
            style={{ maxWidth: 320 }}
          />
          <Button variant="dark" disabled={!file || loading} onClick={handleProcess} className="d-inline-flex align-items-center gap-2">
            {loading ? <Loader2 className="spin" size={18} /> : <Plus size={20} />}
            {loading ? 'A processar OCR...' : 'Processar Agora'}
          </Button>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Header className="bg-light d-flex justify-content-between align-items-center">
        <span className="fw-bold">Confirmar Dados Extraídos</span>
        <Button variant="link" className="text-danger p-0 text-decoration-none" onClick={() => setInvoice(null)}>Cancelar</Button>
      </Card.Header>
      <Card.Body>
        <Row className="g-3">
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label className="text-muted small text-uppercase fw-bold">Loja</Form.Label>
              <Form.Control value={invoice.storeName} onChange={e => setInvoice({ ...invoice, storeName: e.target.value })} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label className="text-muted small text-uppercase fw-bold">Localização</Form.Label>
              <Form.Control value={invoice.storeLocation || ''} onChange={e => setInvoice({ ...invoice, storeLocation: e.target.value })} />
            </Form.Group>
            <Form.Group>
              <Form.Label className="text-muted small text-uppercase fw-bold">NIF</Form.Label>
              <Form.Control value={invoice.storeNif} onChange={e => setInvoice({ ...invoice, storeNif: e.target.value })} />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label className="text-muted small text-uppercase fw-bold">Data</Form.Label>
              <Form.Control type="date" value={invoice.invoiceDate} onChange={e => setInvoice({ ...invoice, invoiceDate: e.target.value })} />
            </Form.Group>
            <Form.Group>
              <Form.Label className="text-muted small text-uppercase fw-bold">Total</Form.Label>
              <InputGroup>
                <Form.Control
                  type="number"
                  className="fs-3 fw-bold"
                  value={invoice.totalAmount}
                  onChange={e => setInvoice({ ...invoice, totalAmount: parseFloat(e.target.value) })}
                />
                <InputGroup.Text>€</InputGroup.Text>
              </InputGroup>
            </Form.Group>
          </Col>
        </Row>

        {invoice.items && invoice.items.length > 0 && (
          <div className="mt-4">
            <Form.Label className="text-muted small text-uppercase fw-bold">Artigos</Form.Label>
            <ListGroup>
              {invoice.items.map((item: any, idx: number) => (
                <ListGroup.Item key={idx} className="d-flex align-items-center gap-2">
                  <Form.Control
                    size="sm"
                    className="border-0 bg-transparent"
                    value={item.productName}
                    onChange={e => {
                      const items = [...invoice.items];
                      items[idx] = { ...items[idx], productName: e.target.value };
                      setInvoice({ ...invoice, items });
                    }}
                  />
                  <Form.Control
                    size="sm"
                    type="number"
                    step="0.01"
                    className="border-0 bg-transparent text-end fw-semibold flex-shrink-0"
                    style={{ width: 90 }}
                    value={item.unitPrice}
                    onChange={e => {
                      const price = parseFloat(e.target.value) || 0;
                      const items = [...invoice.items];
                      items[idx] = { ...items[idx], unitPrice: price, totalPrice: price };
                      setInvoice({ ...invoice, items });
                    }}
                  />
                  <Button
                    variant="link"
                    className="text-muted p-0 flex-shrink-0"
                    onClick={() => setInvoice({ ...invoice, items: invoice.items.filter((_: any, i: number) => i !== idx) })}
                  >
                    <Trash2 size={16} />
                  </Button>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </div>
        )}
      </Card.Body>
      <Card.Footer className="bg-light d-flex justify-content-end">
        <Button variant="primary" disabled={saving} onClick={saveInvoice} className="d-inline-flex align-items-center gap-2 fw-bold px-4">
          {saving && <Loader2 className="spin" size={18} />}
          {saving ? 'A guardar...' : 'Guardar Fatura'}
        </Button>
      </Card.Footer>
    </Card>
  );
};
