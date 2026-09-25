import { z } from 'zod';

export const USERNAME_PATTERN = /^[a-zA-Z0-9_.]{3,32}$/;

export function normalizeUsername(username: string): string {
  return username.trim().toLocaleLowerCase('en-US');
}

export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Имя пользователя должно содержать минимум 3 символа')
  .max(32, 'Имя пользователя не должно превышать 32 символа')
  .regex(USERNAME_PATTERN, 'Используйте латинские буквы, цифры, точку и подчёркивание');

export const passwordSchema = z
  .string()
  .min(8, 'Пароль должен содержать минимум 8 символов')
  .max(128, 'Пароль не должен превышать 128 символов');

export const registerSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(64).optional(),
});

export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1),
});

export const cursorQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const createConversationSchema = z.object({
  userId: z.string().uuid(),
});

export const createMessageSchema = z
  .object({
    clientMessageId: z.string().uuid(),
    text: z.string().trim().max(4_000).optional(),
    replyToId: z.string().uuid().optional(),
    attachmentIds: z.array(z.string().uuid()).max(10).default([]),
  })
  .refine((value) => Boolean(value.text?.length) || value.attachmentIds.length > 0, {
    message: 'Добавьте текст или вложение',
    path: ['text'],
  });

export const editMessageSchema = z.object({
  text: z.string().trim().min(1).max(4_000),
});

export const deleteMessageQuerySchema = z.object({
  scope: z.enum(['self', 'everyone']),
});

export const readConversationSchema = z.object({
  messageId: z.string().uuid(),
});

export const userSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  online: z.boolean().optional(),
  lastSeenAt: z.string().datetime().nullable(),
});

export const attachmentSchema = z.object({
  id: z.string().uuid(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number().int().nonnegative(),
  url: z.string(),
  kind: z.enum(['image', 'document']),
});

export const replyPreviewSchema = z.object({
  id: z.string().uuid(),
  authorId: z.string().uuid(),
  text: z.string().nullable(),
  deletedForAllAt: z.string().datetime().nullable(),
});

export const messageSchema = z.object({
  id: z.string().uuid(),
  clientMessageId: z.string().uuid(),
  conversationId: z.string().uuid(),
  authorId: z.string().uuid(),
  text: z.string().nullable(),
  replyToId: z.string().uuid().nullable(),
  replyTo: replyPreviewSchema.nullable(),
  createdAt: z.string().datetime(),
  editedAt: z.string().datetime().nullable(),
  deletedForAllAt: z.string().datetime().nullable(),
  deliveryStatus: z.enum(['sent', 'delivered', 'read']).nullable(),
  attachments: z.array(attachmentSchema),
});

export const conversationSchema = z.object({
  id: z.string().uuid(),
  peer: userSchema,
  lastMessage: messageSchema.nullable(),
  unreadCount: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
});

const realtimeEventSchema = z.discriminatedUnion('event', [
  z.object({
    event: z.literal('conversation.created'),
    data: z.object({ conversationId: z.string().uuid() }),
  }),
  z.object({ event: z.literal('message.created'), data: messageSchema }),
  z.object({ event: z.literal('message.updated'), data: messageSchema }),
  z.object({
    event: z.literal('message.deleted'),
    data: z.object({ messageId: z.string().uuid(), conversationId: z.string().uuid() }),
  }),
  z.object({
    event: z.literal('conversation.read'),
    data: z.object({
      conversationId: z.string().uuid(),
      userId: z.string().uuid(),
      messageId: z.string().uuid(),
    }),
  }),
  z.object({
    event: z.literal('conversation.delivered'),
    data: z.object({
      conversationId: z.string().uuid(),
      userId: z.string().uuid(),
      messageId: z.string().uuid(),
    }),
  }),
  z.object({
    event: z.literal('presence.changed'),
    data: z.object({
      userId: z.string().uuid(),
      online: z.boolean(),
      lastSeenAt: z.string().datetime().nullable(),
    }),
  }),
]);

export const realtimeEnvelopeSchema = z.intersection(
  z.object({ version: z.literal(1), eventId: z.string().uuid() }),
  realtimeEventSchema,
);

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
  requestId: z.string(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type UserDto = z.infer<typeof userSchema>;
export type MessageDto = z.infer<typeof messageSchema>;
export type ConversationDto = z.infer<typeof conversationSchema>;
export type AttachmentDto = z.infer<typeof attachmentSchema>;
export type ReplyPreviewDto = z.infer<typeof replyPreviewSchema>;
export type RealtimeEnvelope = z.infer<typeof realtimeEnvelopeSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;

export interface AuthResponse {
  accessToken: string;
  user: UserDto;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}
