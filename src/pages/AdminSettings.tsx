import React, { useEffect, useState } from 'react';
import { ExternalLink, Loader2, Save, ShieldCheck } from 'lucide-react';
import { apiJson, ApiError } from '../api';

interface ProviderInfo {
  label: string;
  configured: boolean;
  model: string;
  defaultModel: string;
}

const PROVIDER_HELP: Record<string, { url: string; steps: string }> = {
  anthropic: {
    url: 'https://console.anthropic.com/settings/keys',
    steps: 'console.anthropic.com → inicia sessão → Settings → API Keys → Create Key',
  },
  openai: {
    url: 'https://platform.openai.com/api-keys',
    steps: 'platform.openai.com/api-keys → inicia sessão → Create new secret key',
  },
  google: {
    url: 'https://aistudio.google.com/apikey',
    steps: 'aistudio.google.com/apikey → inicia sessão com uma conta Google → Create API key',
  },
};

interface SettingsResponse {
  activeProvider: string;
  providers: Record<string, ProviderInfo>;
}

export const AdminSettings = () => {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [activeProvider, setActiveProvider] = useState('');
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({});
  const [modelInputs, setModelInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiJson<SettingsResponse>('/api/settings')
      .then(data => {
        setSettings(data);
        setActiveProvider(data.activeProvider);
        const models: Record<string, string> = {};
        Object.entries(data.providers).forEach(([key, p]) => { models[key] = p.model; });
        setModelInputs(models);
      })
      .catch(() => setError('Falha ao carregar definições.'));
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const body: Record<string, unknown> = { activeProvider };
      for (const key of Object.keys(settings?.providers ?? {})) {
        body[key] = { apiKey: apiKeyInputs[key] ?? '', model: modelInputs[key] ?? '' };
      }
      const data = await apiJson<SettingsResponse>('/api/settings', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setSettings(data);
      setApiKeyInputs({});
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
            <h2 className="font-bold text-slate-800">Fornecedores de IA</h2>
            <p className="text-xs text-slate-400">Usada como fallback do OCR e para sugerir categorias dos artigos. Podes configurar vários e escolher qual está ativo.</p>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {Object.entries(settings.providers).map(([key, provider]) => (
            <div key={key} className="p-4 sm:p-6 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="activeProvider"
                  checked={activeProvider === key}
                  onChange={() => setActiveProvider(key)}
                  className="accent-emerald-600"
                />
                <span className="font-bold text-slate-800">{provider.label}</span>
                {provider.configured && (
                  <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full">configurada</span>
                )}
              </label>

              <div className="pl-7 space-y-3">
                {PROVIDER_HELP[key] && (
                  <a
                    href={PROVIDER_HELP[key].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700"
                  >
                    <ExternalLink size={12} />
                    Como obter: {PROVIDER_HELP[key].steps}
                  </a>
                )}
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Chave API</label>
                  <input
                    type="password"
                    autoComplete="off"
                    className="w-full mt-1 border-b py-2 outline-none focus:border-emerald-500"
                    placeholder={provider.configured ? '•••••••••••••••• (configurada — deixa em branco para manter)' : 'Não configurada'}
                    value={apiKeyInputs[key] ?? ''}
                    onChange={e => setApiKeyInputs(prev => ({ ...prev, [key]: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Modelo</label>
                  <input
                    className="w-full mt-1 border-b py-2 outline-none focus:border-emerald-500"
                    placeholder={provider.defaultModel}
                    value={modelInputs[key] ?? ''}
                    onChange={e => setModelInputs(prev => ({ ...prev, [key]: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 sm:p-6 border-t">
          {message && <p className="text-emerald-600 text-sm mb-3">{message}</p>}
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

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
