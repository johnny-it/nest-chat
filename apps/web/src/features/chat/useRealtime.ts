import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import type { ConversationDto, RealtimeEnvelope } from '@nestchat/contracts';
import { API_URL } from '../../lib/api';
import { useAuthStore } from '../../state/auth-store';

export interface RealtimeControls {
  connected: boolean;
  peerTyping: boolean;
  markDelivered: (messageId: string) => void;
  setTyping: (typing: boolean) => void;
}

export function useRealtime(conversationId?: string): RealtimeControls {
  const token = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const conversationIdRef = useRef(conversationId);
  const [connected, setConnected] = useState(import.meta.env.MODE === 'test');
  const [peerTyping, setPeerTyping] = useState(false);
  conversationIdRef.current = conversationId;

  useEffect(() => {
    if (!token || import.meta.env.MODE === 'test') return;
    const socket = io(API_URL, { auth: { token }, transports: ['websocket'] });
    socketRef.current = socket;
    socket.on('event', (envelope: RealtimeEnvelope) => {
      const activeConversationId = conversationIdRef.current;
      if (envelope.event === 'conversation.created') {
        void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      }
      if (envelope.event === 'presence.changed') {
        queryClient.setQueryData<ConversationDto[]>(['conversations'], (conversations) =>
          conversations?.map((conversation) =>
            conversation.peer.id === envelope.data.userId
              ? {
                  ...conversation,
                  peer: {
                    ...conversation.peer,
                    online: envelope.data.online,
                    lastSeenAt: envelope.data.lastSeenAt,
                  },
                }
              : conversation,
          ),
        );
      }
      if (envelope.event.startsWith('message.') && 'conversationId' in envelope.data) {
        if (activeConversationId && envelope.data.conversationId === activeConversationId) {
          void queryClient.invalidateQueries({ queryKey: ['messages', activeConversationId] });
        }
        void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      }
      if (envelope.event === 'conversation.read' || envelope.event === 'conversation.delivered') {
        if (activeConversationId && envelope.data.conversationId === activeConversationId) {
          void queryClient.invalidateQueries({ queryKey: ['messages', activeConversationId] });
        }
        void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      }
    });
    socket.on('connect', () => {
      setConnected(true);
      const activeConversationId = conversationIdRef.current;
      if (activeConversationId) {
        void queryClient.invalidateQueries({ queryKey: ['messages', activeConversationId] });
      }
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('typing', (event: { conversationId: string; typing: boolean }) => {
      if (event.conversationId === conversationIdRef.current) setPeerTyping(event.typing);
    });
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [queryClient, token]);

  useEffect(() => {
    setPeerTyping(false);
  }, [conversationId]);

  const markDelivered = useCallback((messageId: string) => {
    const activeConversationId = conversationIdRef.current;
    if (activeConversationId) {
      socketRef.current?.emit('message.delivered', {
        conversationId: activeConversationId,
        messageId,
      });
    }
  }, []);

  const setTyping = useCallback((typing: boolean) => {
    const activeConversationId = conversationIdRef.current;
    if (activeConversationId) {
      socketRef.current?.emit(typing ? 'typing.start' : 'typing.stop', {
        conversationId: activeConversationId,
      });
    }
  }, []);

  return {
    connected,
    peerTyping,
    markDelivered,
    setTyping,
  };
}
