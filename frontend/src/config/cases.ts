import type { CaseId } from '../types/telemetry';

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
  csi_dedicated: {
    title: 'Caso 3 — CSI en Red Dedicada (Par AP-STA)',
    subtitle: 'Enlace Wi-Fi punto a punto controlado',
    description: 'Dos ESP32 forman un enlace punto a punto: uno como Access Point emite tramas de prueba y otro recibe y analiza el canal. El ensayo debe registrar las condiciones del canal y sus interferencias para evaluar la reproducibilidad.',
    technology: '2 ESP32 (AP + Station)',
    details: 'ESP32-AP emisor y ESP32-STA receptor',
  },
};
