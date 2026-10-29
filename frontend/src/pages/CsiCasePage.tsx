import { CaseStudyLayout } from '../components/layout/CaseStudyLayout';
import { IndicatorChart } from '../components/charts/IndicatorChart';
import { CalibrationPanel } from '../components/signal/CalibrationPanel';
import { SignalProcessingPipeline } from '../components/signal/SignalProcessingPipeline';
import { CSI_CASES } from '../config/cases';
import { useTelemetry } from '../hooks/useTelemetry';
import { useCaseMetrics } from '../hooks/useCaseMetrics';
import type { CaseId } from '../types/telemetry';

export function CsiCasePage({ caseId }: { caseId: Exclude<CaseId, 'pir'> }) {
  const { getCaseStatus, getCaseData } = useTelemetry();
  const { metrics, trials, loading, error } = useCaseMetrics(caseId);
  const data = getCaseData(caseId);
  const status = getCaseStatus(caseId);
  const config = CSI_CASES[caseId];
  const features = data?.features;

  return (
    <CaseStudyLayout
      {...config}
      status={status}
      metrics={metrics}
      trials={trials}
      metricsLoading={loading}
      error={error}
      chartContent={
        <div className="signal-content">
          <CalibrationPanel caseId={caseId} calibration={data?.calibration} connected={status?.is_connected ?? false} />
          <div className="indicator-charts">
            <IndicatorChart
              title="Indicador de movimiento (fluctuación del canal)"
              points={data?.movement_points ?? []}
              threshold={features?.movement_threshold}
            />
            <IndicatorChart
              title="Indicador de forma (cambio respecto del canal vacío)"
              points={data?.shape_points ?? []}
              threshold={features?.shape_threshold}
            />
          </div>
          <div className="signal-details">
            <span>Enlace: <strong>{config.details}</strong></span>
            <span>Ventana: <strong>4 s</strong></span>
            <span>Relación con el umbral: <strong>{features ? `${features.detection_ratio.toFixed(2)} (≥ 1 es presencia)` : 'Sin muestras'}</strong></span>
          </div>
        </div>
      }
      pipelineContent={<SignalProcessingPipeline data={data} />}
    />
  );
}
