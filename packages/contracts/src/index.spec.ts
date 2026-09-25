import { describe, expect, it } from 'vitest';
import {
  createMessageSchema,
  messageSchema,
  normalizeUsername,
  registerSchema,
  realtimeEnvelopeSchema,
} from './index.js';

describe('Общие контракты', () => {
  it('нормализует имена пользователей для регистронезависимой уникальности', () => {
    expect(normalizeUsername('  Ivan.Petrov_7  ')).toBe('ivan.petrov_7');
  });

  it('отклоняет некорректные имена пользователей и слабые пароли', () => {
    expect(registerSchema.safeParse({ username: 'a!', password: '123' }).success).toBe(false);
    expect(
      registerSchema.safeParse({ username: 'anna_7', password: 'long-pass-123' }).success,
    ).toBe(true);
  });

  it('требует текст или вложения и ограничивает их количество десятью', () => {
    expect(
      createMessageSchema.safeParse({ clientMessageId: crypto.randomUUID(), text: '' }).success,
    ).toBe(false);
    expect(
      createMessageSchema.safeParse({
        clientMessageId: crypto.randomUUID(),
        attachmentIds: Array.from({ length: 11 }, () => crypto.randomUUID()),
      }).success,
    ).toBe(false);
  });

  it('принимает версионированный конверт события реального времени', () => {
    const parsed = realtimeEnvelopeSchema.parse({
      version: 1,
      eventId: crypto.randomUUID(),
      event: 'presence.changed',
      data: { userId: crypto.randomUUID(), online: true, lastSeenAt: null },
    });

    expect(parsed.version).toBe(1);
  });

  it('принимает событие создания нового чата', () => {
    const conversationId = crypto.randomUUID();
    const parsed = realtimeEnvelopeSchema.parse({
      version: 1,
      eventId: crypto.randomUUID(),
      event: 'conversation.created',
      data: { conversationId },
    });

    expect(parsed.data).toEqual({ conversationId });
  });

  it('принимает сообщение с превью ответа', () => {
    const replyId = crypto.randomUUID();
    const parsed = messageSchema.parse({
      id: crypto.randomUUID(),
      clientMessageId: crypto.randomUUID(),
      conversationId: crypto.randomUUID(),
      authorId: crypto.randomUUID(),
      text: 'Ответ',
      replyToId: replyId,
      replyTo: {
        id: replyId,
        authorId: crypto.randomUUID(),
        text: 'Исходное сообщение',
        deletedForAllAt: null,
      },
      createdAt: new Date().toISOString(),
      editedAt: null,
      deletedForAllAt: null,
      deliveryStatus: null,
      attachments: [],
    });

    expect(parsed.replyTo?.text).toBe('Исходное сообщение');
  });
});
