import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttachmentDto } from '@nestchat/contracts';
import { AttachmentView } from './AttachmentView';

const attachment: AttachmentDto = {
  id: crypto.randomUUID(),
  originalName: 'лето.jpg',
  mimeType: 'image/jpeg',
  size: 2048,
  url: `/api/files/${crypto.randomUUID()}`,
  kind: 'image',
};

describe('Просмотр изображения во вложении', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(new Blob(['image']), { status: 200 })),
    );
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:test-image'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('открывает изображение в модальном окне и закрывает его', async () => {
    const user = userEvent.setup();
    render(<AttachmentView attachment={attachment} />);

    const preview = await screen.findByRole('img', { name: attachment.originalName });
    await user.click(preview);

    expect(screen.getByRole('dialog', { name: attachment.originalName })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: attachment.originalName })).toHaveClass(
      'image-dialog-preview',
    );

    await user.click(screen.getByRole('button', { name: 'Закрыть изображение' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
