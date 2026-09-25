import { Injectable } from '@nestjs/common';
import type { RealtimeEnvelope } from '@nestchat/contracts';
import type { Server } from 'socket.io';

@Injectable()
export class RealtimeService {
  private server?: Server;
  private readonly onlineUsers = new Set<string>();

  attachServer(server: Server): void {
    this.server = server;
  }

  toConversation(conversationId: string, envelope: RealtimeEnvelope): void {
    this.server?.to(`conversation:${conversationId}`).emit('event', envelope);
  }

  toUser(userId: string, envelope: RealtimeEnvelope): void {
    this.server?.to(`user:${userId}`).emit('event', envelope);
  }

  joinUsersToConversation(userIds: string[], conversationId: string): void {
    for (const userId of userIds) {
      this.server?.in(`user:${userId}`).socketsJoin(`conversation:${conversationId}`);
    }
  }

  setUserOnline(userId: string, online: boolean): void {
    if (online) this.onlineUsers.add(userId);
    else this.onlineUsers.delete(userId);
  }

  isUserOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }
}
