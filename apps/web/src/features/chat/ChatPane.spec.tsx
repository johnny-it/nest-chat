import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConversationDto } from '@nestchat/contracts';
import { useAuthStore } from '../../state/auth-store';
import { ChatPane } from './ChatPane';

const conversation: ConversationDto = {
  id: crypto.randomUUID(),
  peer: {
    id: crypto.randomUUID(),
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

describe('Панель чата', () => {
  const fetchMock = vi.fn();
  const realtime = {
    connected: true,
    peerTyping: false,
    markDelivered: vi.fn(),
    setTyping: vi.fn(),
  };

  beforeEach(() => {
    useAuthStore.getState().setAuth({
      accessToken: 'token',
      user: {
        id: crypto.randomUUID(),
        username: 'anna',
        displayName: 'Анна',
        avatarUrl: null,
        lastSeenAt: null,
      },
    });
    fetchMock.mockReset();
    realtime.markDelivered.mockReset();
    realtime.setTyping.mockReset();
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [], nextCursor: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: crypto.randomUUID(),
            clientMessageId: crypto.randomUUID(),
            conversationId: conversation.id,
            authorId: useAuthStore.getState().user!.id,
            text: 'Привет!',
            replyToId: null,
            replyTo: null,
            createdAt: new Date().toISOString(),
            editedAt: null,
            deletedForAllAt: null,
            deliveryStatus: 'sent',
            attachments: [],
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    useAuthStore.getState().clear();
  });

  it('отправляет введённый текст и очищает поле ввода', async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter>
          <ChatPane conversation={conversation} onBack={() => undefined} realtime={realtime} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const input = await screen.findByPlaceholderText('Сообщение');
    await user.type(input, 'Привет!');
    await user.click(screen.getByRole('button', { name: 'Отправить' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({
      text: 'Привет!',
    });
    expect(input).toHaveValue('');
    expect(await screen.findByLabelText('Отправлено')).toBeInTheDocument();
    await user.hover(screen.getByRole('button', { name: 'Действия с сообщением' }));
    expect(await screen.findByRole('menuitem', { name: 'Ответить' })).toBeInTheDocument();
  });

  it('редактирует сообщение через поле ввода с превью исходного текста', async () => {
    const user = userEvent.setup();
    const messageId = crypto.randomUUID();
    const message = {
      id: messageId,
      clientMessageId: crypto.randomUUID(),
      conversationId: conversation.id,
      authorId: useAuthStore.getState().user!.id,
      text: 'Исходный текст',
      replyToId: null,
      replyTo: null,
      createdAt: new Date().toISOString(),
      editedAt: null,
      deletedForAllAt: null,
      deliveryStatus: 'sent',
      attachments: [],
    };
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [message], nextCursor: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...message, text: 'Обновлённый текст' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValue(
        new Response(
          JSON.stringify({ items: [{ ...message, text: 'Обновлённый текст' }], nextCursor: null }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter>
          <ChatPane conversation={conversation} onBack={() => undefined} realtime={realtime} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const originalText = await screen.findByText('Исходный текст');
    await user.hover(originalText.closest('.message-bubble')!);
    await user.hover(screen.getByRole('button', { name: 'Действия с сообщением' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Изменить' }));

    const input = screen.getByPlaceholderText('Сообщение');
    expect(screen.getByText('Редактирование')).toBeInTheDocument();
    expect(input).toHaveValue('Исходный текст');

    await user.clear(input);
    await user.type(input, 'Обновлённый текст');
    await user.click(screen.getByRole('button', { name: 'Отправить' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/messages/${messageId}`),
        expect.objectContaining({ method: 'PATCH' }),
      ),
    );
    const editRequest = fetchMock.mock.calls.find((call) => call[1]?.method === 'PATCH');
    expect(JSON.parse(String(editRequest?.[1]?.body))).toEqual({
      text: 'Обновлённый текст',
    });
    await waitFor(() => expect(screen.queryByText('Редактирование')).not.toBeInTheDocument());
    expect(input).toHaveValue('');
  });

  it('переходит к исходному сообщению и временно подсвечивает его', async () => {
    const user = userEvent.setup();
    const targetId = crypto.randomUUID();
    const peerId = conversation.peer.id;
    const targetMessage = {
      id: targetId,
      clientMessageId: crypto.randomUUID(),
      conversationId: conversation.id,
      authorId: peerId,
      text: 'Исходное сообщение',
      replyToId: null,
      replyTo: null,
      createdAt: new Date(Date.now() - 1_000).toISOString(),
      editedAt: null,
      deletedForAllAt: null,
      deliveryStatus: null,
      attachments: [],
    };
    const replyMessage = {
      ...targetMessage,
      id: crypto.randomUUID(),
      clientMessageId: crypto.randomUUID(),
      authorId: useAuthStore.getState().user!.id,
      text: 'Ответ',
      replyToId: targetId,
      replyTo: {
        id: targetId,
        authorId: peerId,
        text: targetMessage.text,
        deletedForAllAt: null,
      },
      createdAt: new Date().toISOString(),
      deliveryStatus: 'sent',
    };
    fetchMock.mockReset().mockResolvedValue(
      new Response(JSON.stringify({ items: [targetMessage, replyMessage], nextCursor: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter>
          <ChatPane conversation={conversation} onBack={() => undefined} realtime={realtime} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const reference = await screen.findByRole('button', {
      name: new RegExp(`@${conversation.peer.username}`),
    });
    await user.click(reference);

    expect(document.querySelector(`[data-message-id="${targetId}"]`)).toHaveClass(
      'reply-highlight',
    );
  });

  it('удаляет диалог через меню в шапке после подтверждения', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockReset()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [], nextCursor: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter>
          <ChatPane conversation={conversation} onBack={() => undefined} realtime={realtime} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByText('Начните общение');
    await user.click(screen.getByRole('button', { name: 'Меню диалога' }));
    await user.click(screen.getByRole('menuitem', { name: 'Удалить диалог' }));

    expect(screen.getByRole('dialog', { name: 'Удалить диалог?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Удалить' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/conversations/${conversation.id}`),
        expect.objectContaining({ method: 'DELETE' }),
      ),
    );
  });
});
