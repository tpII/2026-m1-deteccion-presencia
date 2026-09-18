import React from 'react';
import { CaseStudyLayout } from '../components/layout/CaseStudyLayout';
import { SignalChart } from '../components/charts/SignalChart';
import { SignalProcessingPipeline } from '../components/signal/SignalProcessingPipeline';
import { useTelemetry } from '../hooks/useTelemetry';
import { useMetrics } from '../hooks/useMetrics';

export const CsiDedicatedCasePage: React.FC = () => {
  const { getCaseStatus, getCaseData } = useTelemetry();
  const { metrics, trials, loading: metricsLoading } = useMetrics('csi_dedicated');

  const status = getCaseStatus('csi_dedicated');
  const caseData = getCaseData('csi_dedicated');

  return (
    <CaseStudyLayout
      caseId="csi_dedicated"
      title="Caso 3 — CSI en Red Dedicada (Par AP-STA)"
      subtitle="Enlace Wi-Fi Punto a Punto Estrictamente Controlado"
      description="Dos microcontroladores ESP32 forman un enlace cerrado punto a punto: uno como Access Point (AP) inyectando tramas de prueba a tasa periódica fija y otro como receptor analizando el canal RF. Al no competir con tráfico externo de Internet o dispositivos ajenos, ofrece menor piso de ruido estático y alta reproducibilidad de la zona de Fresnel."
      technology="Enlace Dedicado 2x ESP32 (AP + Station)"
      status={status}
      metrics={metrics}
      trials={trials}
      metricsLoading={metricsLoading}
      chartContent={
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <SignalChart
            rawPoints={caseData?.raw_points || []}
            filteredPoints={caseData?.filtered_points || []}
            title="Respuesta en Amplitud del Enlace Dedicado: Línea Base Limpia y Fluctuaciones por Presencia"
            threshold={35.0}
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
              Arquitectura: <strong>ESP32-AP (Emisor) ↔ ESP32-STA (Receptor)</strong>
            </span>
            <span>
              Piso de ruido térmico: <strong>~0.3 dB (Bajo / Estable)</strong>
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
