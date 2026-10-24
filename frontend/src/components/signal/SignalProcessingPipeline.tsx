import { Activity, BarChart3, CheckCircle2, Sliders, Waves } from 'lucide-react';
import { PipelineStage } from './PipelineStage';
import { SignalChart } from '../charts/SignalChart';
import { PresenceBadge } from '../ui/PresenceBadge';
import type { CaseTelemetryPayload } from '../../types/telemetry';

export function SignalProcessingPipeline({ data }: { data?: CaseTelemetryPayload }) {
  if (!data?.raw_points.length) {
    return <p className="muted">Esperando muestras CSI del hardware.</p>;
  }
  const { raw_points, filtered_points, filter_metadata, features, presence, current_score } = data;

  return (
    <div className="pipeline-flow-wrapper">
      <PipelineStage stepNumber={1} title="SEÑAL CRUDA" subtitle="Primera amplitud recibida" icon={<Activity size={16} />}>
        <SignalChart rawPoints={raw_points.slice(-30)} height={130} yAxisName="dB" />
      </PipelineStage>
      <PipelineStage stepNumber={2} title="FILTRADO" subtitle="Eliminación de outliers y ruido" icon={<Sliders size={16} />}>
        <dl className="pipeline-values">
          <dt>Filtro</dt><dd>{filter_metadata?.name ?? '—'}</dd>
          <dt>Ventana Hampel</dt><dd>{filter_metadata?.parameters.hampel_window ?? '—'} muestras</dd>
          <dt>Umbral MAD</dt><dd>{filter_metadata?.parameters.hampel_sigmas ?? '—'}</dd>
          <dt>Ventana MA</dt><dd>{filter_metadata?.parameters.moving_average_window ?? '—'} muestras</dd>
        </dl>
      </PipelineStage>
      <PipelineStage stepNumber={3} title="SEÑAL FILTRADA" subtitle="Amplitud estabilizada" icon={<Waves size={16} />}>
        <SignalChart rawPoints={[]} filteredPoints={(filtered_points ?? []).slice(-30)} height={130} yAxisName="dB" />
      </PipelineStage>
      <PipelineStage stepNumber={4} title="CARACTERÍSTICAS" subtitle="Métricas estadísticas temporales" icon={<BarChart3 size={16} />}>
        <dl className="pipeline-values">
          <dt>Varianza</dt><dd>{features?.variance.toFixed(3) ?? '—'}</dd>
          <dt>Energía</dt><dd>{features?.energy.toFixed(1) ?? '—'}</dd>
          <dt>Score</dt><dd>{features ? `${(features.detection_score * 100).toFixed(1)}%` : '—'}</dd>
          <dt>Umbral</dt><dd>{features?.threshold_applied ?? '—'}</dd>
        </dl>
      </PipelineStage>
      <PipelineStage stepNumber={5} title="DETECCIÓN" subtitle="Decisión del algoritmo" icon={<CheckCircle2 size={16} />}>
        <div className="pipeline-result">
          <PresenceBadge presence={presence} size="lg" />
          <span>Score: <strong>{((current_score ?? features?.detection_score ?? 0) * 100).toFixed(1)}%</strong></span>
        </div>
      </PipelineStage>
    </div>
  );
}
