import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../../state/auth-store';
import { ChatPage } from './ChatPage';

describe('Страница чатов', () => {
  beforeEach(() => {
    useAuthStore.getState().setAuth({
      accessToken: 'test-token',
      user: {
        id: crypto.randomUUID(),
        username: 'anna',
        displayName: 'Анна',
        avatarUrl: null,
        lastSeenAt: null,
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            {
              id: crypto.randomUUID(),
              peer: {
                id: crypto.randomUUID(),
                username: 'max',
                displayName: 'Максим Кузнецов',
                avatarUrl: null,
                lastSeenAt: null,
              },
              lastMessage: null,
              unreadCount: 0,
              updatedAt: new Date().toISOString(),
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    useAuthStore.getState().clear();
  });

  it('показывает список диалогов и подсказку при отсутствии выбранного чата', async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/chat']}>
          <Routes>
            <Route path="/chat/:conversationId?" element={<ChatPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Максим Кузнецов')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Чаты' })).toBeInTheDocument();
    expect(screen.getByText('@anna')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Поиск')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Новый чат' })).toBeInTheDocument();
    expect(screen.getByText('Выберите чат, чтобы начать общение')).toBeInTheDocument();
  });

  it('открывает редактор аватара по клику на аватар текущего пользователя', async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/chat']}>
          <Routes>
            <Route path="/chat/:conversationId?" element={<ChatPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByText('Максим Кузнецов');
    fireEvent.click(screen.getByRole('button', { name: 'Изменить аватар' }));

    expect(screen.getByRole('heading', { name: 'Аватар профиля' })).toBeInTheDocument();
    expect(screen.getByText('Выберите изображение для аватара')).toBeInTheDocument();
  });

  it('показывает ранее загруженный аватар в редакторе', async () => {
    useAuthStore.getState().setAuth({
      accessToken: 'test-token',
      user: {
        id: '10000000-0000-4000-8000-000000000001',
        username: 'anna',
        displayName: 'Анна',
        avatarUrl:
          '/files/avatar/10000000-0000-4000-8000-000000000001?v=avatar.png',
        lastSeenAt: null,
      },
    });
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/chat']}>
          <Routes>
            <Route path="/chat/:conversationId?" element={<ChatPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByText('Максим Кузнецов');
    fireEvent.click(screen.getByRole('button', { name: 'Изменить аватар' }));

    expect(document.querySelector('.avatar-editor-dialog img')).toHaveAttribute(
      'src',
      'http://localhost:3000/api/files/avatar/10000000-0000-4000-8000-000000000001?v=avatar.png',
    );
  });
});
