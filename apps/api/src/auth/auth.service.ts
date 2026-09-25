import { randomBytes, createHash } from 'node:crypto';
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from 'argon2';
import type { LoginInput, RegisterInput, UserDto } from '@nestchat/contracts';
import { normalizeUsername } from '@nestchat/contracts';
import { PrismaService } from '../database/prisma.service';

export interface SessionMeta {
  userAgent: string | null;
  ipAddress: string | null;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: UserDto;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(input: RegisterInput, meta: SessionMeta): Promise<AuthResult> {
    const username = input.username.trim();
    const usernameNormalized = normalizeUsername(username);
    const existing = await this.prisma.user.findUnique({ where: { usernameNormalized } });
    if (existing) throw new ConflictException('Имя пользователя уже занято');

    const user = await this.prisma.user.create({
      data: {
        username,
        usernameNormalized,
        displayName: input.displayName?.trim() || username,
        passwordHash: await hash(input.password),
      },
    });

    return this.createSession(user, meta);
  }

  async login(input: LoginInput, meta: SessionMeta): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { usernameNormalized: normalizeUsername(input.username) },
    });
    if (!user || !(await verify(user.passwordHash, input.password))) {
      throw new UnauthorizedException('Неверное имя пользователя или пароль');
    }
    return this.createSession(user, meta);
  }

  async refresh(refreshToken: string, meta: SessionMeta): Promise<AuthResult> {
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Сессия недействительна');
    }
    await this.prisma.refreshSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    return this.createSession(session.user, meta);
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;
    await this.prisma.refreshSession.updateMany({
      where: { tokenHash: this.hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async verifyAccessToken(token: string): Promise<{ sub: string; username: string }> {
    try {
      return await this.jwt.verifyAsync(token, { secret: this.accessSecret });
    } catch {
      throw new UnauthorizedException('Токен доступа недействителен');
    }
  }

  private async createSession(
    user: {
      id: string;
      username: string;
      displayName: string;
      avatarPath: string | null;
      lastSeenAt: Date | null;
    },
    meta: SessionMeta,
  ): Promise<AuthResult> {
    const refreshToken = randomBytes(48).toString('base64url');
    const ttlDays = Number(this.config.get('REFRESH_TOKEN_TTL_DAYS', 30));
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1_000);
    await this.prisma.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        expiresAt,
      },
    });
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, username: user.username },
      {
        secret: this.accessSecret,
        expiresIn: (this.config.get<string>('ACCESS_TOKEN_TTL') ?? '15m') as never,
      },
    );
    return { accessToken, refreshToken, user: this.toUserDto(user) };
  }

  private toUserDto(user: {
    id: string;
    username: string;
    displayName: string;
    avatarPath: string | null;
    lastSeenAt: Date | null;
  }): UserDto {
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

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private get accessSecret(): string {
    return this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
  }
}
