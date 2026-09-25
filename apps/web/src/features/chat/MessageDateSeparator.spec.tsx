import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConversationDto, MessageDto } from '@nestchat/contracts';
import { useAuthStore } from '../../state/auth-store';
import '../../styles/global.css';
import { ChatPane } from './ChatPane';

describe('Разделитель дат сообщений', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    useAuthStore.getState().clear();
  });

  it('ограничивает плавающие разделители отдельными группами дат', async () => {
    const userId = crypto.randomUUID();
    const peerId = crypto.randomUUID();
    const conversation: ConversationDto = {
      id: crypto.randomUUID(),
      peer: {
        id: peerId,
        username: 'max',
        displayName: 'Максим Кузнецов',
        avatarUrl: null,
        lastSeenAt: null,
        online: true,
      },
      lastMessage: null,
      unreadCount: 0,
      updatedAt: new Date().toISOString(),
    };
    const todayMessage: MessageDto = {
      id: crypto.randomUUID(),
      clientMessageId: crypto.randomUUID(),
      conversationId: conversation.id,
      authorId: peerId,
      text: 'Сообщение за сегодня',
      replyToId: null,
      replyTo: null,
      createdAt: new Date().toISOString(),
      editedAt: null,
      deletedForAllAt: null,
      deliveryStatus: null,
      attachments: [],
    };
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayMessage: MessageDto = {
      ...todayMessage,
      id: crypto.randomUUID(),
      clientMessageId: crypto.randomUUID(),
      text: 'Сообщение за вчера',
      createdAt: yesterday.toISOString(),
    };
    useAuthStore.getState().setAuth({
      accessToken: 'token',
      user: {
        id: userId,
        username: 'anna',
        displayName: 'Анна',
        avatarUrl: null,
        lastSeenAt: null,
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ items: [yesterdayMessage, todayMessage], nextCursor: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter>
          <ChatPane
            conversation={conversation}
            onBack={() => undefined}
            realtime={{
              connected: true,
              peerTyping: false,
              markDelivered: vi.fn(),
              setTyping: vi.fn(),
            }}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const yesterdaySeparator = await screen.findByRole('separator', { name: 'Вчера' });
    const todaySeparator = screen.getByRole('separator', { name: 'Сегодня' });
    const yesterdayGroup = yesterdaySeparator.closest('.message-date-group');
    const todayGroup = todaySeparator.closest('.message-date-group');

    expect(yesterdayGroup).not.toBeNull();
    expect(todayGroup).not.toBeNull();
    expect(yesterdayGroup).not.toBe(todayGroup);
    expect(yesterdayGroup).toHaveTextContent('Сообщение за вчера');
    expect(yesterdayGroup).not.toHaveTextContent('Сообщение за сегодня');
    expect(todayGroup).toHaveTextContent('Сообщение за сегодня');
    expect(getComputedStyle(todaySeparator).position).toBe('sticky');
    expect(getComputedStyle(todaySeparator).top).toBe('0px');
  });
});
