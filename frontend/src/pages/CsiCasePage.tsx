import { CaseStudyLayout } from '../components/layout/CaseStudyLayout';
import { SignalChart } from '../components/charts/SignalChart';
import { SignalProcessingPipeline } from '../components/signal/SignalProcessingPipeline';
import { CSI_CASES } from '../config/cases';
import { useTelemetry } from '../hooks/useTelemetry';
import { useCaseMetrics } from '../hooks/useCaseMetrics';
import type { CaseId } from '../types/telemetry';

export function CsiCasePage({ caseId }: { caseId: Exclude<CaseId, 'pir'> }) {
  const { getCaseStatus, getCaseData } = useTelemetry();
  const { metrics, trials, loading, error } = useCaseMetrics(caseId);
  const data = getCaseData(caseId);
  const config = CSI_CASES[caseId];

  return (
    <CaseStudyLayout
      {...config}
      status={getCaseStatus(caseId)}
      metrics={metrics}
      trials={trials}
      metricsLoading={loading}
      error={error}
      chartContent={
        <div className="signal-content">
          <SignalChart
            rawPoints={data?.raw_points ?? []}
            filteredPoints={data?.filtered_points ?? []}
            title="Amplitud CSI: señal cruda y filtrada"
            height={300}
          />
          <div className="signal-details">
            <span>Enlace: <strong>{config.details}</strong></span>
            <span>Procesamiento: <strong>Primera amplitud recibida</strong></span>
            <span>Score: <strong>{data?.raw_points.length ? `${((data.current_score ?? 0) * 100).toFixed(1)}%` : 'Sin muestras'}</strong></span>
          </div>
        </div>
      }
      pipelineContent={<SignalProcessingPipeline data={data} />}
    />
  );
}
