import React, { useState } from 'react';
import { Navbar, Nav, Offcanvas, Container, Button } from 'react-bootstrap';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, UploadCloud, FileText, PieChart, Store, Package, Settings, Users, LogOut, Receipt, User as UserIcon } from 'lucide-react';
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

const Brand = ({ size = 20 }: { size?: number }) => (
  <span className="d-flex align-items-center gap-2">
    <Receipt size={size} className="text-success" />
    <span className="fw-bold fs-5">FinOCR</span>
  </span>
);

export const AppNav = ({ user, onLogout }: { user: User; onLogout: () => void }) => {
  const [show, setShow] = useState(false);
  const items = user.role === 'admin' ? [...NAV_ITEMS, ...ADMIN_NAV_ITEMS] : NAV_ITEMS;
  const handleLogout = () => {
    setShow(false);
    onLogout();
  };

  return (
    <>
      {/* Desktop: sidebar fixa */}
      <div className="app-sidebar d-none d-md-flex flex-column bg-dark position-fixed top-0 start-0 vh-100">
        <div className="px-4 py-4">
          <Brand size={24} />
        </div>
        <Nav className="flex-column flex-grow-1 px-3 gap-1">
          {items.map(item => {
            const Icon = item.icon;
            return (
              <Nav.Link key={item.path} as={NavLink} to={item.path} end={item.path === '/'} className="d-flex align-items-center gap-3">
                <Icon size={18} /> {item.label}
              </Nav.Link>
            );
          })}
        </Nav>
        <div className="px-3 py-3 border-top border-secondary border-opacity-25">
          <div className="d-flex align-items-center gap-2 mb-3 px-1">
            <div className="bg-success rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 32, height: 32 }}>
              <UserIcon size={16} className="text-white" />
            </div>
            <small className="text-white-50 text-truncate">{user.email}</small>
          </div>
          <Button variant="outline-light" size="sm" onClick={onLogout} className="w-100 d-flex align-items-center justify-content-center gap-2">
            <LogOut size={14} /> Sair
          </Button>
        </div>
      </div>

      {/* Mobile: navbar de topo + offcanvas */}
      <Navbar bg="dark" variant="dark" fixed="top" className="d-md-none">
        <Container fluid>
          <Navbar.Brand className="d-flex align-items-center gap-2 py-0">
            <Brand />
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
              <Offcanvas.Title><Brand /></Offcanvas.Title>
            </Offcanvas.Header>
            <Offcanvas.Body className="d-flex flex-column">
              <Nav className="flex-grow-1 gap-1">
                {items.map(item => {
                  const Icon = item.icon;
                  return (
                    <Nav.Link
                      key={item.path}
                      as={NavLink}
                      to={item.path}
                      end={item.path === '/'}
                      onClick={() => setShow(false)}
                      className="d-flex align-items-center gap-3"
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
    </>
  );
};
