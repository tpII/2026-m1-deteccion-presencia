import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassPanel } from '../components/common/GlassPanel';
import { GlassCard } from '../components/common/GlassCard';
import { SectionHeader } from '../components/common/SectionHeader';
import { PresenceBadge } from '../components/status/PresenceBadge';
import { SignalProcessingPipeline } from '../components/signal/SignalProcessingPipeline';
import { useTelemetry } from '../hooks/useTelemetry';
import { Radio, Wifi, Share2, ArrowRight, Zap, Activity } from 'lucide-react';

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { statuses, casesData } = useTelemetry();

  const pirStatus = statuses.find((s) => s.case_id === 'pir');
  const routerStatus = statuses.find((s) => s.case_id === 'csi_router');
  const dedicatedStatus = statuses.find((s) => s.case_id === 'csi_dedicated');

  const routerData = casesData['csi_router'];

  const caseCards = [
    {
      id: 'pir',
      title: 'Caso 1 — PIR',
      subtitle: 'Sensor infrarrojo pasivo térmico',
      icon: <Radio size={22} />,
      status: pirStatus,
      path: '/case/pir',
      accent: '#10b981',
    },
    {
      id: 'csi_router',
      title: 'Caso 2 — CSI + Router',
      subtitle: 'Subportadoras Wi-Fi en red comercial',
      icon: <Wifi size={22} />,
      status: routerStatus,
      path: '/case/csi_router',
      accent: '#0284c7',
    },
    {
      id: 'csi_dedicated',
      title: 'Caso 3 — CSI Red Dedicada',
      subtitle: 'Enlace controlado AP-STA ESP32',
      icon: <Share2 size={22} />,
      status: dedicatedStatus,
      path: '/case/csi_dedicated',
      accent: '#6366f1',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* 1. HERO HEADER */}
      <GlassPanel style={{ padding: '2rem 2.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-blue)', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
              <Zap size={14} />
              <span>Proyecto de Ingeniería · Taller II</span>
            </div>
            <h1 style={{ fontSize: '1.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
              Detección de Presencia
            </h1>
            <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', maxWidth: '780px', lineHeight: 1.5 }}>
              Plataforma experimental para la comparación cuantitativa de tres tecnologías de detección en interiores:
              sensores térmicos piroeléctricos (PIR) frente a perturbaciones multicamino de Channel State Information (CSI) en Wi-Fi.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Muestreo en tiempo real</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <span className="glass-badge status-live">
                <span className="pulse-dot pulsing" /> 10 Hz Streaming
              </span>
            </div>
          </div>
        </div>
      </GlassPanel>

      {/* 2. LAS 3 TARJETAS DE MÉTODOS */}
      <div>
        <SectionHeader
          title="Métodos Experimentales Evaluados"
          subtitle="Monitoreo de estado instantáneo, presencia y latencia de transmisión"
          icon={<Activity size={18} />}
        />
        <div className="grid-3">
          {caseCards.map((c) => {
            const presence = c.status?.presence ?? false;
            const latency = c.status?.current_latency_ms ?? 0;
            const samples = c.status?.total_samples ?? 0;

            return (
              <GlassCard
                key={c.id}
                interactive={true}
                onClick={() => navigate(c.path)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.1rem',
                  padding: '1.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--surface-subtle)',
                        color: c.accent,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {c.icon}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {c.title}
                      </h3>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{c.subtitle}</p>
                    </div>
                  </div>
                  <PresenceBadge presence={presence} size="md" />
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '0.75rem',
                    padding: '0.85rem',
                    background: 'var(--surface-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--glass-border-subtle)',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>
                      Latencia
                    </span>
                    <strong style={{ fontSize: '1.1rem', fontFamily: 'var(--font-mono)' }}>
                      {latency} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ms</span>
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>
                      Muestras
                    </span>
                    <strong style={{ fontSize: '1.1rem', fontFamily: 'var(--font-mono)' }}>
                      {samples}
                    </strong>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.82rem',
                    color: 'var(--accent-blue)',
                    fontWeight: 600,
                    marginTop: 'auto',
                  }}
                >
                  <span>Ver análisis detallado</span>
                  <ArrowRight size={16} />
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>

      {/* 3. PIPELINE VISUAL CSI EN TIEMPO REAL */}
      <div>
        <SectionHeader
          title="Procesamiento CSI en Tiempo Real"
          subtitle="Visualización de la cadena de transformación: Señal cruda → Filtro Hampel + MA → Señal filtrada → Características → Detección"
          icon={<Activity size={18} />}
        />
        <SignalProcessingPipeline
          rawPoints={routerData?.raw_points || []}
          filteredPoints={routerData?.filtered_points || []}
          filterMetadata={routerData?.filter_metadata}
          features={routerData?.features}
          presence={routerData?.presence ?? false}
          score={routerData?.current_score}
        />
      </div>
    </div>
  );
};
