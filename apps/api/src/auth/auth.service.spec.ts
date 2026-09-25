import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { verify } from 'argon2';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthService } from './auth.service';

function createAuthHarness() {
  const users: Array<Record<string, any>> = [];
  const sessions: Array<Record<string, any>> = [];
  const prisma = {
    user: {
      findUnique: async ({ where }: any) =>
        users.find(
          (user) => user.usernameNormalized === where.usernameNormalized || user.id === where.id,
        ) ?? null,
      create: async ({ data }: any) => {
        const user = {
          id: crypto.randomUUID(),
          avatarPath: null,
          lastSeenAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        users.push(user);
        return user;
      },
    },
    refreshSession: {
      create: async ({ data }: any) => {
        const session = { id: crypto.randomUUID(), createdAt: new Date(), revokedAt: null, ...data };
        sessions.push(session);
        return session;
      },
    },
  };
  const values: Record<string, unknown> = {
        JWT_ACCESS_SECRET: 'test-access-secret-that-is-long-enough',
        ACCESS_TOKEN_TTL: '15m',
        REFRESH_TOKEN_TTL_DAYS: 30,
  };
  const config = {
    get: (key: string, fallback?: unknown) => values[key] ?? fallback,
    getOrThrow: (key: string) => {
      const value = values[key];
      if (value === undefined) throw new Error(`Missing ${key}`);
      return value;
    },
  };
  const service = new AuthService(prisma as never, new JwtService(), config as never);
  return { service, users, sessions };
}

describe('Сервис авторизации', () => {
  let harness: ReturnType<typeof createAuthHarness>;

  beforeEach(() => {
    harness = createAuthHarness();
  });

  it('регистрирует нормализованного пользователя и хранит только хеш пароля', async () => {
    const result = await harness.service.register(
      { username: '  Anna_7 ', password: 'safe-password' },
      { userAgent: 'vitest', ipAddress: '127.0.0.1' },
    );

    expect(result.user.username).toBe('Anna_7');
    expect(result.accessToken).toBeTypeOf('string');
    expect(result.refreshToken).toBeTypeOf('string');
    expect(harness.users[0]?.passwordHash).not.toBe('safe-password');
    expect(await verify(harness.users[0]?.passwordHash, 'safe-password')).toBe(true);
    expect(harness.sessions).toHaveLength(1);
  });

  it('отклоняет повторяющееся имя пользователя независимо от регистра', async () => {
    await harness.service.register(
      { username: 'Anna_7', password: 'safe-password' },
      { userAgent: null, ipAddress: null },
    );

    await expect(
      harness.service.register(
        { username: 'ANNA_7', password: 'safe-password' },
        { userAgent: null, ipAddress: null },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('отклоняет неверный пароль', async () => {
    await harness.service.register(
      { username: 'Anna_7', password: 'safe-password' },
      { userAgent: null, ipAddress: null },
    );

    await expect(
      harness.service.login(
        { username: 'anna_7', password: 'wrong-password' },
        { userAgent: null, ipAddress: null },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
