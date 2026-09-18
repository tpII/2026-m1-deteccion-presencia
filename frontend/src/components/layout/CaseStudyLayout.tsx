import React from 'react';
import { GlassPanel } from '../common/GlassPanel';
import { SectionHeader } from '../common/SectionHeader';
import { PresenceBadge } from '../status/PresenceBadge';
import { MetricsGrid } from '../metrics/MetricsGrid';
import { TrialsTable } from '../trials/TrialsTable';
import { CaseMetrics, Trial } from '../../types/metrics';
import { CaseCurrentStatus } from '../../types/telemetry';
import { Layers, Activity, History } from 'lucide-react';

interface CaseStudyLayoutProps {
  caseId: string;
  title: string;
  subtitle: string;
  description: string;
  technology: string;
  status?: CaseCurrentStatus;
  metrics: CaseMetrics | null;
  trials: Trial[];
  metricsLoading?: boolean;
  trialsLoading?: boolean;
  chartContent: React.ReactNode;
  pipelineContent?: React.ReactNode;
}

export const CaseStudyLayout: React.FC<CaseStudyLayoutProps> = ({
  title,
  subtitle,
  description,
  technology,
  status,
  metrics,
  trials,
  metricsLoading = false,
  trialsLoading = false,
  chartContent,
  pipelineContent,
}) => {
  const presence = status?.presence ?? false;
  const latency = status?.current_latency_ms ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* 1. ENCABEZADO DEL CASO */}
      <GlassPanel>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 700 }}>{title}</h1>
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '0.2rem 0.6rem',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--accent-blue-light)',
                  color: 'var(--accent-blue-dark)',
                  fontWeight: 600,
                }}
              >
                {technology}
              </span>
            </div>
            {subtitle && (
              <p style={{ fontSize: '0.84rem', color: 'var(--accent-blue)', fontWeight: 500, marginBottom: '0.4rem' }}>
                {subtitle}
              </p>
            )}
            <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', maxWidth: '800px', lineHeight: 1.5 }}>
              {description}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Estado en Vivo:</span>
              <PresenceBadge presence={presence} size="lg" />
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Latencia actual: <strong>{latency} ms</strong>
            </div>
          </div>
        </div>
      </GlassPanel>

      {/* 2. MÉTRICAS EXPERIMENTALES */}
      <div>
        <SectionHeader
          title="Métricas de Precisión y Rendimiento"
          subtitle="Resultados acumulados de ensayos experimentales vs Ground Truth"
          icon={<Layers size={18} />}
        />
        <MetricsGrid metrics={metrics} loading={metricsLoading} />
      </div>

      {/* 3. VISUALIZACIÓN DE SEÑALES EN TIEMPO REAL */}
      <div>
        <SectionHeader
          title="Telemetría y Procesamiento en Vivo"
          subtitle="Monitoreo continuo de señales temporales transmitidas por el sensor"
          icon={<Activity size={18} />}
        />
        <GlassPanel style={{ padding: '1.25rem' }}>
          {chartContent}
        </GlassPanel>
      </div>

      {/* 4. PIPELINE DE SEÑAL (OPCIONAL SEGÚN EL CASO) */}
      {pipelineContent && (
        <div>
          <SectionHeader
            title="Etapas de Transformación de Señal"
            subtitle="Pipeline secuencial: Señal Cruda → Filtro → Señal Filtrada → Descriptores → Detección"
            icon={<Activity size={18} />}
          />
          {pipelineContent}
        </div>
      )}

      {/* 5. TABLA DE ENSAYOS EXPERIMENTALES */}
      <div>
        <SectionHeader
          title="Historial de Ensayos Registrados"
          subtitle="Validación experimental confrontada con Ground Truth (presencia humana real)"
          icon={<History size={18} />}
        />
        <TrialsTable trials={trials} loading={trialsLoading} />
      </div>
    </div>
  );
};
