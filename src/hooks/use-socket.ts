'use client';

import { useEffect, useRef, useCallback } from 'react';

export function useSocket() {
  const socketRef = useRef<any>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    
    let socket: any = null;
    import('socket.io-client').then(({ io }) => {
      socket = io('/?XTransformPort=3003', {
        transports: ['websocket', 'polling'],
      });
      socketRef.current = socket;
      socket.on('connect', () => console.log('[Socket] Connected'));
      socket.on('disconnect', () => console.log('[Socket] Disconnected'));
    }).catch(() => {
      console.warn('[Socket] Could not connect to WebSocket service');
    });

    return () => {
      socket?.disconnect();
    };
  }, []);

  const joinGroup = useCallback((groupId: string) => {
    socketRef.current?.emit('join-group', groupId);
  }, []);

  const leaveGroup = useCallback((groupId: string) => {
    socketRef.current?.emit('leave-group', groupId);
  }, []);

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    socketRef.current?.on(event, handler);
    return () => {
      socketRef.current?.off(event, handler);
    };
  }, []);

  const emit = useCallback((event: string, data: any) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { joinGroup, leaveGroup, on, emit };
}