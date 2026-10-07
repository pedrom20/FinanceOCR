import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Alert } from 'react-bootstrap';
import { BarChart, Bar, Cell, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Wallet, Receipt, Store, Tag } from 'lucide-react';
import { apiJson } from '../api';
import { Invoice } from '../types';

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Ordinal verde (161° hue, âncora na cor de marca #059669), validado com o
// script do skill de dataviz: luminosidade monótona, gaps >=0.06, extremo
// claro acima de 2:1 de contraste no fundo branco do card. Mapeado por
// ranking de gasto (mais escuro = mês com mais despesa), não por mês fixo —
// a cor segue a grandeza, não a identidade de uma categoria.
const SPEND_RAMP = ['#1bc08d', '#17a176', '#12815f', '#0e6248', '#0a4331', '#05241a'];

interface ReportItem {
  totalPrice: number;
  category?: string;
}

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

/** Índice no SPEND_RAMP por posição no ranking (não pelo valor em si), para a cor variar mesmo quando os totais são próximos. */
function rampIndexByRank(data: { total: number }[]): number[] {
  const order = data.map((d, i) => i).sort((a, b) => data[a].total - data[b].total);
  const ranks = new Array(data.length).fill(0);
  order.forEach((originalIdx, rank) => {
    ranks[originalIdx] = Math.round((rank / Math.max(order.length - 1, 1)) * (SPEND_RAMP.length - 1));
  });
  return ranks;
}

function topCategory(items: ReportItem[]): string {
  const totals = new Map<string, number>();
  for (const item of items) {
    if (!item.category) continue;
    totals.set(item.category, (totals.get(item.category) ?? 0) + item.totalPrice);
  }
  let best = '';
  let bestTotal = -Infinity;
  for (const [category, spent] of totals) {
    if (spent > bestTotal) {
      best = category;
      bestTotal = spent;
    }
  }
  return best;
}

export const Dashboard = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [items, setItems] = useState<ReportItem[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiJson<Invoice[]>('/api/invoices')
      .then(setInvoices)
      .catch(() => setError('Falha ao carregar faturas.'));
    apiJson<{ items: ReportItem[] }>('/api/reports/items')
      .then(data => setItems(data.items))
      .catch(() => {});
  }, []);

  const total = invoices?.reduce((sum, inv) => sum + inv.totalAmount, 0) ?? 0;
  const count = invoices?.length ?? 0;
  const storeCount = invoices ? new Set(invoices.map(inv => inv.storeName)).size : 0;
  const bestCategory = topCategory(items);
  const chartData = invoices ? monthlyTotals(invoices) : [];
  const rampIndexes = rampIndexByRank(chartData);

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
        <Col md={6} lg={3}>
          <Card role="button" className="stat-card h-100" onClick={() => navigate('/reports')}>
            <div className="stat-icon bg-success bg-opacity-10 text-success">
              <Wallet size={20} />
            </div>
            <div>
              <h6>Gasto Total</h6>
              <h3 className="mb-0">{total.toFixed(2)} €</h3>
            </div>
          </Card>
        </Col>
        <Col md={6} lg={3}>
          <Card role="button" className="stat-card h-100" onClick={() => navigate('/invoices')}>
            <div className="stat-icon" style={{ color: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)' }}>
              <Receipt size={20} />
            </div>
            <div>
              <h6>Faturas Processadas</h6>
              <h3 className="mb-0">{count}</h3>
            </div>
          </Card>
        </Col>
        <Col md={6} lg={3}>
          <Card role="button" className="stat-card h-100" onClick={() => navigate('/stores')}>
            <div className="stat-icon" style={{ color: '#d97706', backgroundColor: 'rgba(217,119,6,0.1)' }}>
              <Store size={20} />
            </div>
            <div>
              <h6>Lojas Diferentes</h6>
              <h3 className="mb-0">{storeCount}</h3>
            </div>
          </Card>
        </Col>
        <Col md={6} lg={3}>
          <Card role="button" className="stat-card h-100" onClick={() => navigate('/items')}>
            <div className="stat-icon" style={{ color: '#0369a1', backgroundColor: 'rgba(3,105,161,0.1)' }}>
              <Tag size={20} />
            </div>
            <div>
              <h6>Categoria Principal</h6>
              <h3 className="mb-0 text-truncate">{bestCategory || '—'}</h3>
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
                <Tooltip cursor={{ fill: '#f8fafc' }} formatter={(value: number) => `${(value as number).toFixed(2)} €`} />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, idx) => (
                    <Cell key={entry.name} fill={SPEND_RAMP[rampIndexes[idx]]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
};
