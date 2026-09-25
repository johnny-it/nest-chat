import { randomUUID } from 'node:crypto';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateMessageInput,
  CursorPage,
  MessageDto,
  RealtimeEnvelope,
} from '@nestchat/contracts';
import { PrismaService } from '../database/prisma.service';
import { canDeleteForEveryone, canEditMessage } from '../domain/chat-rules';
import { toMessageDto } from '../common/dto-mappers';
import { ConversationsService } from '../conversations/conversations.service';
import { RealtimeService } from '../realtime/realtime.service';

const messageInclude = {
  attachments: true,
  replyTo: { select: { id: true, authorId: true, text: true, deletedForAllAt: true } },
};

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversations: ConversationsService,
    private readonly realtime: RealtimeService,
  ) {}

  async history(
    actorId: string,
    conversationId: string,
    query: { cursor?: string | undefined; limit: number },
  ): Promise<CursorPage<MessageDto>> {
    await this.conversations.assertParticipant(conversationId, actorId);
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId: actorId } },
      select: { clearedAt: true },
    });
    const peer = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId, userId: { not: actorId } },
      select: { lastDeliveredMessageId: true, lastReadMessageId: true },
    });
    const markerIds = [peer?.lastDeliveredMessageId, peer?.lastReadMessageId].filter(
      (id): id is string => Boolean(id),
    );
    const markers = await this.prisma.message.findMany({
      where: { id: { in: markerIds } },
      select: { id: true, createdAt: true },
    });
    const deliveredMarker = markers.find((message) => message.id === peer?.lastDeliveredMessageId);
    const readMarker = markers.find((message) => message.id === peer?.lastReadMessageId);
    const take = query.limit + 1;
    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        hiddenFor: { none: { userId: actorId } },
        ...(participant?.clearedAt ? { createdAt: { gt: participant.clearedAt } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take,
      include: messageInclude,
    });
    const hasMore = messages.length === take;
    const page = hasMore ? messages.slice(0, -1) : messages;
    return {
      items: page
        .map((message) =>
          toMessageDto(message, this.deliveryStatus(message, actorId, deliveredMarker, readMarker)),
        )
        .reverse(),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async create(
    actorId: string,
    conversationId: string,
    input: CreateMessageInput,
  ): Promise<MessageDto> {
    await this.conversations.assertParticipant(conversationId, actorId);
    const existing = await this.prisma.message.findUnique({
      where: {
        authorId_clientMessageId: { authorId: actorId, clientMessageId: input.clientMessageId },
      },
      include: messageInclude,
    });
    if (existing) return toMessageDto(existing, 'sent');

    if (input.replyToId) {
      const reply = await this.prisma.message.findFirst({
        where: { id: input.replyToId, conversationId },
      });
      if (!reply) throw new NotFoundException('Сообщение для ответа не найдено');
    }

    const attachmentIds = input.attachmentIds ?? [];
    if (attachmentIds.length) {
      const count = await this.prisma.attachment.count({
        where: { id: { in: attachmentIds }, uploaderId: actorId, status: 'PENDING' },
      });
      if (count !== attachmentIds.length) throw new ForbiddenException('Недоступное вложение');
    }

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          conversationId,
          authorId: actorId,
          clientMessageId: input.clientMessageId,
          text: input.text || null,
          replyToId: input.replyToId ?? null,
        },
      });
      if (attachmentIds.length) {
        await tx.attachment.updateMany({
          where: { id: { in: attachmentIds }, uploaderId: actorId, status: 'PENDING' },
          data: { conversationId, messageId: created.id, status: 'ATTACHED', expiresAt: null },
        });
      }
      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
      return tx.message.findUniqueOrThrow({ where: { id: created.id }, include: messageInclude });
    });
    const dto = toMessageDto(message, 'sent');
    this.emit(conversationId, 'message.created', dto);
    return dto;
  }

  async edit(actorId: string, messageId: string, text: string): Promise<MessageDto> {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Сообщение не найдено');
    if (!canEditMessage(message, actorId))
      throw new ForbiddenException('Нельзя изменить сообщение');
    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { text, editedAt: new Date() },
      include: messageInclude,
    });
    const dto = toMessageDto(updated);
    this.emit(message.conversationId, 'message.updated', dto);
    return dto;
  }

  async remove(actorId: string, messageId: string, scope: 'self' | 'everyone'): Promise<void> {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Сообщение не найдено');
    await this.conversations.assertParticipant(message.conversationId, actorId);
    if (scope === 'self') {
      await this.prisma.hiddenMessage.upsert({
        where: { messageId_userId: { messageId, userId: actorId } },
        create: { messageId, userId: actorId },
        update: {},
      });
      return;
    }
    if (!canDeleteForEveryone(message, actorId)) {
      throw new ForbiddenException('Удалить сообщение у обоих может только автор');
    }
    await this.prisma.message.update({
      where: { id: messageId },
      data: { text: null, deletedForAllAt: new Date() },
    });
    this.emit(message.conversationId, 'message.deleted', {
      messageId,
      conversationId: message.conversationId,
    });
  }

  async markRead(actorId: string, conversationId: string, messageId: string): Promise<void> {
    await this.conversations.assertParticipant(conversationId, actorId);
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, conversationId },
    });
    if (!message) throw new NotFoundException('Сообщение не найдено');
    const participant = await this.prisma.conversationParticipant.findUniqueOrThrow({
      where: { conversationId_userId: { conversationId, userId: actorId } },
    });
    if (participant.lastReadMessageId) {
      const lastRead = await this.prisma.message.findUnique({
        where: { id: participant.lastReadMessageId },
        select: { id: true, createdAt: true },
      });
      if (lastRead && !this.isAfter(message, lastRead)) return;
    }
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: actorId } },
      data: { lastReadMessageId: messageId, lastDeliveredMessageId: messageId },
    });
    this.emit(conversationId, 'conversation.read', { conversationId, userId: actorId, messageId });
  }

  private emit(conversationId: string, event: RealtimeEnvelope['event'], data: unknown): void {
    this.realtime.toConversation(conversationId, {
      version: 1,
      eventId: randomUUID(),
      event,
      data,
    } as RealtimeEnvelope);
  }

  private deliveryStatus(
    message: { id: string; authorId: string; createdAt: Date },
    actorId: string,
    deliveredMarker?: { id: string; createdAt: Date },
    readMarker?: { id: string; createdAt: Date },
  ): MessageDto['deliveryStatus'] {
    if (message.authorId !== actorId) return null;
    if (readMarker && !this.isAfter(message, readMarker)) return 'read';
    if (deliveredMarker && !this.isAfter(message, deliveredMarker)) return 'delivered';
    return 'sent';
  }

  private isAfter(
    message: { id: string; createdAt: Date },
    marker: { id: string; createdAt: Date },
  ): boolean {
    const timeDifference = message.createdAt.getTime() - marker.createdAt.getTime();
    return timeDifference > 0 || (timeDifference === 0 && message.id > marker.id);
  }
}
