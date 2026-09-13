import React, { useEffect, useState } from 'react';
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
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-800">Olá de novo! 👋</h1>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500">Gasto Total</p>
          <h2 className="text-3xl font-black text-slate-900 mt-1">{total.toFixed(2)} €</h2>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500">Faturas Processadas</p>
          <h2 className="text-3xl font-black text-slate-900 mt-1">{count}</h2>
        </div>
      </div>
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-700 mb-6">Histórico de Despesas (últimos 6 meses)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: '#f8fafc' }} formatter={(value: number) => `${value.toFixed(2)} €`} />
              <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
