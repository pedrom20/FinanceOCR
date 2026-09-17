import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Table, Alert, Button, Card } from 'react-bootstrap';
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
      <div className="page-header">
        <div>
          <h1>Histórico de Compras</h1>
          <p>Todas as faturas e talões que já processaste.</p>
        </div>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}

      <Card className="overflow-hidden">
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
                    <Button variant="light" className="btn-action btn-action-view" onClick={() => downloadFile(inv.fileName!)} title="Descarregar">
                      <Download size={15} />
                    </Button>
                  )}
                </td>
                <td className="px-3 text-end text-nowrap">
                  <div className="d-inline-flex align-items-center gap-2">
                    <Button variant="light" className="btn-action btn-action-danger" onClick={() => deleteInvoice(inv.id, inv.storeName)} title="Apagar">
                      <Trash2 size={14} />
                    </Button>
                    <Link to={`/invoices/${inv.id}`} className="btn-action btn-action-primary d-inline-flex" title="Ver detalhes">
                      <ChevronRight size={16} />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      {invoices.length === 0 && !error && <p className="text-center text-muted py-4">Ainda não tens faturas guardadas.</p>}
    </div>
  );
};
