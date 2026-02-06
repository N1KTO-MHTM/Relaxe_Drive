import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || '';

export function useSocket() {
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!WS_URL) return;
    const token = localStorage.getItem('relaxdrive-access-token');
    const s = io(WS_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });
    setSocket(s);
    s.on('connect', () => {
      setConnected(true);
      setReconnecting(false);
    });
    s.on('disconnect', (reason) => {
      setConnected(false);
      const isIntentional = reason === 'io server disconnect' || reason === 'io client disconnect';
      setReconnecting(!isIntentional);
    });
    return () => {
      s.disconnect();
      setSocket(null);
      setConnected(false);
      setReconnecting(false);
    };
  }, []);

  return { socket, connected, reconnecting };
}
