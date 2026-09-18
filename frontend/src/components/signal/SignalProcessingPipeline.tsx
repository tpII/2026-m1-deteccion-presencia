import React from 'react';
import { PipelineStage } from './PipelineStage';
import { SignalChart } from '../charts/SignalChart';
import { PresenceBadge } from '../status/PresenceBadge';
import { SignalPoint, FilterMetadata, FeatureMetrics } from '../../types/telemetry';
import { Activity, Sliders, Waves, BarChart3, CheckCircle2, ChevronRight } from 'lucide-react';

interface SignalProcessingPipelineProps {
  rawPoints: SignalPoint[];
  filteredPoints?: SignalPoint[];
  filterMetadata?: FilterMetadata;
  features?: FeatureMetrics;
  presence: boolean;
  score?: number;
}

export const SignalProcessingPipeline: React.FC<SignalProcessingPipelineProps> = ({
  rawPoints,
  filteredPoints,
  filterMetadata,
  features,
  presence,
  score,
}) => {
  return (
    <div className="pipeline-flow-wrapper">
      {/* Etapa 1: Señal Cruda */}
      <PipelineStage
        stepNumber={1}
        title="SEÑAL CRUDA"
        subtitle="Subportadoras OFDM recibidas"
        icon={<Activity size={16} />}
      >
        <div style={{ background: 'var(--surface-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.2rem' }}>
          <SignalChart
            rawPoints={rawPoints.slice(-30)}
            height={130}
            yAxisName="dB"
          />
        </div>
      </PipelineStage>

      <div className="pipeline-arrow">
        <ChevronRight size={22} />
      </div>

      {/* Etapa 2: Filtro */}
      <PipelineStage
        stepNumber={2}
        title="FILTRADO"
        subtitle="Eliminación de outliers y ruido"
        icon={<Sliders size={16} />}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem',
            background: 'var(--surface-subtle)',
            padding: '0.75rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--glass-border-subtle)',
            fontSize: '0.8rem',
          }}
        >
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Filtro: </span>
            <strong style={{ color: 'var(--text-primary)' }}>
              {filterMetadata?.name || 'Hampel + Media Móvil'}
            </strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Ventana Hampel: </span>
            <strong style={{ color: 'var(--text-primary)' }}>
              {filterMetadata?.parameters?.hampel_window || 7} muestras
            </strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Umbral MAD: </span>
            <strong style={{ color: 'var(--text-primary)' }}>
              {filterMetadata?.parameters?.hampel_sigmas || '3σ'}
            </strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Ventana MA: </span>
            <strong style={{ color: 'var(--text-primary)' }}>
              {filterMetadata?.parameters?.moving_average_window || 5} muestras
            </strong>
          </div>
        </div>
      </PipelineStage>

      <div className="pipeline-arrow">
        <ChevronRight size={22} />
      </div>

      {/* Etapa 3: Señal Filtrada */}
      <PipelineStage
        stepNumber={3}
        title="SEÑAL FILTRADA"
        subtitle="Amplitud estabilizada"
        icon={<Waves size={16} />}
      >
        <div style={{ background: 'var(--surface-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.2rem' }}>
          <SignalChart
            rawPoints={[]}
            filteredPoints={(filteredPoints || []).slice(-30)}
            height={130}
            yAxisName="dB"
          />
        </div>
      </PipelineStage>

      <div className="pipeline-arrow">
        <ChevronRight size={22} />
      </div>

      {/* Etapa 4: Extracción de Características */}
      <PipelineStage
        stepNumber={4}
        title="CARACTERÍSTICAS"
        subtitle="Métricas estadísticas temporales"
        icon={<BarChart3 size={16} />}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem',
            background: 'var(--surface-subtle)',
            padding: '0.75rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--glass-border-subtle)',
            fontSize: '0.8rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Varianza Temporal:</span>
            <strong>{features?.variance !== undefined ? features.variance.toFixed(3) : '0.000'}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Energía de Señal:</span>
            <strong>{features?.energy !== undefined ? features.energy.toFixed(1) : '0.0'}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Detection Score:</span>
            <strong style={{ color: presence ? '#10b981' : '#64748b' }}>
              {features?.detection_score !== undefined
                ? `${(features.detection_score * 100).toFixed(1)}%`
                : '0.0%'}
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Umbral Decisión:</span>
            <span style={{ color: 'var(--text-muted)' }}>
              {features?.threshold_applied !== undefined ? features.threshold_applied : '2.0'}
            </span>
          </div>
        </div>
      </PipelineStage>

      <div className="pipeline-arrow">
        <ChevronRight size={22} />
      </div>

      {/* Etapa 5: Detección Final */}
      <PipelineStage
        stepNumber={5}
        title="DETECCIÓN"
        subtitle="Decisión final del clasificador"
        icon={<CheckCircle2 size={16} />}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: '0.75rem',
            padding: '0.5rem 0',
          }}
        >
          <PresenceBadge presence={presence} size="lg" />
          <div style={{ textAlign: 'center', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            Score: <strong>{((score || features?.detection_score || 0) * 100).toFixed(1)}%</strong>
          </div>
        </div>
      </PipelineStage>
    </div>
  );
};
