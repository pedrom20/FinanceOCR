import React, { useState } from 'react';
import { Container, Card, Form, Button, Alert } from 'react-bootstrap';
import { Receipt } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api';
import { GoogleSignInButton } from '../components/GoogleSignInButton';

export const AuthPage = () => {
  const { login, register, loginWithGoogle } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro de autenticação.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleCredential = async (credential: string) => {
    setError('');
    setSubmitting(true);
    try {
      await loginWithGoogle(credential);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro de autenticação com Google.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container fluid className="d-flex align-items-center justify-content-center min-vh-100 bg-light px-3">
      <Card style={{ maxWidth: 420 }} className="w-100 shadow-lg border-0 overflow-hidden">
        <div className="bg-dark text-white text-center p-4">
          <div className="d-inline-flex bg-success bg-opacity-25 rounded-3 p-3 mb-3">
            <Receipt size={32} className="text-success" />
          </div>
          <h1 className="h4 fw-bold mb-1">FinOCR Manager</h1>
          <p className="text-white-50 small mb-0">Controle as suas finanças num piscar de olhos</p>
        </div>
        <Card.Body className="p-4">
          <Form onSubmit={handleAuth}>
            {!isLogin && (
              <Form.Group className="mb-3">
                <Form.Label>Nome</Form.Label>
                <Form.Control type="text" value={name} onChange={e => setName(e.target.value)} required />
              </Form.Group>
            )}
            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Password</Form.Label>
              <Form.Control type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
            </Form.Group>
            {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
            <Button type="submit" variant="primary" disabled={submitting} className="w-100 fw-bold">
              {submitting ? 'A processar...' : isLogin ? 'Entrar' : 'Registar'}
            </Button>
          </Form>
          <Button variant="link" className="w-100 mt-3 text-decoration-none" onClick={() => { setIsLogin(!isLogin); setError(''); }}>
            {isLogin ? 'Não tem conta? Registe-se' : 'Já tem conta? Faça Login'}
          </Button>
          <div className="d-flex align-items-center gap-3 my-3 text-muted small">
            <hr className="flex-grow-1" /> ou <hr className="flex-grow-1" />
          </div>
          <GoogleSignInButton onCredential={handleGoogleCredential} />
        </Card.Body>
      </Card>
    </Container>
  );
};
