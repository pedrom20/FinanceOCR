import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Alert } from 'react-bootstrap';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Wallet, Receipt } from 'lucide-react';
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
      <div className="page-header">
        <div>
          <h1>Olá de novo! 👋</h1>
          <p>Resumo das tuas despesas e faturas processadas.</p>
        </div>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      <Row className="g-4">
        <Col md={6}>
          <Card className="stat-card h-100">
            <div className="stat-icon bg-success bg-opacity-10 text-success">
              <Wallet size={20} />
            </div>
            <div>
              <h6>Gasto Total</h6>
              <h3 className="mb-0">{total.toFixed(2)} €</h3>
            </div>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="stat-card h-100">
            <div className="stat-icon bg-primary bg-opacity-10" style={{ color: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)' }}>
              <Receipt size={20} />
            </div>
            <div>
              <h6>Faturas Processadas</h6>
              <h3 className="mb-0">{count}</h3>
            </div>
          </Card>
        </Col>
      </Row>
      <Card>
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
