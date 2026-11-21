import { Database } from 'lucide-react';
import type { SqlitePersistenceStats } from '../../types/health';
import { GlassPanel } from '../ui/GlassPanel';
import { SectionHeader } from '../ui/SectionHeader';

const milliseconds = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });

function formatDuration(duration: number | null) {
  return duration === null ? '—' : `${milliseconds.format(duration)} ms`;
}

export function SqlitePersistence({ stats }: { stats: SqlitePersistenceStats }) {
  return (
    <GlassPanel>
      <SectionHeader title="Escritura en SQLite" icon={<Database size={18} />}
        subtitle={`Telemetría desde el arranque. El backend intenta guardar cada ${stats.flush_interval_seconds} s.`} />
      <div className="grid-2">
        <dl className="detail-list">
          <dt>Muestras guardadas</dt><dd>{stats.committed_samples.toLocaleString('es-AR')}</dd>
          <dt>Muestras pendientes en memoria</dt><dd>{stats.pending_samples.toLocaleString('es-AR')}</dd>
          <dt>Calibraciones pendientes de escritura</dt><dd>{stats.pending_calibrations}</dd>
          <dt>Antigüedad de la muestra pendiente más vieja</dt><dd>{formatDuration(stats.oldest_pending_ms)}</dd>
          <dt>Intentos de escritura fallidos</dt><dd>{stats.failed_writes}</dd>
        </dl>
        <dl className="detail-list">
          <dt>Muestras en el último lote</dt><dd>{stats.last_batch_size ?? '—'}</dd>
          <dt>Escritura del último lote</dt><dd>{formatDuration(stats.last_write_ms)}</dd>
          <dt>Escritura p95 ({stats.timed_batches} lotes)</dt><dd>{formatDuration(stats.p95_write_ms)}</dd>
          <dt>De la cola a SQLite (muestra más vieja del último lote)</dt>
          <dd>{formatDuration(stats.last_oldest_to_commit_ms)}</dd>
        </dl>
      </div>
    </GlassPanel>
  );
}
