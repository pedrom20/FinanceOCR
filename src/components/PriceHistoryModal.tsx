import React from 'react';
import { Modal, Table } from 'react-bootstrap';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Occurrence {
  invoiceDate: string;
  storeName: string;
  unitPrice: number;
  quantityUnit?: string;
}

interface PriceHistoryModalProps {
  productName: string;
  occurrences: Occurrence[];
  onClose: () => void;
}

/** Preço a comparar é sempre o unitPrice: para artigos por kg já é €/kg (preço de mercado), não o totalPrice que varia com a quantidade comprada. */
export const PriceHistoryModal = ({ productName, occurrences, onClose }: PriceHistoryModalProps) => {
  const isKg = occurrences.some(o => o.quantityUnit === 'kg');
  const sorted = [...occurrences].sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate));
  const chartData = sorted.map(o => ({ date: o.invoiceDate, price: o.unitPrice }));

  return (
    <Modal show onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title className="h6 mb-0">{productName}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-muted small mb-3">
          Variação do preço {isKg ? 'por kg' : 'unitário'} ao longo das compras.
        </p>
        {chartData.length > 1 && (
          <div style={{ height: 200 }} className="mb-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} width={50} />
                <Tooltip formatter={(value: number) => `${Number(value).toFixed(2)} €${isKg ? '/kg' : ''}`} />
                <Line type="monotone" dataKey="price" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <Table size="sm" responsive className="mb-0">
          <thead>
            <tr className="text-muted text-uppercase small">
              <th>Data</th>
              <th>Loja</th>
              <th className="text-end">Preço{isKg ? '/kg' : ''}</th>
            </tr>
          </thead>
          <tbody>
            {[...sorted].reverse().map((o, idx) => (
              <tr key={idx}>
                <td className="small">{o.invoiceDate}</td>
                <td className="small">{o.storeName}</td>
                <td className="text-end small fw-semibold">{o.unitPrice.toFixed(2)} €{isKg ? '/kg' : ''}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Modal.Body>
    </Modal>
  );
};
