import React from 'react';
import { CaseStudyLayout } from '../components/layout/CaseStudyLayout';
import { SignalChart } from '../components/charts/SignalChart';
import { SignalProcessingPipeline } from '../components/signal/SignalProcessingPipeline';
import { useTelemetry } from '../hooks/useTelemetry';
import { useMetrics } from '../hooks/useMetrics';

export const CsiRouterCasePage: React.FC = () => {
  const { getCaseStatus, getCaseData } = useTelemetry();
  const { metrics, trials, loading: metricsLoading } = useMetrics('csi_router');

  const status = getCaseStatus('csi_router');
  const caseData = getCaseData('csi_router');

  return (
    <CaseStudyLayout
      caseId="csi_router"
      title="Caso 2 — CSI con Router Wi-Fi Comercial"
      subtitle="Extracción de CSI sobre Tráfico Beacon / Red Existente"
      description="Un microcontrolador ESP32 opera como receptor (Station) conectado a la red Wi-Fi del laboratorio. Captura las matrices de respuesta en frecuencia de las subportadoras OFDM de paquetes estándar. Permite detección 'device-free' sin requerir visión directa, aunque está sujeto al tráfico concurrente del canal."
      technology="Wi-Fi 802.11n OFDM Subcarriers"
      status={status}
      metrics={metrics}
      trials={trials}
      metricsLoading={metricsLoading}
      chartContent={
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <SignalChart
            rawPoints={caseData?.raw_points || []}
            filteredPoints={caseData?.filtered_points || []}
            title="Amplitud de Subportadora CSI: Señal Cruda con Ruido vs Señal Filtrada (Hampel + MA)"
            threshold={22.0}
            height={300}
            yAxisName="Amplitud (dB)"
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              background: 'var(--surface-subtle)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
            }}
          >
            <span>
              Frecuencia de portadora: <strong>2.412 GHz (Canal 1 Wi-Fi)</strong>
            </span>
            <span>
              Subportadoras monitoreadas: <strong>30 OFDM subcarriers</strong>
            </span>
            <span>
              Score Actual: <strong>{((caseData?.current_score ?? 0) * 100).toFixed(1)}%</strong>
            </span>
          </div>
        </div>
      }
      pipelineContent={
        <SignalProcessingPipeline
          rawPoints={caseData?.raw_points || []}
          filteredPoints={caseData?.filtered_points || []}
          filterMetadata={caseData?.filter_metadata}
          features={caseData?.features}
          presence={caseData?.presence ?? false}
          score={caseData?.current_score}
        />
      }
    />
  );
};
