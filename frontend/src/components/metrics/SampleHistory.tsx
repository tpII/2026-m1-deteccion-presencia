import { useCallback, useState } from 'react';
import { CASE_LABELS } from '../../config/cases';
import { useApiQuery } from '../../hooks/useApiQuery';
import { api } from '../../services/api';
import { formatTimestamp } from '../../services/formatTimestamp';
import type { CaseId, StoredSample } from '../../types/telemetry';
import { GlassPanel } from '../ui/GlassPanel';
import { SectionHeader } from '../ui/SectionHeader';

const numberFormat = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 4 });

function sampleDetection(sample: StoredSample) {
  if (sample.case_id === 'pir') return sample.presence ? 'Movimiento' : 'Sin movimiento';
  const state = sample.calibration_state;
  if (state === 'sin_calibrar') return 'Sin calibrar';
  if (state === 'esperando' || state === 'calibrando') return 'Calibrando';
  return sample.presence ? 'Presencia' : 'Ausencia';
}

export function SampleHistory({ day, sensor }: { day: string; sensor: CaseId | '' }) {
  const [cursors, setCursors] = useState<(number | null)[]>([null]);
  const before = cursors[cursors.length - 1];
  const load = useCallback((signal: AbortSignal) => api.getStoredSamples(day, sensor, before, signal),
    [day, sensor, before]);
  const { data, loading, error, refresh } = useApiQuery(load);
  const next = data?.next_cursor ?? null;

  return (
    <GlassPanel className="sample-history">
      <SectionHeader title="Muestras guardadas" action={
        <button type="button" className="secondary-button" onClick={refresh} disabled={loading}>Actualizar</button>
      } />
      {loading && <p role="status">Cargando muestras…</p>}
      {error && <p role="alert" className="form-error">No se pudieron cargar las muestras. Volvé a intentar con Actualizar.</p>}
      {data && data.samples.length === 0 && <p role="status">No hay muestras guardadas para el día y sensor elegidos.</p>}
      {data && data.samples.length > 0 && (
        <div className="glass-table-container" tabIndex={0} role="region" aria-label="Muestras guardadas en SQLite">
          <table className="glass-table">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Recepción</th>
                <th scope="col">Sensor</th>
                <th scope="col">Detección</th>
                <th scope="col">Lectura (GPIO o amplitud media)</th>
                <th scope="col">Latencia (ms)</th>
                <th scope="col">Calibración CSI</th>
              </tr>
            </thead>
            <tbody>
              {data.samples.map((sample) => (
                <tr key={sample.id}>
                  <td>#{sample.id}</td>
                  <td>{formatTimestamp(sample.timestamp)}</td>
                  <td>{CASE_LABELS[sample.case_id]}</td>
                  <td>{sampleDetection(sample)}</td>
                  <td>{numberFormat.format(sample.raw_value)}</td>
                  <td>{numberFormat.format(sample.latency_ms)}</td>
                  <td>{sample.case_id === 'csi_router' && sample.calibration_id != null ? `#${sample.calibration_id}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(cursors.length > 1 || next !== null) && (
        <nav className="sample-history-pagination" aria-label="Páginas de muestras">
          <button type="button" className="secondary-button" disabled={loading || cursors.length === 1}
            onClick={() => setCursors(cursors.slice(0, -1))}>Anterior</button>
          <span aria-live="polite">Página {cursors.length}</span>
          <button type="button" className="secondary-button" disabled={loading || next === null}
            onClick={() => { if (next !== null) setCursors([...cursors, next]); }}>Siguiente</button>
        </nav>
      )}
    </GlassPanel>
  );
}
