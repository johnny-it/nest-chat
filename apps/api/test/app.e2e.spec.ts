import 'reflect-metadata';
import cookieParser from 'cookie-parser';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

describe('API NestChat', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const runId = crypto.randomUUID().slice(0, 8);
  const userPrefix = `e2e_${runId}_`;
  const annaUsername = `${userPrefix}anna`;
  const maxUsername = `${userPrefix}max`;
  const sessionUsername = `${userPrefix}session`;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    try {
      const users = await prisma.user.findMany({
        where: { usernameNormalized: { startsWith: userPrefix } },
        select: { id: true },
      });
      const userIds = users.map(({ id }) => id);
      const participants = userIds.length
        ? await prisma.conversationParticipant.findMany({
            where: { userId: { in: userIds } },
            select: { conversationId: true },
          })
        : [];
      await prisma.conversation.deleteMany({
        where: { id: { in: [...new Set(participants.map(({ conversationId }) => conversationId))] } },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      await app.close();
    }
  });

  it('выполняет регистрацию, поиск, создание диалога, идемпотентную отправку и загрузку истории', async () => {
    const api = request(app.getHttpServer());
    const annaResponse = await api
      .post('/api/auth/register')
      .send({ username: annaUsername, password: 'secure-password' })
      .expect(201);
    const maxResponse = await api
      .post('/api/auth/register')
      .send({ username: maxUsername, password: 'secure-password' })
      .expect(201);

    const annaToken = annaResponse.body.accessToken as string;
    const maxToken = maxResponse.body.accessToken as string;
    const maxId = maxResponse.body.user.id as string;
    const search = await api
      .get(`/api/users/search?q=${maxUsername}`)
      .set('Authorization', `Bearer ${annaToken}`)
      .expect(200);
    expect(search.body.items.map((user: { username: string }) => user.username)).toEqual([maxUsername]);

    const conversationResponse = await api
      .post('/api/conversations')
      .set('Authorization', `Bearer ${annaToken}`)
      .send({ userId: maxId })
      .expect(201);
    const conversationId = conversationResponse.body.id as string;
    const clientMessageId = crypto.randomUUID();
    const first = await api
      .post(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${annaToken}`)
      .send({ clientMessageId, text: 'Привет!' })
      .expect(201);
    const retry = await api
      .post(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${annaToken}`)
      .send({ clientMessageId, text: 'Привет!' })
      .expect(201);
    expect(retry.body.id).toBe(first.body.id);

    const history = await api
      .get(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${annaToken}`)
      .expect(200);
    expect(history.body.items).toHaveLength(1);
    expect(history.body.items[0].text).toBe('Привет!');
    expect(history.body.items[0].deliveryStatus).toBe('sent');

    await api
      .post(`/api/conversations/${conversationId}/read`)
      .set('Authorization', `Bearer ${maxToken}`)
      .send({ messageId: first.body.id })
      .expect(201);
    const readHistory = await api
      .get(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${annaToken}`)
      .expect(200);
    expect(readHistory.body.items[0].deliveryStatus).toBe('read');
  });

  it('сохраняет сессию с помощью refresh-cookie для API-пути', async () => {
    const agent = request.agent(app.getHttpServer());
    const registration = await agent
      .post('/api/auth/register')
      .send({ username: sessionUsername, password: 'secure-password' })
      .expect(201);
    expect(registration.headers['set-cookie']?.[0]).toContain('Path=/api/auth');
    await agent.post('/api/auth/refresh').expect(201);
  });

  it('отклоняет защищённые запросы без токена доступа', async () => {
    await request(app.getHttpServer()).get('/api/conversations').expect(401);
  });
});
