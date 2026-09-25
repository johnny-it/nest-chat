import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewChatDialog } from './NewChatDialog';

describe('Окно создания нового чата', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ items: [], nextCursor: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('отправляет запрос через 300 мс после последнего изменения строки поиска', async () => {
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter>
          <NewChatDialog open onOpenChange={vi.fn()} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const input = screen.getByPlaceholderText('Username');
    fireEvent.change(input, { target: { value: 'an' } });

    await act(() => vi.advanceTimersByTimeAsync(299));
    expect(fetch).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: 'anna' } });
    await act(() => vi.advanceTimersByTimeAsync(299));
    expect(fetch).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/users/search?q=anna',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('сохраняет предыдущие результаты до завершения нового поиска', async () => {
    let resolveUpdatedSearch: ((response: Response) => void) | undefined;
    vi.mocked(fetch).mockImplementation((input) => {
      if (String(input).endsWith('q=te')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [
                {
                  id: '10000000-0000-4000-8000-000000000001',
                  username: 'tester',
                  displayName: 'Тестовый пользователь',
                  avatarUrl: null,
                  lastSeenAt: null,
                },
              ],
              nextCursor: null,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }

      return new Promise<Response>((resolve) => {
        resolveUpdatedSearch = resolve;
      });
    });

    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter>
          <NewChatDialog open onOpenChange={vi.fn()} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const input = screen.getByPlaceholderText('Username');
    fireEvent.change(input, { target: { value: 'te' } });
    await act(() => vi.advanceTimersByTimeAsync(300));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(screen.getByText('Тестовый пользователь')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'tes' } });
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(screen.getByText('Тестовый пользователь')).toBeInTheDocument();

    await act(async () => {
      resolveUpdatedSearch?.(
        new Response(
          JSON.stringify({
            items: [
              {
                id: '10000000-0000-4000-8000-000000000002',
                username: 'tesla',
                displayName: 'Новый результат',
                avatarUrl: null,
                lastSeenAt: null,
              },
            ],
            nextCursor: null,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    });
    await act(() => vi.advanceTimersByTimeAsync(0));

    expect(screen.queryByText('Тестовый пользователь')).not.toBeInTheDocument();
    expect(screen.getByText('Новый результат')).toBeInTheDocument();
  });
});
