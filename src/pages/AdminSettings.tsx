import React, { useEffect, useState } from 'react';
import { Card, Form, Button, Alert, Badge } from 'react-bootstrap';
import { CheckCircle2, ExternalLink, Loader2, Save, ShieldCheck, XCircle, Zap } from 'lucide-react';
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
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; message: string } | undefined>>({});

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

  const testProvider = async (key: string) => {
    setTesting(prev => ({ ...prev, [key]: true }));
    setTestResult(prev => ({ ...prev, [key]: undefined }));
    try {
      const result = await apiJson<{ ok: boolean; message: string }>('/api/settings/test', {
        method: 'POST',
        body: JSON.stringify({ provider: key, apiKey: apiKeyInputs[key] ?? '', model: modelInputs[key] ?? '' }),
      });
      setTestResult(prev => ({ ...prev, [key]: result }));
    } catch (err) {
      setTestResult(prev => ({ ...prev, [key]: { ok: false, message: err instanceof ApiError ? err.message : 'Falha ao testar.' } }));
    } finally {
      setTesting(prev => ({ ...prev, [key]: false }));
    }
  };

  if (!settings) return error ? <Alert variant="danger">{error}</Alert> : null;

  return (
    <div className="d-flex flex-column gap-3 mx-auto" style={{ maxWidth: 640 }}>
      <div className="page-header">
        <div>
          <h1>Definições</h1>
          <p>Fornecedores de IA usados no OCR e na categorização automática.</p>
        </div>
      </div>

      <Card>
        <Card.Header className="bg-light d-flex align-items-center gap-3">
          <div className="bg-success bg-opacity-10 text-success rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 40, height: 40 }}>
            <ShieldCheck size={20} />
          </div>
          <div>
            <h2 className="h6 fw-bold mb-0">Fornecedores de IA</h2>
            <p className="text-muted small mb-0">Usada como fallback do OCR e para sugerir categorias dos artigos. Podes configurar vários e escolher qual está ativo.</p>
          </div>
        </Card.Header>

        {Object.entries(settings.providers).map(([key, provider]) => (
          <Card.Body key={key} className="border-bottom d-flex flex-column gap-3">
            <Form.Check
              type="radio"
              id={`provider-${key}`}
              name="activeProvider"
              checked={activeProvider === key}
              onChange={() => setActiveProvider(key)}
              label={
                <span className="d-inline-flex align-items-center gap-2">
                  <span className="fw-bold">{provider.label}</span>
                  {provider.configured && <Badge bg="success" className="bg-opacity-25 text-success fw-normal">configurada</Badge>}
                </span>
              }
            />

            <div className="ps-4 d-flex flex-column gap-3">
              {PROVIDER_HELP[key] && (
                <a href={PROVIDER_HELP[key].url} target="_blank" rel="noopener noreferrer" className="d-inline-flex align-items-center gap-2 small text-success text-decoration-none">
                  <ExternalLink size={12} />
                  Como obter: {PROVIDER_HELP[key].steps}
                </a>
              )}
              <Form.Group>
                <Form.Label className="text-muted small text-uppercase fw-bold">Chave API</Form.Label>
                <Form.Control
                  type="password"
                  autoComplete="off"
                  placeholder={provider.configured ? '•••••••••••••••• (configurada — deixa em branco para manter)' : 'Não configurada'}
                  value={apiKeyInputs[key] ?? ''}
                  onChange={e => setApiKeyInputs(prev => ({ ...prev, [key]: e.target.value }))}
                />
              </Form.Group>
              <Form.Group>
                <Form.Label className="text-muted small text-uppercase fw-bold">Modelo</Form.Label>
                <Form.Control
                  placeholder={provider.defaultModel}
                  value={modelInputs[key] ?? ''}
                  onChange={e => setModelInputs(prev => ({ ...prev, [key]: e.target.value }))}
                />
              </Form.Group>

              <div className="d-flex align-items-center gap-3">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  disabled={testing[key] || (!provider.configured && !apiKeyInputs[key])}
                  onClick={() => testProvider(key)}
                  className="d-inline-flex align-items-center gap-2"
                >
                  {testing[key] ? <Loader2 className="spin" size={14} /> : <Zap size={14} />}
                  {testing[key] ? 'A testar...' : 'Testar'}
                </Button>
                {testResult[key] && (
                  <span className={`d-inline-flex align-items-center gap-2 small ${testResult[key]!.ok ? 'text-success' : 'text-danger'}`}>
                    {testResult[key]!.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    {testResult[key]!.message}
                  </span>
                )}
              </div>
            </div>
          </Card.Body>
        ))}

        <Card.Body>
          {message && <Alert variant="success" className="py-2 small">{message}</Alert>}
          {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
          <Button variant="primary" disabled={saving} onClick={save} className="d-inline-flex align-items-center gap-2 fw-bold px-4">
            {saving ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
            {saving ? 'A guardar...' : 'Guardar'}
          </Button>
        </Card.Body>
      </Card>
    </div>
  );
};
