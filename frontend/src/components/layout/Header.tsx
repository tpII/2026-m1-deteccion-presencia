import React, { useState, useEffect } from 'react';
import { ConnectionStatus } from '../status/ConnectionStatus';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useTheme } from '../../hooks/useTheme';
import { api } from '../../services/api';
import { Cpu, Radio, Sun, Moon, Menu, X } from 'lucide-react';

interface HeaderProps {
  menuOpen: boolean;
  onToggleMenu: () => void;
  menuButtonRef: React.RefObject<HTMLButtonElement>;
}

export const Header: React.FC<HeaderProps> = ({ menuOpen, onToggleMenu, menuButtonRef }) => {
  const { connectionState } = useWebSocket();
  const { theme, toggleTheme } = useTheme();
  const [timeStr, setTimeStr] = useState<string>('');
  const [dataSource, setDataSource] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (connectionState === 'LIVE') {
      api.getHealth().then((health) => {
        if (!cancelled) setDataSource(health.data_source);
      }).catch(() => { if (!cancelled) setDataSource(null); });
    } else {
      setDataSource(null);
    }
    return () => { cancelled = true; };
  }, [connectionState]);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    update();
    const interval = setInterval(update, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <header className="app-header">
      <div className="header-brand">
        <button
          ref={menuButtonRef}
          type="button"
          className="mobile-menu-toggle"
          aria-label={menuOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={onToggleMenu}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            color: '#ffffff',
            boxShadow: '0 2px 10px rgba(2, 132, 199, 0.3)',
          }}
        >
          <Radio size={22} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Detección de Presencia
          </h1>
          <p className="header-subtitle" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
            Análisis comparativo de PIR y Channel State Information (CSI) — Grupo M1
          </p>
        </div>
      </div>

      <div className="header-controls">
        {/* Conmutador de Modo Oscuro / Claro */}
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--radius-full)',
            background: 'var(--surface-subtle)',
            border: '1px solid var(--glass-border-subtle)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
          }}
          aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
        >
          {theme === 'dark' ? (
            <Sun size={17} style={{ color: '#fbbf24' }} />
          ) : (
            <Moon size={17} style={{ color: '#0284c7' }} />
          )}
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.3rem 0.75rem',
            borderRadius: 'var(--radius-full)',
            background: 'var(--surface-subtle)',
            border: '1px solid var(--glass-border-subtle)',
            fontSize: '0.76rem',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <Cpu size={13} style={{ color: 'var(--accent-blue)' }} />
          <span>{dataSource?.toUpperCase() ?? 'SIN CONEXIÓN'}</span>
        </div>

        <div className="header-clock" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {timeStr}
        </div>

        <ConnectionStatus state={connectionState} />
      </div>
    </header>
  );
};
