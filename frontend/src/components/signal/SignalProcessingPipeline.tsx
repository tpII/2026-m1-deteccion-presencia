import { Activity, BarChart3, CheckCircle2, Crosshair, Sliders } from 'lucide-react';
import { PipelineStage } from './PipelineStage';
import { SignalChart } from '../charts/SignalChart';
import { PresenceBadge } from '../ui/PresenceBadge';
import type { CaseTelemetryPayload } from '../../types/telemetry';

function format(value: number | null | undefined) {
  return value == null ? '—' : value.toFixed(4);
}

export function SignalProcessingPipeline({ data }: { data?: CaseTelemetryPayload }) {
  if (!data?.raw_points.length) {
    return <p className="muted">Esperando muestras CSI del hardware.</p>;
  }
  const { raw_points, features, presence, calibration } = data;

  return (
    <div className="pipeline-flow-wrapper">
      <PipelineStage stepNumber={1} title="SEÑAL CRUDA" subtitle="Amplitud media de las subportadoras" icon={<Activity size={16} />}>
        <SignalChart rawPoints={raw_points.slice(-30)} height={130} yAxisName="|H|" />
      </PipelineStage>
      <PipelineStage stepNumber={2} title="NORMALIZADO" subtitle="Se divide por el promedio del paquete" icon={<Sliders size={16} />}>
        <dl className="pipeline-values">
          <dt>Escala</dt><dd>÷ media</dd>
          <dt>Ventana</dt><dd>4 s</dd>
        </dl>
      </PipelineStage>
      <PipelineStage stepNumber={3} title="INDICADORES" subtitle="Valores actuales" icon={<BarChart3 size={16} />}>
        <dl className="pipeline-values">
          <dt>Movimiento</dt><dd>{format(features?.movement_index)}</dd>
          <dt>Forma</dt><dd>{format(features?.shape_index)}</dd>
        </dl>
      </PipelineStage>
      <PipelineStage stepNumber={4} title="UMBRALES" subtitle={calibration?.state === 'calibrado' ? 'Calibrados con la habitación vacía' : 'Falta calibrar'} icon={<Crosshair size={16} />}>
        <dl className="pipeline-values">
          <dt>Movimiento</dt><dd>{format(features?.movement_threshold)}</dd>
          <dt>Forma</dt><dd>{format(features?.shape_threshold)}</dd>
        </dl>
      </PipelineStage>
      <PipelineStage stepNumber={5} title="DETECCIÓN" subtitle="Algún indicador supera su umbral" icon={<CheckCircle2 size={16} />}>
        <div className="pipeline-result">
          <PresenceBadge presence={presence} size="lg" />
          <span>Relación con el umbral: <strong>{features ? features.detection_ratio.toFixed(2) : '—'}</strong></span>
        </div>
      </PipelineStage>
    </div>
  );
}
