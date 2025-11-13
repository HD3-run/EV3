import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { getApiUrl } from '../config/api';

interface ProgressEvent {
  type: 'csv-upload-progress';
  data: {
    uploadId: string;
    progress: number;
    currentItem: string;
    totalItems: number;
    processedItems: number;
    errors: string[];
    completed: boolean;
    successMessage?: string;
  };
}

interface WebSocketContextType {
  isConnected: boolean;
  lastMessage: string | null;
  socket: Socket | null;
  sendMessage: (message: string) => void;
  onProgressEvent: (callback: (event: ProgressEvent) => void) => void;
  offProgressEvent: (callback: (event: ProgressEvent) => void) => void;
  ensureConnection: () => void;
  checkWebSocketServerStatus: () => Promise<any>;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

interface WebSocketProviderProps {
  children: ReactNode;
  url: string;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children, url }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const socket = useRef<Socket | null>(null);
  const progressCallbacks = useRef<Set<(event: ProgressEvent) => void>>(new Set());

  useEffect(() => {
    // Don't create a new connection if one already exists and is connected
    if (socket.current && socket.current.connected) {
      return;
    }
    
    // Force a new connection to ensure it's properly established
    if (socket.current) {
      socket.current.disconnect();
    }
    
    // Initialize Socket.IO connection
    socket.current = io(url, {
      transports: ['polling', 'websocket'], // Try polling first, then websocket
      upgrade: true,
      rememberUpgrade: true,
      timeout: 30000, // 30 second timeout
      forceNew: true, // Force a new connection to ensure proper registration
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10 // More reconnection attempts
    });

    // Expose socket to window for backward compatibility with existing hooks
    (window as any).io = socket.current;

    socket.current.on('connect', () => {
      setIsConnected(true);
      
      // Send a test message to verify connection is working
      if (socket.current) {
        socket.current.emit('connection-test', {
          timestamp: new Date().toISOString(),
          clientId: socket.current.id
        });
      }
    });

    socket.current.on('disconnect', (_reason) => {
      setIsConnected(false);
    });

    socket.current.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error);
      setIsConnected(false);
    });

    socket.current.on('reconnect', (_attemptNumber) => {
      setIsConnected(true);
    });

    socket.current.on('reconnect_error', (error) => {
      console.error('Socket.IO reconnection failed:', error);
    });

    socket.current.on('reconnect_failed', () => {
      console.error('Socket.IO reconnection failed completely');
    });

    socket.current.on('welcome', (_data) => {
      // Welcome message received
    });

    socket.current.on('connection-test-response', (_data) => {
      // Connection test successful
    });

    // Listen for progress events
    socket.current.on('csv-upload-progress', (data: ProgressEvent['data']) => {
      const event: ProgressEvent = {
        type: 'csv-upload-progress',
        data
      };
      progressCallbacks.current.forEach(callback => {
        callback(event);
      });
    });

    // Listen for any message events
    socket.current.onAny((eventName, ...args) => {
      if (eventName !== 'connect' && eventName !== 'disconnect' && eventName !== 'connect_error' && eventName !== 'csv-upload-progress') {
        setLastMessage(JSON.stringify({ event: eventName, data: args }));
      }
    });

    return () => {
      socket.current?.disconnect();
    };
  }, [url]);

  const sendMessage = (message: string) => {
    if (socket.current && socket.current.connected) {
      try {
        const parsedMessage = JSON.parse(message);
        socket.current.emit(parsedMessage.event || 'message', parsedMessage.data || parsedMessage);
      } catch (error) {
        // If it's not JSON, send as a plain message
        socket.current.emit('message', message);
      }
    } else {
      console.warn('Socket.IO not connected. Message not sent:', message);
    }
  };

  const onProgressEvent = (callback: (event: ProgressEvent) => void) => {
    progressCallbacks.current.add(callback);
  };

  const offProgressEvent = (callback: (event: ProgressEvent) => void) => {
    progressCallbacks.current.delete(callback);
  };

  const ensureConnection = () => {
    if (!socket.current || !socket.current.connected) {
      if (socket.current) {
        socket.current.connect();
      } else {
        // Reinitialize connection
        socket.current = io(url, {
          transports: ['polling', 'websocket'],
          upgrade: true,
          rememberUpgrade: true,
          timeout: 30000,
          forceNew: false,
          autoConnect: true,
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionAttempts: 10
        });
      }
    }
  };

  const checkWebSocketServerStatus = async () => {
    try {
      const response = await fetch(getApiUrl('/api/websocket-status'));
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ Failed to check WebSocket server status:', error);
      return null;
    }
  };

  return (
    <WebSocketContext.Provider value={{ 
      isConnected, 
      lastMessage,
      socket: socket.current,
      sendMessage, 
      onProgressEvent, 
      offProgressEvent,
      ensureConnection,
      checkWebSocketServerStatus
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

export type { ProgressEvent };