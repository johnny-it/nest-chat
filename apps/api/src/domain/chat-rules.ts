interface EditableMessage {
  authorId: string;
  deletedForAllAt: Date | null;
}

interface OwnedMessage {
  authorId: string;
}

export function buildDirectKey(firstUserId: string, secondUserId: string): string {
  return [firstUserId, secondUserId].sort((a, b) => a.localeCompare(b)).join(':');
}

export function canEditMessage(message: EditableMessage, actorId: string): boolean {
  return message.authorId === actorId && message.deletedForAllAt === null;
}

export function canDeleteForEveryone(message: OwnedMessage, actorId: string): boolean {
  return message.authorId === actorId;
}
