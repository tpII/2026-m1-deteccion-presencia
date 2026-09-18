import React from 'react';
import { ConnectionState } from '../../types/telemetry';
import { StatusBadge } from '../common/StatusBadge';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

interface ConnectionStatusProps {
  state: ConnectionState;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ state }) => {
  if (state === 'LIVE') {
    return (
      <StatusBadge
        label="SISTEMA EN VIVO"
        variant="live"
        pulsing={true}
        icon={<Wifi size={14} />}
      />
    );
  }

  if (state === 'RECONNECTING') {
    return (
      <StatusBadge
        label="RECONECTANDO..."
        variant="warning"
        pulsing={true}
        icon={<RefreshCw size={14} className="spin-icon" />}
      />
    );
  }

  return (
    <StatusBadge
      label="OFFLINE"
      variant="error"
      pulsing={false}
      icon={<WifiOff size={14} />}
    />
  );
};
