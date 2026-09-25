import type { AttachmentDto, MessageDto, UserDto } from '@nestchat/contracts';

export function toUserDto(user: any): UserDto {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarPath
      ? `/files/avatar/${user.id}?v=${encodeURIComponent(user.avatarPath)}`
      : null,
    lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
  };
}

export function toAttachmentDto(attachment: any): AttachmentDto {
  return {
    id: attachment.id,
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    url: `/files/${attachment.id}`,
    kind: attachment.mimeType.startsWith('image/') ? 'image' : 'document',
  };
}

export function toMessageDto(
  message: any,
  deliveryStatus: MessageDto['deliveryStatus'] = null,
): MessageDto {
  return {
    id: message.id,
    clientMessageId: message.clientMessageId,
    conversationId: message.conversationId,
    authorId: message.authorId,
    text: message.deletedForAllAt ? null : message.text,
    replyToId: message.replyToId,
    replyTo: message.replyTo
      ? {
          id: message.replyTo.id,
          authorId: message.replyTo.authorId,
          text: message.replyTo.deletedForAllAt ? null : message.replyTo.text,
          deletedForAllAt: message.replyTo.deletedForAllAt?.toISOString() ?? null,
        }
      : null,
    createdAt: message.createdAt.toISOString(),
    editedAt: message.editedAt?.toISOString() ?? null,
    deletedForAllAt: message.deletedForAllAt?.toISOString() ?? null,
    deliveryStatus,
    attachments: message.deletedForAllAt ? [] : (message.attachments ?? []).map(toAttachmentDto),
  };
}
