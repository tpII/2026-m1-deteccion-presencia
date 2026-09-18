import React from 'react';
import { CaseStudyLayout } from '../components/layout/CaseStudyLayout';
import { DigitalSignalChart } from '../components/charts/DigitalSignalChart';
import { useTelemetry } from '../hooks/useTelemetry';
import { useMetrics } from '../hooks/useMetrics';

export const PirCasePage: React.FC = () => {
  const { getCaseStatus, getCaseData } = useTelemetry();
  const { metrics, trials, loading: metricsLoading } = useMetrics('pir');

  const status = getCaseStatus('pir');
  const caseData = getCaseData('pir');

  return (
    <CaseStudyLayout
      caseId="pir"
      title="Caso 1 — Sensor Infrarrojo Pasivo (PIR)"
      subtitle="Detección Piroeléctrica Térmica"
      description="El sensor PIR capta las variaciones de radiación infrarroja térmica emitidas por cuerpos vivos al desplazarse a través de las diferentes zonas de su lente de Fresnel. Produce una salida lógica digital activa en alto (0: Ausencia / 1: Presencia) con latencia de disparo casi instantánea."
      technology="Hardware: ESP32 + HC-SR501"
      status={status}
      metrics={metrics}
      trials={trials}
      metricsLoading={metricsLoading}
      chartContent={
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <DigitalSignalChart
            points={caseData?.raw_points || []}
            title="Línea Temporal Binaria de Salida GPIO (0: Ausencia / 1: Detección)"
            height={260}
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
              Tipo de señal: <strong>Digital Discreta (Active High)</strong>
            </span>
            <span>
              Muestreo: <strong>Interrupción física / 10 Hz Polling</strong>
            </span>
            <span>
              Retardo de mantenimiento: <strong>~3 - 5 segundos</strong>
            </span>
          </div>
        </div>
      }
    />
  );
};
