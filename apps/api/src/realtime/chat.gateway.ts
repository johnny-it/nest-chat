import { randomUUID } from 'node:crypto';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import type { RealtimeEnvelope } from '@nestchat/contracts';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../database/prisma.service';
import { RealtimeService } from './realtime.service';

const conversationCommandSchema = z.object({ conversationId: z.string().uuid() });
const deliveredCommandSchema = conversationCommandSchema.extend({ messageId: z.string().uuid() });

@WebSocketGateway({ cors: { origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173', credentials: true } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly connections = new Map<string, number>();
  private readonly typingTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit(server: Server): void {
    this.realtime.attachServer(server);
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = String(client.handshake.auth?.token ?? '').replace(/^Bearer\s+/i, '');
      const payload = await this.auth.verifyAccessToken(token);
      client.data.userId = payload.sub;
      await client.join(`user:${payload.sub}`);
      const memberships = await this.prisma.conversationParticipant.findMany({
        where: { userId: payload.sub },
        select: { conversationId: true },
      });
      await Promise.all(memberships.map(({ conversationId }) => client.join(`conversation:${conversationId}`)));
      const count = (this.connections.get(payload.sub) ?? 0) + 1;
      this.connections.set(payload.sub, count);
      if (count === 1) {
        this.realtime.setUserOnline(payload.sub, true);
        this.emitPresence(payload.sub, true, null);
      }
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const userId = client.data.userId as string | undefined;
    if (!userId) return;
    const next = Math.max(0, (this.connections.get(userId) ?? 1) - 1);
    if (next > 0) {
      this.connections.set(userId, next);
      return;
    }
    this.connections.delete(userId);
    const lastSeenAt = new Date();
    const result = await this.prisma.user.updateMany({ where: { id: userId }, data: { lastSeenAt } });
    if (!result.count) return;
    this.realtime.setUserOnline(userId, false);
    this.emitPresence(userId, false, lastSeenAt.toISOString());
  }

  @SubscribeMessage('typing.start')
  async typingStart(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const data = conversationCommandSchema.parse(body);
    const userId = String(client.data.userId);
    await this.assertParticipant(data.conversationId, userId);
    client.to(`conversation:${data.conversationId}`).emit('typing', {
      conversationId: data.conversationId,
      userId,
      typing: true,
    });
    const key = `${data.conversationId}:${userId}`;
    const existing = this.typingTimers.get(key);
    if (existing) clearTimeout(existing);
    this.typingTimers.set(
      key,
      setTimeout(() => {
        client.to(`conversation:${data.conversationId}`).emit('typing', {
          conversationId: data.conversationId,
          userId,
          typing: false,
        });
        this.typingTimers.delete(key);
      }, 4_000),
    );
    return { ok: true };
  }

  @SubscribeMessage('typing.stop')
  async typingStop(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const data = conversationCommandSchema.parse(body);
    const userId = String(client.data.userId);
    await this.assertParticipant(data.conversationId, userId);
    client.to(`conversation:${data.conversationId}`).emit('typing', {
      conversationId: data.conversationId,
      userId,
      typing: false,
    });
    return { ok: true };
  }

  @SubscribeMessage('message.delivered')
  async delivered(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const data = deliveredCommandSchema.parse(body);
    const userId = String(client.data.userId);
    await this.assertParticipant(data.conversationId, userId);
    const message = await this.prisma.message.findFirst({
      where: { id: data.messageId, conversationId: data.conversationId },
    });
    if (!message || message.authorId === userId) return { ok: false };
    const participant = await this.prisma.conversationParticipant.findUniqueOrThrow({
      where: { conversationId_userId: { conversationId: data.conversationId, userId } },
    });
    if (participant.lastDeliveredMessageId) {
      const lastDelivered = await this.prisma.message.findUnique({
        where: { id: participant.lastDeliveredMessageId },
      });
      if (lastDelivered && !this.isAfter(message, lastDelivered)) return { ok: true };
    }
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId: data.conversationId, userId } },
      data: { lastDeliveredMessageId: data.messageId },
    });
    this.realtime.toConversation(data.conversationId, {
      version: 1,
      eventId: randomUUID(),
      event: 'conversation.delivered',
      data: { ...data, userId },
    });
    return { ok: true };
  }

  private async assertParticipant(conversationId: string, userId: string): Promise<void> {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) throw new Error('Диалог не найден');
  }

  private isAfter(
    message: { id: string; createdAt: Date },
    marker: { id: string; createdAt: Date },
  ): boolean {
    const timeDifference = message.createdAt.getTime() - marker.createdAt.getTime();
    return timeDifference > 0 || (timeDifference === 0 && message.id > marker.id);
  }

  private emitPresence(userId: string, online: boolean, lastSeenAt: string | null): void {
    const envelope: RealtimeEnvelope = {
      version: 1,
      eventId: randomUUID(),
      event: 'presence.changed',
      data: { userId, online, lastSeenAt },
    };
    this.server.emit('event', envelope);
  }
}
