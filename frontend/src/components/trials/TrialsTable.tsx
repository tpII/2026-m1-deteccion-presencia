import React from 'react';
import { Trial } from '../../types/metrics';
import { PresenceBadge } from '../status/PresenceBadge';
import { CheckCircle2, XCircle } from 'lucide-react';

interface TrialsTableProps {
  trials: Trial[];
  loading?: boolean;
}

export const TrialsTable: React.FC<TrialsTableProps> = ({ trials, loading = false }) => {
  if (loading) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '2rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Cargando historial de ensayos experimentales...</p>
      </div>
    );
  }

  if (!trials || trials.length === 0) {
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
            <th>Fecha / Hora</th>
            <th>Ground Truth</th>
            <th>Resultado Algoritmo</th>
            <th>Evaluación</th>
            <th>Latencia</th>
            <th>Observaciones</th>
          </tr>
        </thead>
        <tbody>
          {trials.map((trial) => {
            const dateStr = new Date(trial.timestamp).toLocaleString('es-AR', {
              month: 'short',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });

            return (
              <tr key={trial.id}>
                <td>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-muted)' }}>
                    #{trial.id}
                  </span>
                </td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{dateStr}</td>
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
                      <XCircle size={14} /> Incorrecto
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
};
