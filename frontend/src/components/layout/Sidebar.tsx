import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Radio,
  Wifi,
  Share2,
  BarChart3,
  Settings,
  Layers,
  Usb,
} from 'lucide-react';

interface SidebarProps {
  menuOpen: boolean;
  onNavigate: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ menuOpen, onNavigate }) => {
  const navItems = [
    { to: '/', label: 'Resumen General', icon: <LayoutDashboard size={18} /> },
    { to: '/case/pir', label: 'Caso 1 — PIR', icon: <Radio size={18} /> },
    { to: '/test/pir-usb', label: 'Prueba PIR — USB', icon: <Usb size={18} /> },
    { to: '/case/csi_router', label: 'Caso 2 — CSI + Router', icon: <Wifi size={18} /> },
    { to: '/case/csi_dedicated', label: 'Caso 3 — CSI Dedicado', icon: <Share2 size={18} /> },
    { to: '/comparison', label: 'Comparación', icon: <BarChart3 size={18} /> },
    { to: '/system', label: 'Sistema & Hardware', icon: <Settings size={18} /> },
  ];

  return (
    <aside id="primary-navigation" className={`app-sidebar${menuOpen ? ' is-open' : ''}`}>
      <div
        style={{
          padding: '0.4rem 0.75rem 0.85rem 0.75rem',
          fontSize: '0.72rem',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--text-muted)',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
        }}
      >
        <Layers size={13} />
        <span>Navegación</span>
      </div>

      <nav aria-label="Navegación principal" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.65rem 0.85rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.86rem',
              fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
              background: isActive ? 'rgba(2, 132, 199, 0.08)' : 'transparent',
              border: isActive ? '1px solid rgba(2, 132, 199, 0.2)' : '1px solid transparent',
              transition: 'all var(--transition-fast)',
            })}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div
        className="sidebar-footer"
        style={{
          marginTop: 'auto',
          padding: '0.85rem',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--surface-subtle)',
          border: '1px solid var(--glass-border-subtle)',
          fontSize: '0.74rem',
          color: 'var(--text-muted)',
        }}
      >
        <strong style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>
          Taller de Proyecto II
        </strong>
        Facultad de Ingeniería · 2026
      </div>
    </aside>
  );
};
