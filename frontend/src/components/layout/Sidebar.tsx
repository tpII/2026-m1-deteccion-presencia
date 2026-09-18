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
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const navItems = [
    { to: '/', label: 'Resumen General', icon: <LayoutDashboard size={18} /> },
    { to: '/case/pir', label: 'Caso 1 — PIR', icon: <Radio size={18} /> },
    { to: '/case/csi_router', label: 'Caso 2 — CSI + Router', icon: <Wifi size={18} /> },
    { to: '/case/csi_dedicated', label: 'Caso 3 — CSI Dedicado', icon: <Share2 size={18} /> },
    { to: '/comparison', label: 'Comparación', icon: <BarChart3 size={18} /> },
    { to: '/system', label: 'Sistema & Hardware', icon: <Settings size={18} /> },
  ];

  return (
    <aside
      style={{
        width: '240px',
        flexShrink: 0,
        background: 'var(--glass-bg)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        borderRight: '1px solid var(--glass-border-subtle)',
        padding: '1.25rem 0.85rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem',
      }}
    >
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

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
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
