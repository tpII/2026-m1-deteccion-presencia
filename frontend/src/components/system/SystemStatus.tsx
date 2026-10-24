import { Cpu, Database, Server } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import type { HealthStatus } from '../../types/health';

export function SystemStatus({ health }: { health: HealthStatus | null }) {
  return (
    <div className="grid-3 system-status">
      <GlassCard>
        <h3><Server size={18} /> Backend</h3>
        <dl className="detail-list">
          <dt>Estado</dt><dd>{health?.status === 'healthy' ? 'Operativo' : 'Sin conexión'}</dd>
          <dt>Versión</dt><dd>{health?.version ?? '—'}</dd>
          <dt>Clientes WebSocket</dt><dd>{health?.active_ws_clients ?? '—'}</dd>
        </dl>
      </GlassCard>
      <GlassCard>
        <h3><Cpu size={18} /> Adquisición</h3>
        <dl className="detail-list">
          <dt>Fuente</dt><dd>{health?.data_source.toUpperCase() ?? '—'}</dd>
          <dt>Origen</dt><dd>Nodos ESP32</dd>
          <dt>MQTT</dt><dd>{health?.mqtt_connected ? 'Conectado' : 'Desconectado'}</dd>
        </dl>
      </GlassCard>
      <GlassCard>
        <h3><Database size={18} /> Almacenamiento</h3>
        <dl className="detail-list">
          <dt>Base de datos</dt><dd>SQLite</dd>
          <dt>Historial en vivo</dt><dd>500 muestras por método</dd>
          <dt>Broker</dt><dd>Mosquitto</dd>
        </dl>
      </GlassCard>
    </div>
  );
}
