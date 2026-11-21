import { CaseStudyLayout } from '../components/layout/CaseStudyLayout';
import { IndicatorChart } from '../components/charts/IndicatorChart';
import { CalibrationPanel } from '../components/signal/CalibrationPanel';
import { CsiCapturePanel } from '../components/signal/CsiCapturePanel';
import { SignalProcessingPipeline } from '../components/signal/SignalProcessingPipeline';
import { TrialEnvironmentPanel, useTrialEnvironment } from '../components/system/EnvironmentField';
import { LiveTrialControls } from '../components/system/LiveTrialControls';
import { CSI_CASE } from '../config/cases';
import { useTelemetry } from '../hooks/useTelemetry';
import { useCaseMetrics } from '../hooks/useCaseMetrics';

export function CsiCasePage() {
  const caseId = 'csi_router';
  const { getCaseStatus, getCaseData } = useTelemetry();
  const { metrics, trials, loading, error } = useCaseMetrics(caseId);
  const [environment, setEnvironment] = useTrialEnvironment(caseId);
  const data = getCaseData(caseId);
  const status = getCaseStatus(caseId);
  const features = data?.features;

  return (
    <CaseStudyLayout
      {...CSI_CASE}
      caseId={caseId}
      status={status}
      metrics={metrics}
      trials={trials}
      metricsLoading={loading}
      error={error}
      trialContent={<TrialEnvironmentPanel value={environment} onChange={setEnvironment} />}
      chartContent={
        <div className="signal-content">
          <CalibrationPanel calibration={data?.calibration}
            connected={status?.is_connected ?? false} environment={environment.trim()} />
          <LiveTrialControls caseId={caseId} status={status} calibration={data?.calibration}
            environment={environment} showReport />
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
            <span>Enlace: <strong>{CSI_CASE.details}</strong></span>
            <span>Ventana: <strong>4 s</strong></span>
            <span>Relación con el umbral: <strong>{features ? `${features.detection_ratio.toFixed(2)} (≥ 1 es presencia)` : 'Sin muestras'}</strong></span>
          </div>
          <CsiCapturePanel environment={environment.trim()} connected={status?.is_connected ?? false} />
        </div>
      }
      pipelineContent={<SignalProcessingPipeline data={data} />}
    />
  );
}
