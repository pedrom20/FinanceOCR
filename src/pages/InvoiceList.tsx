import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Table, Alert, Button } from 'react-bootstrap';
import { ChevronRight, Download, Trash2 } from 'lucide-react';
import { apiFetch, apiJson } from '../api';
import { Invoice } from '../types';

export const InvoiceList = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiJson<Invoice[]>('/api/invoices')
      .then(setInvoices)
      .catch(() => setError('Falha ao carregar faturas.'));
  }, []);

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

  const deleteInvoice = async (id: string, storeName: string) => {
    if (!window.confirm(`Apagar a fatura de "${storeName}"? Esta ação não pode ser desfeita.`)) {
      return;
    }
    try {
      await apiFetch(`/api/invoices/${id}`, { method: 'DELETE' });
      setInvoices(prev => prev.filter(inv => inv.id !== id));
    } catch (err) {
      alert('Erro ao apagar fatura.');
    }
  };

  return (
    <div className="d-flex flex-column gap-3">
      <h1 className="h3 fw-bold">Histórico de Compras</h1>
      {error && <Alert variant="danger">{error}</Alert>}

      <div className="bg-white rounded-3 shadow-sm border">
        <Table responsive hover className="mb-0 align-middle">
          <thead>
            <tr className="text-muted text-uppercase small">
              <th className="px-3 py-3">Data</th>
              <th className="px-3 py-3">Loja</th>
              <th className="px-3 py-3 text-end">Valor</th>
              <th className="px-3 py-3 text-center">Ficheiro</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv => (
              <tr key={inv.id}>
                <td className="px-3 small">{inv.invoiceDate}</td>
                <td className="px-3">
                  <div className="fw-bold">{inv.storeName}</div>
                  {inv.storeLocation && inv.storeLocation !== inv.storeName && (
                    <div className="text-muted small">{inv.storeLocation}</div>
                  )}
                </td>
                <td className="px-3 text-end fw-bold text-success">{inv.totalAmount.toFixed(2)} €</td>
                <td className="px-3 text-center">
                  {inv.fileName && (
                    <Button variant="link" className="text-muted p-0" onClick={() => downloadFile(inv.fileName!)}>
                      <Download size={18} />
                    </Button>
                  )}
                </td>
                <td className="px-3 text-end text-nowrap">
                  <Button variant="link" className="text-danger p-0 me-3" onClick={() => deleteInvoice(inv.id, inv.storeName)}>
                    <Trash2 size={16} />
                  </Button>
                  <Link to={`/invoices/${inv.id}`} className="text-success">
                    <ChevronRight size={18} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      {invoices.length === 0 && !error && <p className="text-center text-muted py-4">Ainda não tens faturas guardadas.</p>}
    </div>
  );
};
