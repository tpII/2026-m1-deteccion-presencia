import React from 'react';
import { Usb } from 'lucide-react';
import { GlassPanel } from '../components/common/GlassPanel';
import { SectionHeader } from '../components/common/SectionHeader';
import { StatusBadge } from '../components/common/StatusBadge';
import { usePirSerial } from '../hooks/usePirSerial';
import { usePirUsbHistory } from '../hooks/usePirUsbHistory';

const connectionLabels = {
  disconnected: 'USB desconectado',
  connecting: 'Seleccionando / conectando…',
  connected: 'USB conectado',
  disconnecting: 'Desconectando…',
};

export const PirSerialTestPage: React.FC = () => {
  const { connectionState, readings, error, supportError, connect, disconnect } = usePirSerial();
  const saved = usePirUsbHistory();
  const connected = connectionState === 'connected';
  const lastReading = readings[readings.length - 1];
  const motionLabel = !connected ? 'Sin lectura activa' : !lastReading ? 'Esperando datos del PIR' : lastReading.message;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <SectionHeader
        title="Prueba PIR por USB"
        subtitle="ESP32 + HW-416-B · GPIO27 · Serial a 115200 baud"
        icon={<Usb size={20} />}
      />
      <GlassPanel>
        <SectionHeader
          title="Conexión local"
          action={<StatusBadge label={connectionLabels[connectionState]} variant={connected ? 'live' : 'neutral'} />}
        />
        <p style={{ marginBottom: '1rem' }}>
          Esta prueba lee la ESP32 conectada a esta computadora. Los indicadores del encabezado
          corresponden al backend; el estado USB se muestra aquí. Podés guardar manualmente los últimos 50 mensajes en la base de datos.
        </p>
        <p style={{ marginBottom: '1rem', fontSize: '0.86rem' }}>
          Cerrá el monitor serial de Arduino, presioná Conectar ESP32 y seleccioná su puerto USB.
          El firmware debe terminar cada mensaje con un salto de línea (Serial.println).
        </p>
        <button
          type="button"
          onClick={connected ? disconnect : connect}
          disabled={Boolean(supportError) || connectionState === 'connecting' || connectionState === 'disconnecting'}
          style={{
            padding: '0.65rem 1rem',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--accent-blue)',
            color: 'var(--text-inverse)',
            fontWeight: 600,
            opacity: supportError || connectionState === 'connecting' || connectionState === 'disconnecting' ? 0.5 : 1,
          }}
        >
          {connected ? 'Desconectar ESP32' : 'Conectar ESP32'}
        </button>
        {supportError && <p role="alert" style={{ marginTop: '1rem', color: 'var(--state-warning-text)' }}>{supportError}</p>}
        {error && <p role="alert" style={{ marginTop: '1rem', color: 'var(--state-error-text)' }}>{error}</p>}
      </GlassPanel>
      <GlassPanel>
        <SectionHeader title="Estado del sensor" subtitle="El PIR informa movimiento; una salida baja no garantiza que la habitación esté vacía." />
        <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <StatusBadge
            label={motionLabel}
            variant={!connected || !lastReading ? 'neutral' : lastReading.motion ? 'presence' : 'absence'}
          />
          <span style={{ fontFamily: 'var(--font-mono)' }}>
            GPIO27: {connected && lastReading ? Number(lastReading.motion) : '—'}
          </span>
        </div>
        {lastReading && (
          <p style={{ marginTop: '0.75rem', fontSize: '0.86rem' }}>
            Último mensaje recibido: {new Date(lastReading.receivedAt).toLocaleTimeString('es-AR')}
          </p>
        )}
      </GlassPanel>
      <GlassPanel>
        <SectionHeader title="Mensajes recibidos" subtitle="Últimos 50 mensajes válidos · Hora de recepción en la computadora" />
        {readings.length === 0 ? <p>Todavía no se recibieron mensajes MOVIMIENTO o SIN MOVIMIENTO.</p> : (
          <ol style={{ listStyle: 'none', maxHeight: '260px', overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
            {readings.map((reading, index) => (
              <li key={index} style={{ padding: '0.35rem 0', borderBottom: '1px solid var(--table-row-border)' }}>
                {new Date(reading.receivedAt).toLocaleTimeString('es-AR')} — {reading.message}
              </li>
            ))}
          </ol>
        )}
      </GlassPanel>
      <GlassPanel>
        <SectionHeader title="Lecturas guardadas" subtitle="Historial PIR USB en SQLite · Últimos 50 registros · Lecturas USB separadas de MQTT" />
        <p style={{ marginBottom: '1rem', fontSize: '0.86rem' }}>
          El guardado requiere el backend iniciado. Guardá antes de salir o reconectar;
          los mensajes que salgan del historial de 50 se descartan si no los guardaste.
          Volver a guardar los mismos mensajes no los duplica.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <button
            type="button"
            disabled={saved.saving || readings.length === 0}
            onClick={() => saved.save(readings)}
            style={{ padding: '0.65rem 1rem', borderRadius: 'var(--radius-sm)', background: 'var(--accent-blue)', color: 'var(--text-inverse)', fontWeight: 600, opacity: saved.saving || readings.length === 0 ? 0.5 : 1 }}
          >
            {saved.saving ? 'Guardando…' : `Guardar ${readings.length} lecturas en la base`}
          </button>
          <button
            type="button"
            disabled={saved.loading || saved.saving}
            onClick={saved.refresh}
            style={{ padding: '0.65rem 1rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-subtle)', color: 'var(--text-primary)', border: '1px solid var(--glass-border-subtle)' }}
          >
            {saved.loading ? 'Cargando historial…' : 'Actualizar historial'}
          </button>
        </div>
        {saved.notice && <p role="status" style={{ marginTop: '1rem' }}>{saved.notice}</p>}
        {saved.error && <p role="alert" style={{ marginTop: '1rem', color: 'var(--state-error-text)' }}>{saved.error}</p>}
        {!saved.loading && !saved.error && saved.history.length === 0 && <p style={{ marginTop: '1rem' }}>Todavía no hay lecturas guardadas.</p>}
        {saved.history.length > 0 && (
          <ol style={{ listStyle: 'none', marginTop: '1rem', maxHeight: '260px', overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
            {saved.history.map((reading) => (
              <li key={reading.id} style={{ padding: '0.35rem 0', borderBottom: '1px solid var(--table-row-border)' }}>
                {new Date(reading.received_at).toLocaleString('es-AR')} — {reading.motion ? 'MOVIMIENTO' : 'SIN MOVIMIENTO'}
              </li>
            ))}
          </ol>
        )}
      </GlassPanel>
    </div>
  );
};
