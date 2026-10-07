export interface PirNodeConfig {
  node_id: string;
  gpio_pin: number;
  trigger_mode: 'RISING' | 'FALLING' | 'CHANGE';
  debounce_ms: number;
  sample_interval_ms: number;
  mqtt_topic: string;
}

export interface CsiRouterConfig {
  node_id: string;
  wifi_channel: number;
  frequency_mhz: number;
  target_ssid: string;
  target_bssid?: string;
  sampling_rate_hz: number;
  subcarriers_mode: string;
  mqtt_topic: string;
}

export interface CsiDedicatedConfig {
  node_id: string;
  wifi_channel: number;
  frequency_mhz: number;
  tx_power_dbm: number;
  packet_rate_hz: number;
  custom_bssid: string;
  mqtt_topic: string;
}

export interface SystemNodesConfig {
  broker_host: string;
  broker_port: number;
  pir: PirNodeConfig;
  csi_router: CsiRouterConfig;
  csi_dedicated: CsiDedicatedConfig;
}

export interface CHeaderResponse {
  node_id: string;
  filename: string;
  content: string;
}
