import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../database/prisma.service';
import { FilesService } from './files.service';

describe('FilesService', () => {
  let uploadDir: string | undefined;

  afterEach(async () => {
    if (uploadDir) await rm(uploadDir, { recursive: true, force: true });
    uploadDir = undefined;
  });

  it('возвращает 404, если запись вложения есть, а файл отсутствует в хранилище', async () => {
    uploadDir = await mkdtemp(path.join(tmpdir(), 'nestchat-files-'));
    const prisma = {
      attachment: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'attachment-id',
          uploaderId: 'user-id',
          conversationId: 'conversation-id',
          storageKey: 'missing.jpg',
          originalName: 'image.jpg',
          mimeType: 'image/jpeg',
          status: 'ATTACHED',
        }),
      },
      conversationParticipant: {
        findUnique: vi.fn().mockResolvedValue({
          conversationId: 'conversation-id',
          userId: 'user-id',
        }),
      },
    } as unknown as PrismaService;
    const service = new FilesService(
      prisma,
      new ConfigService({ UPLOAD_DIR: uploadDir }),
    );

    await expect(service.open('user-id', 'attachment-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('сохраняет новый аватар и удаляет предыдущий файл', async () => {
    uploadDir = await mkdtemp(path.join(tmpdir(), 'nestchat-avatars-'));
    await writeFile(path.join(uploadDir, 'old.png'), Buffer.from('old avatar'));
    const update = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'user-id',
        username: 'anna',
        displayName: 'Анна',
        avatarPath: data.avatarPath,
        lastSeenAt: null,
      }),
    );
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ avatarPath: 'old.png' }),
        update,
      },
    } as unknown as PrismaService;
    const service = new FilesService(
      prisma,
      new ConfigService({ UPLOAD_DIR: uploadDir }),
    );
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const user = await service.uploadAvatar('user-id', {
      fieldname: 'avatar',
      originalname: 'avatar.png',
      encoding: '7bit',
      mimetype: 'image/png',
      size: buffer.length,
      buffer,
      destination: '',
      filename: '',
      path: '',
      stream: undefined as never,
    });

    const avatarPath = update.mock.calls[0]?.[0].data.avatarPath as string;
    expect(user.avatarUrl).toContain(`/files/avatar/user-id?v=${avatarPath}`);
    expect(await readFile(path.join(uploadDir, avatarPath))).toEqual(buffer);
    await expect(access(path.join(uploadDir, 'old.png'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('отклоняет аватар размером больше 5 МБ', async () => {
    uploadDir = await mkdtemp(path.join(tmpdir(), 'nestchat-avatars-'));
    const service = new FilesService(
      { user: {} } as unknown as PrismaService,
      new ConfigService({ UPLOAD_DIR: uploadDir }),
    );

    await expect(
      service.uploadAvatar('user-id', {
        fieldname: 'avatar',
        originalname: 'avatar.png',
        encoding: '7bit',
        mimetype: 'image/png',
        size: 5 * 1024 * 1024 + 1,
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        destination: '',
        filename: '',
        path: '',
        stream: undefined as never,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('отклоняет неподдерживаемый формат аватара как некорректный запрос', async () => {
    uploadDir = await mkdtemp(path.join(tmpdir(), 'nestchat-avatars-'));
    const service = new FilesService(
      { user: {} } as unknown as PrismaService,
      new ConfigService({ UPLOAD_DIR: uploadDir }),
    );

    await expect(
      service.uploadAvatar('user-id', {
        fieldname: 'avatar',
        originalname: 'avatar.exe',
        encoding: '7bit',
        mimetype: 'application/octet-stream',
        size: 4,
        buffer: Buffer.from('MZ00'),
        destination: '',
        filename: '',
        path: '',
        stream: undefined as never,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('открывает сохранённый аватар для чтения', async () => {
    uploadDir = await mkdtemp(path.join(tmpdir(), 'nestchat-avatars-'));
    await writeFile(path.join(uploadDir, 'avatar.webp'), Buffer.from('avatar'));
    const service = new FilesService(
      {
        user: {
          findUnique: vi.fn().mockResolvedValue({ avatarPath: 'avatar.webp' }),
        },
      } as unknown as PrismaService,
      new ConfigService({ UPLOAD_DIR: uploadDir }),
    );

    const avatar = await service.openAvatar('user-id');

    expect(avatar.mimeType).toBe('image/webp');
    expect(avatar.stream).toBeDefined();
    avatar.stream.destroy();
  });
});
