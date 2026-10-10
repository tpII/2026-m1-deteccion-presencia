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
      description="El sensor PIR capta las variaciones de radiación infrarroja térmica emitidas por cuerpos vivos al desplazarse a través de las diferentes zonas de su lente de Fresnel. Produce una salida lógica digital activa en alto (0: Sin movimiento / 1: Movimiento). El ensayo debe registrar también la presencia observada independientemente del sensor."
      technology="Hardware: ESP32 + HW-416-B"
      status={status}
      metrics={metrics}
      trials={trials}
      metricsLoading={metricsLoading}
      chartContent={
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <DigitalSignalChart
            points={caseData?.raw_points || []}
            title="Línea Temporal Binaria de Salida GPIO (0: Sin movimiento / 1: Movimiento)"
            height={260}
          />
          <div
            className="signal-details"
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
              Muestreo: <strong>GPIO27 / cada 200 ms (5 Hz)</strong>
            </span>
            <span>
              Retención de salida: <strong>Según ajuste del sensor</strong>
            </span>
          </div>
        </div>
      }
    />
  );
};
