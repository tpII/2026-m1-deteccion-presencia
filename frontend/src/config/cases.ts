import type { CaseId } from '../types/telemetry';

// El caso conjunto compara estas dos fuentes; no es un tercer sensor.
export const ACTIVE_CASES = ['pir', 'csi_router'] as const;

export const CASE_LABELS: Record<CaseId, string> = {
  pir: 'PIR',
  csi_router: 'CSI Router',
  csi_dedicated: 'CSI Dedicado',
};

export const CSI_CASES = {
  csi_router: {
    title: 'Caso 2 — CSI con Router Wi-Fi Comercial',
    subtitle: 'Extracción de CSI sobre tráfico de la red existente',
    description: 'Un ESP32 opera como receptor conectado a la red Wi-Fi del laboratorio. Captura las amplitudes de las subportadoras OFDM de paquetes estándar. La detección no requiere visión directa y está sujeta al tráfico concurrente del canal.',
    technology: 'Wi-Fi 802.11n OFDM',
    details: 'Router comercial y ESP32 receptor',
  },
};
