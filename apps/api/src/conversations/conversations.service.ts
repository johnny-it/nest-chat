import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ConversationDto } from '@nestchat/contracts';
import { PrismaService } from '../database/prisma.service';
import { buildDirectKey } from '../domain/chat-rules';
import { toMessageDto, toUserDto } from '../common/dto-mappers';
import { RealtimeService } from '../realtime/realtime.service';

const conversationInclude = {
  participants: { include: { user: true } },
  messages: {
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
    take: 1,
    include: {
      attachments: true,
      replyTo: { select: { id: true, authorId: true, text: true, deletedForAllAt: true } },
    },
  },
};

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async createDirect(actorId: string, peerId: string): Promise<ConversationDto> {
    if (actorId === peerId) throw new BadRequestException('Нельзя создать диалог с собой');
    const peer = await this.prisma.user.findUnique({ where: { id: peerId } });
    if (!peer) throw new NotFoundException('Пользователь не найден');
    const directKey = buildDirectKey(actorId, peerId);
    const conversation = await this.prisma.conversation.upsert({
      where: { directKey },
      create: {
        directKey,
        participants: { create: [{ userId: actorId }, { userId: peerId }] },
      },
      update: { updatedAt: new Date() },
      include: conversationInclude,
    });
    this.realtime.joinUsersToConversation([actorId, peerId], conversation.id);
    for (const userId of [actorId, peerId]) {
      this.realtime.toUser(userId, {
        version: 1,
        eventId: randomUUID(),
        event: 'conversation.created',
        data: { conversationId: conversation.id },
      });
    }
    return this.toDto(conversation, actorId, 0);
  }

  async list(actorId: string): Promise<ConversationDto[]> {
    const conversations = await this.prisma.conversation.findMany({
      where: { participants: { some: { userId: actorId } } },
      orderBy: { updatedAt: 'desc' },
      include: conversationInclude,
    });
    const visibleConversations = conversations.filter((conversation) => {
      const participant = conversation.participants.find((entry) => entry.userId === actorId);
      return !participant?.clearedAt || conversation.updatedAt > participant.clearedAt;
    });
    return Promise.all(
      visibleConversations.map(async (conversation) => {
        const participant = conversation.participants.find((entry) => entry.userId === actorId);
        const lastRead = participant?.lastReadMessageId
          ? await this.prisma.message.findUnique({ where: { id: participant.lastReadMessageId } })
          : null;
        const unreadBoundary = [participant?.clearedAt, lastRead?.createdAt]
          .filter((value): value is Date => Boolean(value))
          .reduce<Date | null>(
            (latest, value) => (!latest || value > latest ? value : latest),
            null,
          );
        const unreadCount = await this.prisma.message.count({
          where: {
            conversationId: conversation.id,
            authorId: { not: actorId },
            ...(unreadBoundary ? { createdAt: { gt: unreadBoundary } } : {}),
            deletedForAllAt: null,
          },
        });
        return this.toDto(conversation, actorId, unreadCount);
      }),
    );
  }

  /**
   * Скрывает диалог и очищает его текущую историю для одного участника.
   *
   * @param conversationId - Идентификатор диалога.
   * @param userId - Идентификатор участника.
   */
  async removeForUser(conversationId: string, userId: string): Promise<void> {
    const result = await this.prisma.conversationParticipant.updateMany({
      where: { conversationId, userId },
      data: { clearedAt: new Date() },
    });
    if (!result.count) throw new NotFoundException('Диалог не найден');
  }

  async assertParticipant(conversationId: string, userId: string): Promise<void> {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) throw new NotFoundException('Диалог не найден');
  }

  private toDto(conversation: any, actorId: string, unreadCount: number): ConversationDto {
    const peer = conversation.participants.find((entry: any) => entry.userId !== actorId)?.user;
    if (!peer) throw new NotFoundException('Собеседник не найден');
    return {
      id: conversation.id,
      peer: { ...toUserDto(peer), online: this.realtime.isUserOnline(peer.id) },
      lastMessage: conversation.messages[0] ? toMessageDto(conversation.messages[0]) : null,
      unreadCount,
      updatedAt: conversation.updatedAt.toISOString(),
    };
  }
}
