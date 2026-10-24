import type { ReactNode } from 'react';
import { Activity, History, Layers } from 'lucide-react';
import { GlassPanel } from '../ui/GlassPanel';
import { SectionHeader } from '../ui/SectionHeader';
import { PresenceBadge } from '../ui/PresenceBadge';
import { MetricsGrid } from '../metrics/MetricsGrid';
import { TrialsTable } from '../metrics/TrialsTable';
import type { CaseMetrics, Trial } from '../../types/metrics';
import type { CaseCurrentStatus } from '../../types/telemetry';

interface CaseStudyLayoutProps {
  title: string;
  subtitle: string;
  description: string;
  technology: string;
  status?: CaseCurrentStatus;
  metrics: CaseMetrics | null;
  trials: Trial[];
  metricsLoading?: boolean;
  error?: string | null;
  chartContent: ReactNode;
  pipelineContent?: ReactNode;
}

export function CaseStudyLayout({ title, subtitle, description, technology, status, metrics, trials,
  metricsLoading = false, error, chartContent, pipelineContent }: CaseStudyLayoutProps) {
  const latency = status?.current_latency_ms ?? 0;
  return (
    <div className="page-stack">
      <GlassPanel>
        <div className="page-heading">
          <div>
            <div className="case-heading"><h1>{title}</h1><span className="case-technology">{technology}</span></div>
            <p className="case-subtitle">{subtitle}</p>
            <p className="case-description">{description}</p>
          </div>
          <div className="case-live-state">
            <PresenceBadge presence={status?.presence ?? false} connected={status?.is_connected ?? false} size="lg" />
            <span>Latencia: <strong>{latency > 0 ? `${latency} ms` : 'Sin medir'}</strong></span>
          </div>
        </div>
      </GlassPanel>
      {error && <p role="alert" className="form-error">{error}</p>}
      <section>
        <SectionHeader title="Métricas experimentales" subtitle="Ensayos registrados frente a la presencia observada" icon={<Layers size={18} />} />
        <MetricsGrid metrics={metrics} loading={metricsLoading} />
      </section>
      <section>
        <SectionHeader title="Telemetría en vivo" subtitle="Señales recibidas del sensor" icon={<Activity size={18} />} />
        <GlassPanel>{chartContent}</GlassPanel>
      </section>
      {pipelineContent && (
        <section>
          <SectionHeader title="Procesamiento de señal" subtitle="Señal cruda → Filtros → Características → Detección" icon={<Activity size={18} />} />
          {pipelineContent}
        </section>
      )}
      <section>
        <SectionHeader title="Historial de ensayos" subtitle="Validación frente a la presencia observada" icon={<History size={18} />} />
        <TrialsTable trials={trials} loading={metricsLoading} />
      </section>
    </div>
  );
}
