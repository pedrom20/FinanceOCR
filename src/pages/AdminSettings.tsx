import React, { useEffect, useState } from 'react';
import { Loader2, Save, ShieldCheck } from 'lucide-react';
import { apiJson, ApiError } from '../api';

interface SettingsResponse {
  anthropicApiKeyConfigured: boolean;
  anthropicModel: string;
}

export const AdminSettings = () => {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [modelInput, setModelInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiJson<SettingsResponse>('/api/settings')
      .then(data => {
        setSettings(data);
        setModelInput(data.anthropicModel);
      })
      .catch(() => setError('Falha ao carregar definições.'));
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const data = await apiJson<SettingsResponse>('/api/settings', {
        method: 'POST',
        body: JSON.stringify({ anthropicApiKey: apiKeyInput, anthropicModel: modelInput }),
      });
      setSettings(data);
      setApiKeyInput('');
      setMessage('Definições guardadas.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao guardar definições.');
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return error ? <p className="text-red-500 text-sm">{error}</p> : null;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-slate-800">Definições</h1>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 sm:p-6 bg-slate-50 border-b flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h2 className="font-bold text-slate-800">IA (Anthropic Claude)</h2>
            <p className="text-xs text-slate-400">Usada como fallback do OCR e para sugerir categorias dos artigos.</p>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase">Chave API</label>
            <input
              type="password"
              autoComplete="off"
              className="w-full mt-1 border-b py-2 outline-none focus:border-emerald-500"
              placeholder={settings.anthropicApiKeyConfigured ? '•••••••••••••••• (configurada — deixa em branco para manter)' : 'sk-ant-...'}
              value={apiKeyInput}
              onChange={e => setApiKeyInput(e.target.value)}
            />
            <p className="text-xs text-slate-400 mt-1">
              {settings.anthropicApiKeyConfigured ? 'Uma chave já está configurada. Escreve uma nova para a substituir.' : 'Nenhuma chave configurada — o OCR usa só o parser local.'}
            </p>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase">Modelo</label>
            <input
              className="w-full mt-1 border-b py-2 outline-none focus:border-emerald-500"
              placeholder="claude-haiku-4-5-20251001"
              value={modelInput}
              onChange={e => setModelInput(e.target.value)}
            />
          </div>

          {message && <p className="text-emerald-600 text-sm">{message}</p>}
          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            onClick={save}
            disabled={saving}
            className="w-full sm:w-auto bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            {saving ? 'A guardar...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
};
