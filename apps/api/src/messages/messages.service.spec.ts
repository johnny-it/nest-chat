import { describe, expect, it, vi } from 'vitest';
import type { ConversationsService } from '../conversations/conversations.service';
import type { PrismaService } from '../database/prisma.service';
import type { RealtimeService } from '../realtime/realtime.service';
import { MessagesService } from './messages.service';

describe('MessagesService', () => {
  it('не возвращает сообщения, отправленные до удаления диалога пользователем', async () => {
    const clearedAt = new Date('2026-09-25T10:00:00.000Z');
    const oldMessage = {
      id: 'old-message',
      clientMessageId: 'old-client-message',
      conversationId: 'conversation-id',
      authorId: 'peer-id',
      text: 'Старое сообщение',
      replyToId: null,
      createdAt: new Date('2026-09-25T09:00:00.000Z'),
      editedAt: null,
      deletedForAllAt: null,
      attachments: [],
      replyTo: null,
    };
    const newMessage = {
      ...oldMessage,
      id: 'new-message',
      clientMessageId: 'new-client-message',
      text: 'Новое сообщение',
      createdAt: new Date('2026-09-25T11:00:00.000Z'),
    };
    const prisma = {
      conversationParticipant: {
        findUnique: vi.fn().mockResolvedValue({ clearedAt }),
        findFirst: vi.fn().mockResolvedValue({
          lastDeliveredMessageId: null,
          lastReadMessageId: null,
        }),
      },
      message: {
        findMany: vi.fn().mockImplementation(({ where }) => {
          if (where.id) return Promise.resolve([]);
          const boundary = where.createdAt?.gt as Date | undefined;
          return Promise.resolve(
            [newMessage, oldMessage].filter(
              (message) => !boundary || message.createdAt.getTime() > boundary.getTime(),
            ),
          );
        }),
      },
    } as unknown as PrismaService;
    const conversations = {
      assertParticipant: vi.fn().mockResolvedValue(undefined),
    } as unknown as ConversationsService;
    const service = new MessagesService(prisma, conversations, {} as RealtimeService);

    const page = await service.history('user-id', 'conversation-id', { limit: 50 });

    expect(page.items.map((message) => message.id)).toEqual(['new-message']);
  });
});
