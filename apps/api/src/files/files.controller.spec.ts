import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import { FilesController } from './files.controller';
import type { FilesService } from './files.service';

describe('FilesController', () => {
  it('разрешает показывать аватар на веб-приложении с другого origin', async () => {
    const stream = Readable.from(Buffer.from('avatar'));
    const files = {
      openAvatar: vi.fn().mockResolvedValue({ stream, mimeType: 'image/png' }),
    } as unknown as FilesService;
    const response = {
      setHeader: vi.fn(),
    } as unknown as Response;
    const controller = new FilesController(files);

    await controller.avatar('user-id', response);

    expect(response.setHeader).toHaveBeenCalledWith(
      'Cross-Origin-Resource-Policy',
      'cross-origin',
    );
  });
});
