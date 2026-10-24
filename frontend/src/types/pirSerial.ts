export type PirSerialState = 'disconnected' | 'connecting' | 'connected' | 'disconnecting';

export interface PirReading {
  message: 'MOVIMIENTO' | 'SIN MOVIMIENTO';
  motion: boolean;
  receivedAt: number;
}
export interface PirSerialPort {
  readable: ReadableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
}

export interface PirSerialApi {
  requestPort(): Promise<PirSerialPort>;
}

export interface PirUsbRecord {
  id: number;
  received_at: string;
  motion: boolean;
}
