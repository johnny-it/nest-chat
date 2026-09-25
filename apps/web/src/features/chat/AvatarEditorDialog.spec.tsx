import { useEffect } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Area } from 'react-easy-crop';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../../state/auth-store';
import { AvatarEditorDialog } from './AvatarEditorDialog';

vi.mock('react-easy-crop', () => ({
  default: ({ onCropComplete }: { onCropComplete: (area: Area, pixels: Area) => void }) => {
    useEffect(() => {
      const area = { x: 0, y: 0, width: 300, height: 300 };
      onCropComplete(area, area);
    }, [onCropComplete]);
    return <div aria-label="Область обрезки" />;
  },
}));

vi.mock('./avatar-image', () => ({
  createCroppedAvatar: vi.fn(() =>
    Promise.resolve(new File(['avatar'], 'avatar.jpg', { type: 'image/jpeg' })),
  ),
}));

describe('Редактор аватара', () => {
  const user = {
    id: '10000000-0000-4000-8000-000000000001',
    username: 'anna',
    displayName: 'Анна',
    avatarUrl: null,
    lastSeenAt: null,
  };

  beforeEach(() => {
    useAuthStore.getState().setAuth({ accessToken: 'test-token', user });
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:selected-avatar'),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ...user,
            avatarUrl: `/files/avatar/${user.id}?v=avatar.jpg`,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useAuthStore.getState().clear();
  });

  it('обрезает выбранное изображение, загружает его и обновляет пользователя', async () => {
    const onOpenChange = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AvatarEditorDialog open user={user} onOpenChange={onOpenChange} />
      </QueryClientProvider>,
    );
    const file = new File(['source'], 'source.png', { type: 'image/png' });

    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    });

    expect(screen.getByRole('slider', { name: 'Масштаб' })).toBeInTheDocument();
    expect(screen.getByLabelText('Область обрезки')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить аватар' }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(useAuthStore.getState().user?.avatarUrl).toContain('avatar.jpg');
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/files/avatar',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    );
  });
});
