import { useEffect, useRef, useState, useCallback } from 'react';
import axios from '@/utils/axiosInstance';

interface WebSocketMessage {
  type: string;
  data?: any;
  message?: string;
}

interface UseWebSocketOptions {
  url: string;
  token: string;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  onTokenExpired?: () => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export const useWebSocket = ({
  url,
  token,
  onMessage,
  onConnect,
  onDisconnect,
  onError,
  onTokenExpired,
  reconnectInterval = 5000,
  maxReconnectAttempts = 5
}: UseWebSocketOptions) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const shouldReconnectRef = useRef(true);
  const tokenRef = useRef(token);
  const urlRef = useRef(url);

  // Update refs when props change
  useEffect(() => {
    tokenRef.current = token;
    urlRef.current = url;
  }, [token, url]);

  const attemptTokenRefresh = useCallback(async () => {
    try {
      const response = await axios.post('/refresh-token');
      
      if (response.data.token) {
        // Update token in localStorage
        localStorage.setItem('token', response.data.token);
        return response.data.token;
      }
    } catch (error) {
      // console.error('WebSocket: Token refresh failed:', error);
    }
    return null;
  }, []);

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const wsUrl = `${urlRef.current}?token=${encodeURIComponent(tokenRef.current)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        reconnectAttemptsRef.current = 0;
        onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          // Handle token expiration
          if (message.type === 'ERROR' && message.message?.includes('token')) {
            handleTokenExpiration();
            return;
          }
          
          onMessage?.(message);
        } catch (err) {
          // console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        setIsConnecting(false);
        onDisconnect?.();

        // Don't reconnect if token expired
        if (event.code === 1008 && event.reason?.includes('token')) {
          handleTokenExpiration();
          return;
        }

        // Attempt to reconnect if not manually closed
        if (shouldReconnectRef.current && event.code !== 1000) {
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectAttemptsRef.current++;
              connect();
            }, reconnectInterval);
          } else {
            setError('Max reconnection attempts reached');
          }
        }
      };

      ws.onerror = (event) => {
        // console.error('WebSocket: Connection error', event);
        setError('WebSocket connection error');
        onError?.(event);
      };

    } catch (err) {
      // console.error('WebSocket: Failed to create connection', err);
      setError('Failed to create WebSocket connection');
      setIsConnecting(false);
    }
  }, [onMessage, onConnect, onDisconnect, onError, onTokenExpired, reconnectInterval, maxReconnectAttempts, attemptTokenRefresh]);

  const handleTokenExpiration = useCallback(async () => {
    const newToken = await attemptTokenRefresh();
    if (newToken) {
      // Update the token ref and reconnect
      tokenRef.current = newToken;
      setTimeout(() => {
        connect();
      }, 1000);
    } else {
      // Token refresh failed, notify parent
      onTokenExpired?.();
    }
  }, [attemptTokenRefresh, connect, onTokenExpired]);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }
  }, []);

  const sendMessage = useCallback((message: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      // console.warn('WebSocket: Cannot send message - not connected');
    }
  }, []);

  const sendPing = useCallback(() => {
    sendMessage({ type: 'PING' });
  }, [sendMessage]);

  const requestStats = useCallback(() => {
    sendMessage({ type: 'REQUEST_STATS' });
  }, [sendMessage]);

  const requestUpdates = useCallback(() => {
    sendMessage({ type: 'REQUEST_UPDATES' });
  }, [sendMessage]);

  const requestFilteredStats = useCallback((filters: {
    cameraId?: number;
    categoryId?: number;
    timeRange?: '1h' | '6h' | '24h' | '7d';
  }) => {
    sendMessage({ type: 'FILTER_STATS', filters });
  }, [sendMessage]);

  // Only connect when token changes and is valid
  useEffect(() => {
    if (token && token.length > 0) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [token]); // Only depend on token, not the connect/disconnect functions

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []); // Empty dependency array for cleanup only

  return {
    isConnected,
    isConnecting,
    error,
    sendMessage,
    sendPing,
    requestStats,
    requestUpdates,
    requestFilteredStats,
    connect,
    disconnect
  };
}; 