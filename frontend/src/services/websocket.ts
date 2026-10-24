import { ENV } from '../config/env';
import type { ConnectionState, WebSocketMessage } from '../types/telemetry';

type MessageListener = (message: WebSocketMessage) => void;
type StateListener = (state: ConnectionState) => void;

export class WebSocketClient {
  private socket: WebSocket | null = null;
  private messageListeners = new Set<MessageListener>();
  private stateListeners = new Set<StateListener>();
  private currentState: ConnectionState = 'OFFLINE';
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | undefined;
  private heartbeat: ReturnType<typeof setInterval> | undefined;

  connect(): void {
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) return;
    clearTimeout(this.reconnectTimeout);
    this.setState('RECONNECTING');

    try {
      const socket = new WebSocket(ENV.WS_URL);
      this.socket = socket;
      socket.onopen = () => {
        if (this.socket !== socket) return;
        this.reconnectAttempts = 0;
        this.setState('LIVE');
        clearInterval(this.heartbeat);
        this.heartbeat = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) socket.send('ping');
        }, 15000);
      };
      socket.onmessage = (event) => {
        if (this.socket !== socket || event.data === 'pong') return;
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          if (message.type === 'initial_state' || message.type === 'telemetry_batch') {
            this.messageListeners.forEach((listener) => listener(message));
          }
        } catch (error) {
          console.error('Mensaje WebSocket inválido:', error);
        }
      };
      socket.onerror = () => socket.close();
      socket.onclose = () => {
        if (this.socket !== socket) return;
        this.socket = null;
        clearInterval(this.heartbeat);
        this.scheduleReconnect();
      };
    } catch {
      this.socket = null;
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    clearTimeout(this.reconnectTimeout);
    clearInterval(this.heartbeat);
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    this.reconnectAttempts = 0;
    this.setState('OFFLINE');
  }

  subscribe(listener: MessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onStateChange(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.currentState);
    return () => this.stateListeners.delete(listener);
  }

  getState(): ConnectionState {
    return this.currentState;
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= 50) {
      this.setState('OFFLINE');
      return;
    }
    this.setState('RECONNECTING');
    const delay = Math.min(1000 * 1.5 ** this.reconnectAttempts++, 5000);
    clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => this.connect(), delay);
  }

  private setState(state: ConnectionState): void {
    this.currentState = state;
    this.stateListeners.forEach((listener) => listener(state));
  }
}

export const wsClient = new WebSocketClient();
