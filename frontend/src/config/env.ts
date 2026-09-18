/**
 * Configuración centralizada de variables de entorno del Frontend.
 * Evita URLs hardcodeadas en componentes visuales.
 */

export const ENV = {
  API_URL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  WS_URL: import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/telemetry',
};
