import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Card } from 'react-bootstrap';
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

      {/* Lista em cartões em vez de tabela — uma tabela com nome de loja +
          data + valor + ações força scroll horizontal em ecrãs estreitos
          assim que o nome da loja é um pouco mais longo. */}
      <Card className="overflow-hidden">
        {invoices.map((inv, idx) => (
          <div key={inv.id} className={`p-3 ${idx < invoices.length - 1 ? 'border-bottom' : ''}`}>
            <div className="d-flex align-items-start justify-content-between gap-2">
              <div style={{ minWidth: 0 }}>
                <div className="fw-bold text-break">{inv.storeName}</div>
                {inv.storeLocation && inv.storeLocation !== inv.storeName && (
                  <div className="text-muted small text-break">{inv.storeLocation}</div>
                )}
                <div className="text-muted small">{inv.invoiceDate}</div>
              </div>
              <div className="fw-bold text-success flex-shrink-0 text-end">{inv.totalAmount.toFixed(2)} €</div>
            </div>
            <div className="d-flex justify-content-end align-items-center gap-2 mt-2">
              {inv.fileName && (
                <Button variant="light" className="btn-action btn-action-view" onClick={() => downloadFile(inv.fileName!)} title="Descarregar">
                  <Download size={15} />
                </Button>
              )}
              <Button variant="light" className="btn-action btn-action-danger" onClick={() => deleteInvoice(inv.id, inv.storeName)} title="Apagar">
                <Trash2 size={14} />
              </Button>
              <Link to={`/invoices/${inv.id}`} className="btn-action btn-action-primary d-inline-flex" title="Ver detalhes">
                <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        ))}
      </Card>
      {invoices.length === 0 && !error && <p className="text-center text-muted py-4">Ainda não tens faturas guardadas.</p>}
    </div>
  );
};
