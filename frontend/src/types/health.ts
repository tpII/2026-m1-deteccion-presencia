export interface HealthStatus {
  status: string;
  version: string;
  data_source: 'mqtt';
  mqtt_connected: boolean | null;
  active_ws_clients: number;
}
