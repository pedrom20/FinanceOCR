import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Alert } from 'react-bootstrap';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { apiJson } from '../api';
import { Invoice } from '../types';

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function monthlyTotals(invoices: Invoice[]): { name: string; total: number }[] {
  const now = new Date();
  const buckets: { key: string; name: string; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, name: MONTH_LABELS[d.getMonth()], total: 0 });
  }
  const byKey = new Map(buckets.map(b => [b.key, b]));

  for (const inv of invoices) {
    const raw = inv.invoiceDate || inv.createdAt;
    if (!raw) continue;
    const d = new Date(raw);
    if (isNaN(d.getTime())) continue;
    const bucket = byKey.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (bucket) bucket.total += inv.totalAmount;
  }

  return buckets.map(({ name, total }) => ({ name, total }));
}

export const Dashboard = () => {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiJson<Invoice[]>('/api/invoices')
      .then(setInvoices)
      .catch(() => setError('Falha ao carregar faturas.'));
  }, []);

  const total = invoices?.reduce((sum, inv) => sum + inv.totalAmount, 0) ?? 0;
  const count = invoices?.length ?? 0;
  const chartData = invoices ? monthlyTotals(invoices) : [];

  return (
    <div className="d-flex flex-column gap-4">
      <h1 className="h3 fw-bold">Olá de novo! 👋</h1>
      {error && <Alert variant="danger">{error}</Alert>}
      <Row className="g-4">
        <Col md={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <Card.Subtitle className="text-muted small mb-1">Gasto Total</Card.Subtitle>
              <Card.Title className="display-6 fw-bold mb-0">{total.toFixed(2)} €</Card.Title>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <Card.Subtitle className="text-muted small mb-1">Faturas Processadas</Card.Subtitle>
              <Card.Title className="display-6 fw-bold mb-0">{count}</Card.Title>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      <Card className="border-0 shadow-sm">
        <Card.Body>
          <Card.Title className="h6 fw-bold mb-4">Histórico de Despesas (últimos 6 meses)</Card.Title>
          <div style={{ height: 256 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#f8fafc' }} formatter={(value: number) => `${value.toFixed(2)} €`} />
                <Bar dataKey="total" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
};
