import React, { useEffect, useState } from 'react';
import { Card, Table, Form, Button, Alert, Spinner, Badge } from 'react-bootstrap';
import { Trash2, Loader2 } from 'lucide-react';
import { apiJson, apiFetch, ApiError } from '../api';
import { useAuth } from '../auth/AuthContext';

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  createdAt: string;
  invoiceCount: number;
}

export const Users = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  const load = () => {
    setLoading(true);
    apiJson<UserRow[]>('/api/users')
      .then(setUsers)
      .catch(() => setError('Falha ao carregar utilizadores.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const changeRole = async (u: UserRow, role: 'user' | 'admin') => {
    if (role === u.role) return;
    setBusyId(u.id);
    setRowError(prev => ({ ...prev, [u.id]: '' }));
    try {
      await apiFetch(`/api/users/${u.id}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      setUsers(prev => prev.map(row => (row.id === u.id ? { ...row, role } : row)));
    } catch (err) {
      setRowError(prev => ({ ...prev, [u.id]: err instanceof ApiError ? err.message : 'Falha ao atualizar.' }));
    } finally {
      setBusyId(null);
    }
  };

  const removeUser = async (u: UserRow) => {
    if (!window.confirm(`Apagar o utilizador "${u.name || u.email}"? Esta ação não pode ser desfeita.`)) return;
    setBusyId(u.id);
    setRowError(prev => ({ ...prev, [u.id]: '' }));
    try {
      await apiFetch(`/api/users/${u.id}`, { method: 'DELETE' });
      setUsers(prev => prev.filter(row => row.id !== u.id));
    } catch (err) {
      setRowError(prev => ({ ...prev, [u.id]: err instanceof ApiError ? err.message : 'Falha ao apagar.' }));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <div className="d-flex justify-content-center py-5"><Spinner animation="border" variant="success" /></div>;

  return (
    <div className="d-flex flex-column gap-3">
      <div>
        <h1 className="h3 fw-bold">Utilizadores</h1>
        <p className="text-muted small mb-0">Gestão de contas e permissões. Tem de existir sempre pelo menos um administrador.</p>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}

      <Card className="border-0 shadow-sm">
        <Table responsive hover className="mb-0 align-middle">
          <thead>
            <tr className="text-muted text-uppercase small">
              <th className="px-3 py-3">Utilizador</th>
              <th className="px-3 py-3">Role</th>
              <th className="px-3 py-3 text-end">Faturas</th>
              <th className="px-3 py-3">Desde</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <React.Fragment key={u.id}>
                <tr>
                  <td className="px-3">
                    <div className="fw-bold">{u.name || '—'}</div>
                    <div className="text-muted small">
                      {u.email} {u.id === currentUser?.id && <Badge bg="secondary" className="ms-1">tu</Badge>}
                    </div>
                  </td>
                  <td className="px-3">
                    <Form.Select
                      size="sm"
                      style={{ width: 130 }}
                      value={u.role}
                      disabled={busyId === u.id}
                      onChange={e => changeRole(u, e.target.value as 'user' | 'admin')}
                    >
                      <option value="user">Utilizador</option>
                      <option value="admin">Admin</option>
                    </Form.Select>
                  </td>
                  <td className="px-3 text-end">{u.invoiceCount}</td>
                  <td className="px-3 small text-muted">{u.createdAt?.slice(0, 10)}</td>
                  <td className="px-3 text-end">
                    <Button
                      variant="link"
                      className="text-danger p-0"
                      disabled={busyId === u.id || u.id === currentUser?.id}
                      onClick={() => removeUser(u)}
                      title={u.id === currentUser?.id ? 'Não podes apagar a tua própria conta' : 'Apagar utilizador'}
                    >
                      {busyId === u.id ? <Loader2 className="spin" size={16} /> : <Trash2 size={16} />}
                    </Button>
                  </td>
                </tr>
                {rowError[u.id] && (
                  <tr>
                    <td colSpan={5} className="px-3 pb-2 pt-0">
                      <Alert variant="danger" className="py-1 px-2 small mb-0">{rowError[u.id]}</Alert>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </Table>
      </Card>
      {users.length === 0 && !error && <p className="text-center text-muted small py-4">Sem utilizadores.</p>}
    </div>
  );
};
