import React, { useState, useEffect } from 'react';
import { ConnectionStatus } from '../status/ConnectionStatus';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useTheme } from '../../hooks/useTheme';
import { api } from '../../services/api';
import { Cpu, Radio, Play, Pause, Sun, Moon } from 'lucide-react';

export const Header: React.FC = () => {
  const { connectionState } = useWebSocket();
  const { theme, toggleTheme } = useTheme();
  const [timeStr, setTimeStr] = useState<string>('');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [toggling, setToggling] = useState<boolean>(false);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    update();
    const interval = setInterval(update, 1000);

    // Consultar estado inicial de la simulación
    api.getSimulationStatus().then((res) => setIsPaused(res.paused)).catch(() => {});

    return () => clearInterval(interval);
  }, []);

  const handleToggleSimulation = async () => {
    setToggling(true);
    try {
      const res = await api.toggleSimulation();
      setIsPaused(res.paused);
    } catch (e) {
      console.error('Error cambiando estado de simulación:', e);
    } finally {
      setToggling(false);
    }
  };

  return (
    <header
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        borderBottom: '1px solid var(--glass-border-subtle)',
        padding: '0.85rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        transition: 'background var(--transition-normal), border-color var(--transition-normal)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
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
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
            Análisis comparativo de PIR y Channel State Information (CSI) — Grupo M1
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        {/* Conmutador de Modo Oscuro / Claro */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
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

        {/* Botón de Pausa / Reanudación de Simulación */}
        <button
          onClick={handleToggleSimulation}
          disabled={toggling}
          title={isPaused ? "Reanudar generación de datos en vivo" : "Pausar/congelar generación de datos"}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.35rem 0.85rem',
            borderRadius: 'var(--radius-full)',
            background: isPaused ? 'var(--state-warning-bg)' : 'var(--surface-subtle)',
            border: isPaused ? '1px solid var(--state-warning-border)' : '1px solid var(--glass-border-subtle)',
            color: isPaused ? 'var(--state-warning-text)' : 'var(--text-secondary)',
            fontSize: '0.76rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
          }}
        >
          {isPaused ? <Play size={13} fill="currentColor" /> : <Pause size={13} fill="currentColor" />}
          <span>{isPaused ? 'SIMULACIÓN PAUSADA' : 'PAUSAR SIMULACIÓN'}</span>
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
          <span>MOCK</span>
        </div>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {timeStr}
        </div>

        <ConnectionStatus state={connectionState} />
      </div>
    </header>
  );
};
