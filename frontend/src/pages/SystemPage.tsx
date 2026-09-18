import React, { useState, useEffect } from 'react';
import { GlassPanel } from '../components/common/GlassPanel';
import { GlassCard } from '../components/common/GlassCard';
import { SectionHeader } from '../components/common/SectionHeader';
import { api } from '../services/api';
import { Settings, Server, Cpu, Database, Send, CheckCircle2 } from 'lucide-react';

export const SystemPage: React.FC = () => {
  const [health, setHealth] = useState<any>(null);

  // Formulario para registro de ensayo experimental interactivo
  const [selectedCase, setSelectedCase] = useState<string>('pir');
  const [groundTruth, setGroundTruth] = useState<boolean>(true);
  const [detectedPresence, setDetectedPresence] = useState<boolean>(true);
  const [latencyMs, setLatencyMs] = useState<number>(150);
  const [trialNote, setTrialNote] = useState<string>('Ensayo manual desde panel');
  const [trialSuccessMsg, setTrialSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadHealth() {
      try {
        const res = await api.getHealth();
        setHealth(res);
      } catch (e) {
        // backend offline
      }
    }
    loadHealth();
  }, []);

  const handleRecordTrial = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.recordTrial({
        case_id: selectedCase,
        ground_truth: groundTruth,
        detected_presence: detectedPresence,
        latency_ms: Number(latencyMs),
        notes: trialNote,
      });
      setTrialSuccessMsg(`¡Ensayo registrado exitosamente para ${selectedCase}!`);
      setTimeout(() => setTrialSuccessMsg(null), 4000);
    } catch (err: any) {
      alert('Error registrando ensayo: ' + err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <GlassPanel>
        <SectionHeader
          title="Configuración y Estado del Sistema"
          subtitle="Parámetros de telemetría, enlaces de red y registro manual de ensayos"
          icon={<Settings size={18} />}
        />
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Esta vista resume los parámetros de bajo nivel de la arquitectura de telemetría y permite verificar la conectividad de los servicios del backend.
        </p>
      </GlassPanel>

      {/* Grid de Estado de Servidores */}
      <div className="grid-3">
        <GlassCard>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <Server size={18} style={{ color: 'var(--accent-blue)' }} />
            <h3 style={{ fontSize: '0.95rem' }}>Servicio Backend FastAPI</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.82rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Estado: </span>
              <strong style={{ color: health?.status === 'healthy' ? '#059669' : '#dc2626' }}>
                {health?.status === 'healthy' ? 'OPERATIVO (200 OK)' : 'DESCONECTADO'}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Versión: </span>
              <strong>{health?.version || '1.0.0'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Clientes WebSocket: </span>
              <strong>{health?.active_ws_clients ?? 0} conectados</strong>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <Cpu size={18} style={{ color: 'var(--accent-blue)' }} />
            <h3 style={{ fontSize: '0.95rem' }}>Fuente de Datos Ingestada</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.82rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Modo activo: </span>
              <strong style={{ textTransform: 'uppercase', color: 'var(--accent-blue)' }}>
                {health?.data_source || 'MOCK'}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Variable de entorno: </span>
              <code>DATA_SOURCE=mock</code>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Modo alternativo: </span>
              <code>DATA_SOURCE=mqtt</code>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <Database size={18} style={{ color: 'var(--accent-blue)' }} />
            <h3 style={{ fontSize: '0.95rem' }}>Persistencia & Broker</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.82rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Base de datos: </span>
              <strong>SQLite (aiosqlite)</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Buffer temporal: </span>
              <strong>500 muestras en memoria</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Broker MQTT: </span>
              <strong>Mosquitto (1883)</strong>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Formulario de Ensayo Experimental con Ground Truth */}
      <GlassPanel>
        <SectionHeader
          title="Registrar Ensayo Experimental (Ground Truth)"
          subtitle="Permite ingresar un ensayo presencial para auditar la precisión del modelo en tiempo real"
          icon={<Send size={18} />}
        />

        {trialSuccessMsg && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#065f46',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.88rem',
              fontWeight: 600,
            }}
          >
            <CheckCircle2 size={16} />
            <span>{trialSuccessMsg}</span>
          </div>
        )}

        <form
          onSubmit={handleRecordTrial}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            alignItems: 'flex-end',
          }}
        >
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
              Método / Caso
            </label>
            <select
              value={selectedCase}
              onChange={(e) => setSelectedCase(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--input-border)',
                background: 'var(--input-bg)',
                color: 'var(--input-text)',
                fontSize: '0.85rem',
              }}
            >
              <option value="pir">Caso 1 — Sensor PIR</option>
              <option value="csi_router">Caso 2 — CSI Router</option>
              <option value="csi_dedicated">Caso 3 — CSI Dedicado</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
              Ground Truth (Realidad)
            </label>
            <select
              value={groundTruth ? '1' : '0'}
              onChange={(e) => setGroundTruth(e.target.value === '1')}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--input-border)',
                background: 'var(--input-bg)',
                color: 'var(--input-text)',
                fontSize: '0.85rem',
              }}
            >
              <option value="1">Persona Presente (1)</option>
              <option value="0">Habitación Vacía (0)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
              Detección del Sensor
            </label>
            <select
              value={detectedPresence ? '1' : '0'}
              onChange={(e) => setDetectedPresence(e.target.value === '1')}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--input-border)',
                background: 'var(--input-bg)',
                color: 'var(--input-text)',
                fontSize: '0.85rem',
              }}
            >
              <option value="1">Detectó Presencia (1)</option>
              <option value="0">Detectó Ausencia (0)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
              Latencia (ms)
            </label>
            <input
              type="number"
              value={latencyMs}
              onChange={(e) => setLatencyMs(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--input-border)',
                background: 'var(--input-bg)',
                color: 'var(--input-text)',
                fontSize: '0.85rem',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
              Notas
            </label>
            <input
              type="text"
              value={trialNote}
              onChange={(e) => setTrialNote(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--input-border)',
                background: 'var(--input-bg)',
                color: 'var(--input-text)',
                fontSize: '0.85rem',
              }}
            />
          </div>

          <div>
            <button
              type="submit"
              style={{
                width: '100%',
                padding: '0.65rem 1rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--accent-blue)',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)',
              }}
            >
              Guardar Ensayo
            </button>
          </div>
        </form>
      </GlassPanel>
    </div>
  );
};
