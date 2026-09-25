import { describe, expect, it } from 'vitest';
import { buildDirectKey, canDeleteForEveryone, canEditMessage } from './chat-rules';

describe('Правила предметной области чата', () => {
  it('создаёт одинаковый ключ диалога независимо от порядка участников', () => {
    expect(buildDirectKey('b-user', 'a-user')).toBe('a-user:b-user');
    expect(buildDirectKey('a-user', 'b-user')).toBe('a-user:b-user');
  });

  it('разрешает редактировать неудалённое сообщение только автору', () => {
    expect(canEditMessage({ authorId: 'u1', deletedForAllAt: null }, 'u1')).toBe(true);
    expect(canEditMessage({ authorId: 'u1', deletedForAllAt: null }, 'u2')).toBe(false);
    expect(canEditMessage({ authorId: 'u1', deletedForAllAt: new Date() }, 'u1')).toBe(false);
  });

  it('разрешает удалить сообщение у всех только автору', () => {
    expect(canDeleteForEveryone({ authorId: 'u1' }, 'u1')).toBe(true);
    expect(canDeleteForEveryone({ authorId: 'u1' }, 'u2')).toBe(false);
  });
});
