import { Injectable } from '@nestjs/common';
import type { CursorPage, UserDto } from '@nestchat/contracts';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async search(actorId: string, query: string, cursor?: string): Promise<CursorPage<UserDto>> {
    const take = 21;
    const users = await this.prisma.user.findMany({
      where: {
        id: { not: actorId },
        usernameNormalized: { contains: query.trim().toLocaleLowerCase('en-US') },
      },
      orderBy: [{ usernameNormalized: 'asc' }, { id: 'asc' }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take,
    });
    const hasMore = users.length === take;
    const page = hasMore ? users.slice(0, -1) : users;
    return {
      items: page.map((user) => ({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarPath
          ? `/files/avatar/${user.id}?v=${encodeURIComponent(user.avatarPath)}`
          : null,
        lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
      })),
      nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
    };
  }
}
