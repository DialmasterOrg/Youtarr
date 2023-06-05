// src/contexts/WebSocketContext.ts
import React from 'react';

type WebSocketContextType = {
  socket: WebSocket | null;
  subscribe: (filter: (message: any) => boolean, callback: (data: any) => void) => void;
  unsubscribe: (callback: (data: any) => void) => void;
};

const WebSocketContext = React.createContext<WebSocketContextType | null>(null);

export interface Message {
  destination: string;
  source: string;
  type: string;
  payload: any;
}

export default WebSocketContext;