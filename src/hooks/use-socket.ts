'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;
    socket.on('connect', () => console.log('[Socket] Connected'));
    socket.on('disconnect', () => console.log('[Socket] Disconnected'));
    return () => {
      socket.disconnect();
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

  return { socket: socketRef.current, joinGroup, leaveGroup, on, emit };
}