import { Trial } from '../../types/metrics';
import { PresenceBadge } from '../ui/PresenceBadge';
import { CheckCircle2, XCircle } from 'lucide-react';
import { SCENARIO_LABELS } from '../../config/trials';
import { formatTimestamp } from '../../services/formatTimestamp';

interface TrialsTableProps {
  trials: Trial[];
  loading?: boolean;
}

export function TrialsTable({ trials, loading = false }: TrialsTableProps) {
  if (loading) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '2rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Cargando historial de ensayos experimentales...</p>
      </div>
    );
  }

  if (trials.length === 0) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '2rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>No se registran ensayos aún para este método.</p>
      </div>
    );
  }

  return (
    <div className="glass-table-container">
      <table className="glass-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Hora de la marca</th>
            <th>Hora de la muestra</th>
            <th>Recepción de la marca</th>
            <th>Ambiente</th>
            <th>Escenario</th>
            <th>Ground Truth</th>
            <th>Resultado Algoritmo</th>
            <th>Evaluación</th>
            <th>Latencia</th>
            <th>Observaciones</th>
          </tr>
        </thead>
        <tbody>
          {trials.map((trial) => {
            return (
              <tr key={trial.id}>
                <td>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-muted)' }}>
                    #{trial.id}
                  </span>
                </td>
                <td>{formatTimestamp(trial.observed_at ?? trial.timestamp)}</td>
                <td>{trial.sample_received_at ? formatTimestamp(trial.sample_received_at) : '—'}</td>
                <td>{trial.observed_at ? formatTimestamp(trial.timestamp) : '—'}</td>
                <td>{trial.environment ?? '—'}</td>
                <td>{trial.scenario ? SCENARIO_LABELS[trial.scenario] : '—'}</td>
                <td>
                  <PresenceBadge presence={trial.ground_truth} size="sm" />
                </td>
                <td>
                  <PresenceBadge presence={trial.detected_presence} size="sm" />
                </td>
                <td>
                  {trial.is_correct ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        color: '#059669',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                      }}
                    >
                      <CheckCircle2 size={14} /> Correcto
                    </span>
                  ) : (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        color: '#dc2626',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                      }}
                    >
                      <XCircle size={14} /> {trial.ground_truth ? 'Falso negativo' : 'Falso positivo'}
                    </span>
                  )}
                </td>
                <td>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{trial.latency_ms} ms</span>
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {trial.notes || '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
