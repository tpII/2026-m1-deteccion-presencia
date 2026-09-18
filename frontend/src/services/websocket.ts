import { ENDPOINTS } from './endpoints';
import { ConnectionState, WebSocketMessage } from '../types/telemetry';

type MessageListener = (message: WebSocketMessage) => void;
type StateListener = (state: ConnectionState) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private messageListeners: Set<MessageListener> = new Set();
  private stateListeners: Set<StateListener> = new Set();
  private currentState: ConnectionState = 'OFFLINE';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 50;
  private reconnectTimeout: any = null;
  private pingInterval: any = null;

  constructor() {
    // Inicialización bajo demanda
  }

  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setState(this.reconnectAttempts > 0 ? 'RECONNECTING' : 'OFFLINE');

    try {
      this.ws = new WebSocket(ENDPOINTS.WS_TELEMETRY);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.setState('LIVE');
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          if (event.data === 'pong') return;
          const data: WebSocketMessage = JSON.parse(event.data);
          this.notifyMessage(data);
        } catch (e) {
          console.error('Error parseando mensaje WebSocket:', e);
        }
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
        this.handleDisconnect();
      };

      this.ws.onerror = () => {
        this.stopHeartbeat();
        this.handleDisconnect();
      };
    } catch (err) {
      this.handleDisconnect();
    }
  }

  private handleDisconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.setState('RECONNECTING');
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 5000);
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      this.setState('OFFLINE');
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send('ping');
      }
    }, 15000);
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  public disconnect(): void {
    clearTimeout(this.reconnectTimeout);
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setState('OFFLINE');
  }

  public subscribe(listener: MessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  public onStateChange(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.currentState);
    return () => this.stateListeners.delete(listener);
  }

  public getState(): ConnectionState {
    return this.currentState;
  }

  private setState(state: ConnectionState): void {
    this.currentState = state;
    this.stateListeners.forEach((fn) => fn(state));
  }

  private notifyMessage(msg: WebSocketMessage): void {
    this.messageListeners.forEach((fn) => fn(msg));
  }
}

export const wsClient = new WebSocketClient();
