import React, { useState } from 'react';
import { Navbar, Nav, NavDropdown, Container, Badge } from 'react-bootstrap';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, UploadCloud, FileText, PieChart, Store, Package, Settings, Users, LogOut, Receipt } from 'lucide-react';
import { User } from '../types';

export const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/invoices', label: 'Faturas', icon: FileText },
  { path: '/upload', label: 'Upload', icon: UploadCloud },
  { path: '/reports', label: 'Relatórios', icon: PieChart },
  { path: '/stores', label: 'Lojas', icon: Store },
  { path: '/items', label: 'Artigos', icon: Package },
];

export const AppNav = ({ user, onLogout }: { user: User; onLogout: () => void }) => {
  const initial = (user.name || user.email).charAt(0).toUpperCase();
  // react-bootstrap's Navbar.Collapse não fecha sozinho ao navegar — tem de
  // ser controlado e fechado explicitamente em cada clique (link ou logout).
  const [expanded, setExpanded] = useState(false);
  const close = () => setExpanded(false);

  return (
    <Navbar bg="dark" variant="dark" expand="lg" className="app-navbar" sticky="top" expanded={expanded} onToggle={setExpanded}>
      <Container fluid className="px-3">
        <Navbar.Brand as={NavLink} to="/" className="d-flex align-items-center gap-2" onClick={close}>
          <span className="brand-mark d-inline-flex align-items-center justify-content-center">
            <Receipt size={16} />
          </span>
          FinOCR
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="app-navbar-collapse" />

        <Navbar.Collapse id="app-navbar-collapse">
          <Nav className="me-auto">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              return (
                <Nav.Link key={item.path} as={NavLink} to={item.path} end={item.path === '/'} onClick={close}>
                  <Icon size={16} className="me-1" /> {item.label}
                </Nav.Link>
              );
            })}
          </Nav>

          <Nav className="align-items-lg-center gap-lg-2">
            {user.role === 'admin' && (
              <>
                <Nav.Link as={NavLink} to="/settings" onClick={close}>
                  <Settings size={16} className="me-1" /> <span className="d-lg-none">Definições</span>
                </Nav.Link>
                <Nav.Link as={NavLink} to="/users" onClick={close}>
                  <Users size={16} className="me-1" /> <span className="d-lg-none">Utilizadores</span>
                </Nav.Link>
                <span className="nav-separator d-none d-lg-block" />
              </>
            )}

            <NavDropdown
              align="end"
              title={
                <span className="d-inline-flex align-items-center gap-2">
                  <span className="user-avatar d-inline-flex align-items-center justify-content-center">{initial}</span>
                  <span className="d-none d-lg-inline">{user.name || user.email}</span>
                </span>
              }
              id="app-user-dropdown"
            >
              <div className="px-3 py-2">
                <div className="fw-bold small">{user.name || user.email}</div>
                <div className="text-muted" style={{ fontSize: '0.75rem' }}>{user.email}</div>
                <Badge bg={user.role === 'admin' ? 'primary' : 'secondary'} className="mt-1">
                  {user.role === 'admin' ? 'Admin' : 'Utilizador'}
                </Badge>
              </div>
              <NavDropdown.Divider />
              <NavDropdown.Item onClick={() => { close(); onLogout(); }} className="text-danger d-flex align-items-center gap-2">
                <LogOut size={15} /> Terminar sessão
              </NavDropdown.Item>
            </NavDropdown>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};
