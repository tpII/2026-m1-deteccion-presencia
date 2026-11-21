import { useCallback } from 'react';
import { SCENARIO_LABELS } from '../../config/trials';
import { useApiQuery } from '../../hooks/useApiQuery';
import { api } from '../../services/api';
import { formatTimestamp } from '../../services/formatTimestamp';
import type { LiveTrialCase } from '../../types/metrics';
import type { ObservationReport } from '../../types/observations';

const OUTCOMES: Record<string, string> = {
  exitosa: 'Exitosa', fallida: 'Fallida', en_curso: 'En curso', interrumpida: 'Interrumpida',
};
const RESULTS = { correct: 'Coincide', false_positive: 'Falso positivo', false_negative: 'Falso negativo' };

function CalibrationTable({ records }: { records: ObservationReport['calibrations'] }) {
  if (!records.length) return <p>Sin calibraciones registradas en este ambiente.</p>;
  return (
    <div className="glass-table-container">
      <table className="glass-table">
        <thead>
          <tr>
            <th>ID</th><th>Inicio</th><th>Fin</th><th>Estado</th><th>Paquetes de calibración</th>
            <th>Muestras evaluadas</th><th>Falsos positivos</th><th>Falsos negativos</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <td>#{record.id}</td>
              <td>{formatTimestamp(record.started_at)}</td>
              <td>{record.finished_at ? formatTimestamp(record.finished_at) : '—'}</td>
              <td>{OUTCOMES[record.outcome] ?? record.outcome}</td>
              <td>{record.sample_count ?? '—'}</td>
              <td>{record.evaluated}</td><td>{record.false_positives}</td><td>{record.false_negatives}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ObservationReportPanel({ caseId, environment, revision }: {
  caseId: LiveTrialCase;
  environment: string;
  revision: number;
}) {
  const load = useCallback((signal: AbortSignal) => api.getObservationReport(caseId, environment, signal), [caseId, environment]);
  const { data, loading, error, refresh } = useApiQuery(load, revision);
  return (
    <div className="signal-content">
      <button type="button" className="secondary-button" onClick={refresh} disabled={loading}>Actualizar análisis</button>
      {loading && <p role="status">Consultando observaciones…</p>}
      {error && <p role="alert" className="form-error">{error}</p>}
      {data && (
        <>
          <h4>Últimas marcas</h4>
          {data.marks.length === 0 ? <p>Sin marcas en este ambiente.</p> : (
            <div className="glass-table-container">
              <table className="glass-table">
                <thead><tr><th>Marca</th><th>Hora del clic</th><th>Recepción en la API</th><th>Lo observado</th></tr></thead>
                <tbody>
                  {data.marks.map((mark) => (
                    <tr key={mark.id}>
                      <td>#{mark.id}</td><td>{formatTimestamp(mark.observed_at)}</td><td>{formatTimestamp(mark.received_at)}</td>
                      <td>{mark.scenario ? SCENARIO_LABELS[mark.scenario] : 'Fin de observación'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <h4>Últimas muestras con una observación</h4>
          {data.samples.length === 0 ? <p>Sin muestras después de una marca.</p> : (
            <div className="glass-table-container">
              <table className="glass-table">
                <thead><tr><th>Hora de la muestra</th><th>Marca</th><th>Lo observado</th><th>Sensor</th><th>Evaluación</th></tr></thead>
                <tbody>
                  {data.samples.map((sample) => (
                      <tr key={sample.id}>
                        <td>{formatTimestamp(sample.timestamp)}</td><td>#{sample.observation_id}</td>
                        <td>{SCENARIO_LABELS[sample.scenario]}</td>
                        <td>{sample.detected_presence ? 'Presencia' : 'Sin presencia'}</td>
                        <td>{RESULTS[sample.result]}</td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <h4>Evaluación por calibración CSI</h4>
          <p>Marcá la presencia observada después de cada calibración para empezar a contar las muestras de ese período.</p>
          <CalibrationTable records={data.calibrations} />
        </>
      )}
    </div>
  );
}
