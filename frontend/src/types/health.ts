export interface SqlitePersistenceStats {
  flush_interval_seconds: number;
  pending_samples: number;
  pending_calibrations: number;
  committed_samples: number;
  failed_writes: number;
  oldest_pending_ms: number | null;
  last_batch_size: number | null;
  last_write_ms: number | null;
  p95_write_ms: number | null;
  timed_batches: number;
  last_oldest_to_commit_ms: number | null;
}

export interface HealthStatus {
  status: string;
  version: string;
  data_source: 'mqtt';
  mqtt_connected: boolean | null;
  active_ws_clients: number;
  sqlite_persistence?: SqlitePersistenceStats;
}
