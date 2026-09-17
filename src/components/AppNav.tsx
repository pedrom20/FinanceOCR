import React, { useState } from 'react';
import { Navbar, Nav, Offcanvas, Container, Button } from 'react-bootstrap';
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

export const ADMIN_NAV_ITEMS = [
  { path: '/settings', label: 'Definições', icon: Settings },
  { path: '/users', label: 'Utilizadores', icon: Users },
];

export const AppNav = ({ user, onLogout }: { user: User; onLogout: () => void }) => {
  const [show, setShow] = useState(false);
  const items = user.role === 'admin' ? [...NAV_ITEMS, ...ADMIN_NAV_ITEMS] : NAV_ITEMS;

  const handleLogout = () => {
    setShow(false);
    onLogout();
  };

  return (
    <Navbar bg="dark" variant="dark" expand="md" fixed="top">
      <Container fluid>
        <Navbar.Brand className="d-flex align-items-center gap-2">
          <Receipt size={22} className="text-success" />
          <span className="fw-bold">FinOCR</span>
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="app-nav-offcanvas" onClick={() => setShow(true)} />
        <Navbar.Offcanvas
          id="app-nav-offcanvas"
          placement="end"
          show={show}
          onHide={() => setShow(false)}
          data-bs-theme="dark"
          className="bg-dark"
        >
          <Offcanvas.Header closeButton closeVariant="white">
            <Offcanvas.Title className="d-flex align-items-center gap-2">
              <Receipt size={20} className="text-success" /> FinOCR
            </Offcanvas.Title>
          </Offcanvas.Header>
          <Offcanvas.Body className="d-flex flex-column">
            <Nav className="flex-grow-1">
              {items.map(item => {
                const Icon = item.icon;
                return (
                  <Nav.Link
                    key={item.path}
                    as={NavLink}
                    to={item.path}
                    end={item.path === '/'}
                    onClick={() => setShow(false)}
                    className="d-flex align-items-center gap-2 text-white-50 py-2"
                  >
                    <Icon size={18} /> {item.label}
                  </Nav.Link>
                );
              })}
            </Nav>
            <hr className="border-secondary" />
            <div className="d-flex align-items-center justify-content-between gap-2">
              <small className="text-white-50 text-truncate">{user.email}</small>
              <Button variant="outline-light" size="sm" onClick={handleLogout} className="d-flex align-items-center gap-1 flex-shrink-0">
                <LogOut size={14} /> Sair
              </Button>
            </div>
          </Offcanvas.Body>
        </Navbar.Offcanvas>
      </Container>
    </Navbar>
  );
};
