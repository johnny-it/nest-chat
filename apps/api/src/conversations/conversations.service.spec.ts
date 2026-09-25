import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../database/prisma.service';
import type { RealtimeService } from '../realtime/realtime.service';
import { ConversationsService } from './conversations.service';

describe('ConversationsService', () => {
  it('скрывает диалог только для текущего участника', async () => {
    let clearedAt: Date | null = null;
    const prisma = {
      conversationParticipant: {
        updateMany: vi.fn().mockImplementation(({ data }) => {
          clearedAt = data.clearedAt;
          return Promise.resolve({ count: 1 });
        }),
      },
    } as unknown as PrismaService;
    const service = new ConversationsService(prisma, {} as RealtimeService);

    await service.removeForUser('conversation-id', 'user-id');

    expect(clearedAt).toBeInstanceOf(Date);
  });

  it('возвращает 404 при удалении чужого диалога', async () => {
    const prisma = {
      conversationParticipant: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    } as unknown as PrismaService;
    const service = new ConversationsService(prisma, {} as RealtimeService);

    await expect(service.removeForUser('conversation-id', 'user-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('не показывает диалог, обновлённый до его удаления пользователем', async () => {
    const clearedAt = new Date('2026-09-25T10:00:00.000Z');
    const prisma = {
      conversation: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'conversation-id',
            directKey: 'first:second',
            createdAt: new Date('2026-09-25T08:00:00.000Z'),
            updatedAt: new Date('2026-09-25T09:00:00.000Z'),
            participants: [
              { userId: 'user-id', clearedAt, user: { id: 'user-id' } },
              {
                userId: 'peer-id',
                clearedAt: null,
                user: {
                  id: 'peer-id',
                  username: 'max',
                  displayName: 'Максим',
                  avatarPath: null,
                  lastSeenAt: null,
                },
              },
            ],
            messages: [],
          },
        ]),
      },
    } as unknown as PrismaService;
    const realtime = { isUserOnline: vi.fn().mockReturnValue(false) } as unknown as RealtimeService;
    const service = new ConversationsService(prisma, realtime);

    await expect(service.list('user-id')).resolves.toEqual([]);
  });
});
