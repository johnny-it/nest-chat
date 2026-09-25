import { describe, expect, it } from 'vitest';
import { RealtimeService } from './realtime.service';

describe('Сервис событий реального времени', () => {
  it('хранит актуальное состояние пользователя в сети', () => {
    const realtime = new RealtimeService();
    const userId = crypto.randomUUID();

    expect(realtime.isUserOnline(userId)).toBe(false);
    realtime.setUserOnline(userId, true);
    expect(realtime.isUserOnline(userId)).toBe(true);
    realtime.setUserOnline(userId, false);
    expect(realtime.isUserOnline(userId)).toBe(false);
  });
});
