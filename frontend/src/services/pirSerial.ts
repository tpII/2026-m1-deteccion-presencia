import type { PirReading, PirSerialApi, PirSerialPort, PirSerialState } from '../types/pirSerial';

interface PirSerialHandlers {
  onReading(reading: PirReading): void;
  onStateChange(state: PirSerialState): void;
  onError(message: string): void;
}

export function getPirSerialSupportError(): string | null {
  if (!window.isSecureContext) {
    return 'La conexión USB requiere abrir la web en localhost o mediante HTTPS.';
  }
  if (!('serial' in navigator)) {
    return 'Este navegador no ofrece Web Serial. Abrí la prueba en Chrome o Edge de escritorio.';
  }
  return null;
}

export class PirSerialConnection {
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private task: Promise<void> | null = null;
  private stopped = true;

  constructor(private readonly handlers: PirSerialHandlers) {}

  connect(): void {
    if (this.task) return;
    this.stopped = false;
    this.handlers.onStateChange('connecting');
    this.task = this.readPort().finally(() => {
      this.task = null;
      this.handlers.onStateChange('disconnected');
    });
  }

  async disconnect(): Promise<void> {
    this.stopped = true;
    if (!this.task) return;
    this.handlers.onStateChange('disconnecting');
    try {
      await this.reader?.cancel();
    } finally {
      await this.task;
    }
  }

  private async readPort(): Promise<void> {
    let port: PirSerialPort | null = null;
    try {
      const supportError = getPirSerialSupportError();
      if (supportError) throw new Error(supportError);
      const serial = (navigator as Navigator & { serial: PirSerialApi }).serial;
      let selectedPort: PirSerialPort;
      try {
        selectedPort = await serial.requestPort();
      } catch (error) {
        if (error instanceof DOMException && error.name === 'NotFoundError') return;
        throw error;
      }
      if (this.stopped) return;

      await selectedPort.open({ baudRate: 115200 });
      port = selectedPort;
      if (this.stopped) return;
      if (!port.readable) throw new Error('El puerto no dispone de un canal de lectura.');

      this.reader = port.readable.getReader();
      this.handlers.onStateChange('connected');
      await this.readMessages(this.reader);
    } catch (error) {
      if (!this.stopped) {
        this.handlers.onError(
          `No se pudo leer la ESP32: ${error instanceof Error ? error.message : String(error)}. ` +
          'Revisá el USB y cerrá el monitor serial de PlatformIO u otra aplicación que use el puerto.',
        );
      }
    } finally {
      this.reader?.releaseLock();
      this.reader = null;
      if (port) {
        try {
          await port.close();
        } catch (error) {
          this.handlers.onError(`No se pudo cerrar el puerto: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }

  private async readMessages(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
    const decoder = new TextDecoder();
    let pending = '';
    let discardingLine = false;

    while (!this.stopped) {
      const { value, done } = await reader.read();
      if (done) {
        if (!this.stopped) throw new Error('La ESP32 se desconectó o cerró el puerto serial.');
        break;
      }
      if (this.stopped) break;
      const lines = (pending + decoder.decode(value, { stream: true })).split('\n');
      pending = lines.pop() ?? '';
      for (const line of lines) {
        if (discardingLine) {
          discardingLine = false;
          continue;
        }
        if (line.length > 256) continue;
        const message = line.trim();
        if (message === 'MOVIMIENTO' || message === 'SIN MOVIMIENTO') {
          this.handlers.onReading({
            message,
            motion: message === 'MOVIMIENTO',
            receivedAt: Date.now(),
          });
        }
      }
      if (pending.length > 256) {
        pending = '';
        discardingLine = true;
      }
    }
  }
}
