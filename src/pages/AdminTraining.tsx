import React, { useEffect, useState } from 'react';
import { Card, Form, Button, Row, Col, ListGroup, InputGroup, Alert, Table } from 'react-bootstrap';
import { GraduationCap, Plus, Loader2, Trash2 } from 'lucide-react';
import { apiFetch, apiJson, ApiError } from '../api';
import { COUNTRY_NAMES, countryFlag } from '../countries';

function formatQuantity(quantity: number, unit?: string): string {
  if (unit === 'kg') {
    return `${quantity.toFixed(3).replace(/\.?0+$/, '')} kg`;
  }
  return `${quantity} un`;
}

interface TrainingExample {
  id: string;
  storeNif: string;
  storeName: string;
  fileName: string | null;
  createdAt: string;
  createdByEmail: string | null;
}

export const AdminTraining = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extracted, setExtracted] = useState<any>(null);
  const [error, setError] = useState('');
  const [examples, setExamples] = useState<TrainingExample[]>([]);
  const [examplesError, setExamplesError] = useState('');

  const loadExamples = () => {
    apiJson<TrainingExample[]>('/api/admin/training-examples')
      .then(setExamples)
      .catch(() => setExamplesError('Falha ao carregar exemplos.'));
  };

  useEffect(loadExamples, []);

  const handleProcess = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiFetch('/api/admin/training/process', { method: 'POST', body: formData });
      setExtracted(await response.json());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao processar ficheiro.');
    } finally {
      setLoading(false);
    }
  };

  const saveExample = async () => {
    if (!extracted) return;
    setSaving(true);
    setError('');
    try {
      await apiFetch('/api/admin/training-examples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(extracted),
      });
      setExtracted(null);
      setFile(null);
      loadExamples();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao guardar exemplo.');
    } finally {
      setSaving(false);
    }
  };

  const deleteExample = async (id: string) => {
    if (!window.confirm('Apagar este exemplo de treino?')) return;
    try {
      await apiFetch(`/api/admin/training-examples/${id}`, { method: 'DELETE' });
      setExamples(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      alert('Erro ao apagar exemplo.');
    }
  };

  return (
    <div className="d-flex flex-column gap-4">
      <div className="page-header">
        <div>
          <h1>Treino do OCR</h1>
          <p>
            Não existe um modelo local a re-treinar — o OCR é tesseract + regras locais, com uma API de IA externa como
            fallback. Esta área corrige um recibo à mão uma vez; da próxima vez que aparecer uma fatura do mesmo
            comerciante (pelo NIF), essa correção é dada à IA como referência do formato esperado.
          </p>
        </div>
      </div>

      {!extracted ? (
        <Card className="border-2 border-dashed text-center mx-auto" style={{ maxWidth: 640 }}>
          <Card.Body className="p-4 p-sm-5">
            <div className="d-inline-flex bg-success bg-opacity-10 text-success rounded-circle p-3 mb-3">
              <GraduationCap size={32} />
            </div>
            <Card.Title as="h2" className="h4 fw-bold">Novo exemplo de treino</Card.Title>
            <Card.Text className="text-muted">Carrega um recibo (idealmente um que a OCR já tenha lido mal antes)</Card.Text>
            <Form.Control
              type="file"
              accept="image/jpeg,image/png,image/webp,image/bmp,application/pdf"
              onChange={e => setFile((e.target as HTMLInputElement).files?.[0] || null)}
              className="mb-4 mx-auto"
              style={{ maxWidth: 320 }}
            />
            {error && <Alert variant="danger" className="text-start">{error}</Alert>}
            <Button variant="dark" disabled={!file || loading} onClick={handleProcess} className="d-inline-flex align-items-center gap-2">
              {loading ? <Loader2 className="spin" size={18} /> : <Plus size={20} />}
              {loading ? 'A processar OCR...' : 'Processar Agora'}
            </Button>
          </Card.Body>
        </Card>
      ) : (
        <Card>
          <Card.Header className="bg-light d-flex justify-content-between align-items-center">
            <span className="fw-bold">Corrigir antes de guardar como exemplo</span>
            <Button variant="link" className="text-danger p-0 text-decoration-none" onClick={() => setExtracted(null)}>Cancelar</Button>
          </Card.Header>
          <Card.Body>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label className="text-muted small text-uppercase fw-bold">Loja</Form.Label>
                  <Form.Control value={extracted.storeName} onChange={e => setExtracted({ ...extracted, storeName: e.target.value })} />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label className="text-muted small text-uppercase fw-bold">Localização</Form.Label>
                  <Form.Control value={extracted.storeLocation || ''} onChange={e => setExtracted({ ...extracted, storeLocation: e.target.value })} />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label className="text-muted small text-uppercase fw-bold">NIF (identifica o comerciante)</Form.Label>
                  <Form.Control value={extracted.storeNif} onChange={e => setExtracted({ ...extracted, storeNif: e.target.value })} />
                </Form.Group>
                <Form.Group>
                  <Form.Label className="text-muted small text-uppercase fw-bold">País</Form.Label>
                  <Form.Select value={extracted.country || 'PT'} onChange={e => setExtracted({ ...extracted, country: e.target.value })}>
                    {!(extracted.country in COUNTRY_NAMES) && extracted.country && (
                      <option value={extracted.country}>{extracted.country}</option>
                    )}
                    {Object.entries(COUNTRY_NAMES).map(([code, name]) => (
                      <option key={code} value={code}>{countryFlag(code)} {name}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label className="text-muted small text-uppercase fw-bold">Data</Form.Label>
                  <Form.Control type="date" value={extracted.invoiceDate} onChange={e => setExtracted({ ...extracted, invoiceDate: e.target.value })} />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label className="text-muted small text-uppercase fw-bold">Total</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type="number"
                      className="fs-3 fw-bold"
                      value={extracted.totalAmount}
                      onChange={e => setExtracted({ ...extracted, totalAmount: parseFloat(e.target.value) })}
                    />
                    <InputGroup.Text>€</InputGroup.Text>
                  </InputGroup>
                </Form.Group>
                <Form.Group>
                  <Form.Label className="text-muted small text-uppercase fw-bold">Método de pagamento</Form.Label>
                  <Form.Control value={extracted.paymentMethod} onChange={e => setExtracted({ ...extracted, paymentMethod: e.target.value })} />
                </Form.Group>
              </Col>
            </Row>

            {extracted.items && extracted.items.length > 0 && (
              <div className="mt-4">
                <Form.Label className="text-muted small text-uppercase fw-bold">Artigos ({extracted.items.length})</Form.Label>
                <ListGroup>
                  {extracted.items.map((item: any, idx: number) => (
                    <ListGroup.Item key={idx} className="d-flex align-items-center gap-2">
                      <div className="flex-grow-1 min-w-0">
                        <Form.Control
                          size="sm"
                          className="border-0 bg-transparent px-0"
                          value={item.productName}
                          onChange={e => {
                            const items = [...extracted.items];
                            items[idx] = { ...items[idx], productName: e.target.value };
                            setExtracted({ ...extracted, items });
                          }}
                        />
                        <div className="d-flex align-items-center gap-2 px-0" style={{ fontSize: '0.75rem' }}>
                          <Form.Select
                            size="sm"
                            className="border-0 bg-transparent p-0 text-muted"
                            style={{ width: 'auto', fontSize: '0.75rem' }}
                            value={item.quantityUnit || 'un'}
                            onChange={e => {
                              const items = [...extracted.items];
                              items[idx] = { ...items[idx], quantityUnit: e.target.value };
                              setExtracted({ ...extracted, items });
                            }}
                          >
                            <option value="un">un</option>
                            <option value="kg">kg</option>
                          </Form.Select>
                          <span className="text-muted">{formatQuantity(item.quantity, item.quantityUnit)}</span>
                        </div>
                      </div>
                      <Form.Control
                        size="sm"
                        type="number"
                        step="0.01"
                        className="border-0 bg-transparent text-end fw-semibold flex-shrink-0"
                        style={{ width: 90 }}
                        value={item.totalPrice}
                        onChange={e => {
                          const price = parseFloat(e.target.value) || 0;
                          const items = [...extracted.items];
                          items[idx] = { ...items[idx], totalPrice: price };
                          setExtracted({ ...extracted, items });
                        }}
                      />
                      <Button
                        variant="link"
                        className="text-muted p-0 flex-shrink-0"
                        onClick={() => setExtracted({ ...extracted, items: extracted.items.filter((_: any, i: number) => i !== idx) })}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </div>
            )}
            {error && <Alert variant="danger" className="mt-3 mb-0">{error}</Alert>}
          </Card.Body>
          <Card.Footer className="bg-light d-flex justify-content-end">
            <Button variant="primary" disabled={saving || !extracted.storeNif} onClick={saveExample} className="d-inline-flex align-items-center gap-2 fw-bold px-4">
              {saving && <Loader2 className="spin" size={18} />}
              {saving ? 'A guardar...' : 'Guardar como exemplo de treino'}
            </Button>
          </Card.Footer>
        </Card>
      )}

      <Card>
        <Card.Header className="bg-light fw-bold">Exemplos guardados ({examples.length})</Card.Header>
        {examplesError && <Alert variant="danger" className="m-3 mb-0">{examplesError}</Alert>}
        {examples.length > 0 ? (
          <Table responsive hover className="mb-0 align-middle">
            <thead>
              <tr className="text-muted text-uppercase small">
                <th className="px-3 py-3">Comerciante</th>
                <th className="px-3 py-3">NIF</th>
                <th className="px-3 py-3">Guardado por</th>
                <th className="px-3 py-3">Data</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {examples.map(ex => (
                <tr key={ex.id}>
                  <td className="px-3 fw-bold">{ex.storeName}</td>
                  <td className="px-3 text-muted">{ex.storeNif}</td>
                  <td className="px-3 text-muted small">{ex.createdByEmail}</td>
                  <td className="px-3 text-muted small">{ex.createdAt?.slice(0, 10)}</td>
                  <td className="px-3 text-end">
                    <Button variant="light" className="btn-action btn-action-danger" onClick={() => deleteExample(ex.id)} title="Apagar">
                      <Trash2 size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          !examplesError && <p className="text-center text-muted small py-4 mb-0">Ainda não há exemplos de treino guardados.</p>
        )}
      </Card>
    </div>
  );
};
