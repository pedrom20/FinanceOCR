import React, { useState } from 'react';
import { PieChart, Download, Loader2 } from 'lucide-react';
import { apiFetch } from '../api';

export const Reports = () => {
  const [downloading, setDownloading] = useState(false);

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const response = await apiFetch('/api/reports/pdf');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'relatorio-finocr.pdf';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Erro ao descarregar relatório.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="bg-white p-12 rounded-3xl shadow-sm text-center">
      <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
        <PieChart size={40} />
      </div>
      <h2 className="text-2xl font-bold mb-2">Relatórios Detalhados</h2>
      <p className="text-slate-500 mb-8 max-w-sm mx-auto">Gere um PDF profissional com todas as suas despesas para contabilidade ou controlo pessoal.</p>
      <button onClick={downloadPdf} disabled={downloading} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-3 mx-auto hover:bg-black disabled:opacity-50 transition-all">
        {downloading ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
        {downloading ? 'A gerar...' : 'Descarregar PDF'}
      </button>
    </div>
  );
};
