import { Test } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { randomBytes, randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { hashToken } from '../src/auth/auth.service';

describe('Profiles and product comments', () => {
  let app: INestApplication<App>;
  let db: PrismaService;
  const owner = randomUUID();
  const other = randomUUID();
  const registrationEmail = `${randomUUID()}@example.test`;
  const productId = `comments-${randomUUID()}`;
  const token = randomBytes(32).toString('hex');
  const otherToken = randomBytes(32).toString('hex');
  const cookie = `microfronts_session=${token}`;
  const otherCookie = `microfronts_session=${otherToken}`;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    db = module.get(PrismaService);
    await app.init();
    for (const [id, sessionToken] of [
      [owner, token],
      [other, otherToken],
    ]) {
      await db.user.create({
        data: {
          id,
          name: 'Fixture',
          email: `${id}@example.test`,
          passwordHash: 'unused',
          sessions: {
            create: {
              tokenHash: hashToken(sessionToken),
              expiresAt: new Date(Date.now() + 600000),
            },
          },
        },
      });
    }
    await db.product.create({
      data: {
        id: productId,
        title: 'Comment fixture',
        description: 'Fixture',
        priceMinor: 100,
      },
    });
  });

  afterAll(async () => {
    await db.product.deleteMany({ where: { id: productId } });
    await db.user.deleteMany({ where: { id: { in: [owner, other] } } });
    await db.user.deleteMany({ where: { email: registrationEmail } });
    await app.close();
  });

  it('requires a session and CSRF, creates legacy profile on save, updates only the owner', async () => {
    const server = app.getHttpServer();
    await request(server).get('/api/profile/me').expect(401);
    await request(server)
      .patch('/api/profile/me')
      .set('Cookie', cookie)
      .send({ bio: 'hello' })
      .expect(403);
    const empty = await request(server)
      .get('/api/profile/me')
      .set('Cookie', cookie)
      .expect(200);
    expect(empty.body).toEqual({
      id: owner,
      name: 'Fixture',
      profile: { bio: '', avatarUrl: null, createdAt: null, updatedAt: null },
    });
    const saved = await request(server)
      .patch('/api/profile/me')
      .set('Cookie', cookie)
      .set('X-Requested-With', 'microfronts')
      .send({
        name: ' Алексей ',
        bio: ' Обо мне ',
        avatarUrl: 'https://example.com/avatar.png',
      })
      .expect(200);
    expect(saved.body.name).toBe('Алексей');
    expect(saved.body.profile.bio).toBe('Обо мне');
    expect(saved.headers['cache-control']).toBe('no-store');
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: other } })).name,
    ).toBe('Fixture');
    for (const body of [
      { userId: other },
      { role: 'ADMIN' },
      { email: 'new@example.test' },
      { name: null },
      { bio: null },
      { bio: 'x'.repeat(2001) },
      { avatarUrl: 'javascript:alert(1)' },
      { avatarUrl: 'http://example.com/a' },
    ]) {
      await request(server)
        .patch('/api/profile/me')
        .set('Cookie', cookie)
        .set('X-Requested-With', 'microfronts')
        .send(body)
        .expect(400);
    }
    const cleared = await request(server)
      .patch('/api/profile/me')
      .set('Cookie', cookie)
      .set('X-Requested-With', 'microfronts')
      .send({ avatarUrl: null, bio: '' })
      .expect(200);
    expect(cleared.body.profile.avatarUrl).toBeNull();
    expect(cleared.body.name).toBe('Алексей');
    const me = await request(server)
      .get('/api/auth/me')
      .set('Cookie', cookie)
      .expect(200);
    expect(me.body.user.name).toBe('Алексей');
  });

  it('validates comments, paginates public results and enforces ownership atomically', async () => {
    const server = app.getHttpServer();
    const path = `/api/products/${productId}/comments`;
    await request(server)
      .get('/api/products/missing-product/comments')
      .expect(404);
    await request(server).post(path).send({ text: 'Hello' }).expect(401);
    await request(server)
      .post(path)
      .set('Cookie', cookie)
      .send({ text: 'Hello' })
      .expect(403);
    for (const body of [
      { text: '   ' },
      { text: 'x'.repeat(5001) },
      { text: 'Hello', userId: other },
      { text: null },
    ]) {
      await request(server)
        .post(path)
        .set('Cookie', cookie)
        .set('X-Requested-With', 'microfronts')
        .send(body)
        .expect(400);
    }
    const created = await request(server)
      .post(path)
      .set('Cookie', cookie)
      .set('X-Requested-With', 'microfronts')
      .send({ text: ' Полезный товар ' })
      .expect(201);
    expect(created.body.text).toBe('Полезный товар');
    const author = await db.user.findUniqueOrThrow({ where: { id: owner } });
    expect(created.body.user).toEqual({ id: owner, name: author.name });
    expect(Object.keys(created.body.user).sort()).toEqual(['id', 'name']);
    const second = await request(server)
      .post(path)
      .set('Cookie', cookie)
      .set('X-Requested-With', 'microfronts')
      .send({ text: 'Second' })
      .expect(201);
    const firstPage = await request(server)
      .get(`${path}?page=1&limit=1`)
      .expect(200);
    const secondPage = await request(server)
      .get(`${path}?page=2&limit=1`)
      .expect(200);
    expect(
      new Set([firstPage.body.items[0].id, secondPage.body.items[0].id]).size,
    ).toBe(2);
    await request(server)
      .get(`${path}?page=3&limit=1`)
      .expect(200)
      .expect({ items: [], page: 3, limit: 1 });
    for (const query of [
      'page=0',
      'limit=101',
      'page=abc',
      'page=1&page=2',
      'limit=',
      'unexpected=1',
    ]) {
      await request(server).get(`${path}?${query}`).expect(400);
    }
    const commentPath = `/api/comments/${created.body.id}`;
    await request(server)
      .patch(commentPath)
      .set('Cookie', otherCookie)
      .set('X-Requested-With', 'microfronts')
      .send({ text: 'Hacked' })
      .expect(404);
    await request(server)
      .delete(commentPath)
      .set('Cookie', otherCookie)
      .set('X-Requested-With', 'microfronts')
      .expect(404);
    await request(server)
      .patch(commentPath)
      .set('Cookie', cookie)
      .set('X-Requested-With', 'microfronts')
      .send({ text: 'Updated' })
      .expect(200);
    await request(server).delete(commentPath).set('Cookie', cookie).expect(403);
    await request(server)
      .delete(commentPath)
      .set('Cookie', cookie)
      .set('X-Requested-With', 'microfronts')
      .expect(204);
    await request(server)
      .delete(commentPath)
      .set('Cookie', cookie)
      .set('X-Requested-With', 'microfronts')
      .expect(404);
    await request(server)
      .patch('/api/comments/not-a-uuid')
      .set('Cookie', cookie)
      .set('X-Requested-With', 'microfronts')
      .send({ text: 'Hello' })
      .expect(400);
    await db.product.delete({ where: { id: productId } });
    expect(
      await db.comment.findUnique({ where: { id: second.body.id } }),
    ).toBeNull();
  });
  it('creates a profile atomically on registration', async () => {
    const server = app.getHttpServer();
    const response = await request(server)
      .post('/api/auth/register')
      .set('X-Requested-With', 'microfronts')
      .send({
        email: registrationEmail,
        name: 'Новый юзер',
        password: 'registration-test-password',
      })
      .expect(201);
    const user = await db.user.findUniqueOrThrow({
      where: { email: registrationEmail },
      include: { profile: true },
    });
    expect(user.profile?.userId).toBe(user.id);
    const cookies = response.headers['set-cookie'] as unknown as string[];
    const profile = await request(server)
      .get('/api/profile/me')
      .set('Cookie', cookies)
      .expect(200);
    expect(profile.body.profile.bio).toBe('');
    expect(profile.body.profile.createdAt).toEqual(expect.any(String));
    await db.user.delete({ where: { id: user.id } });
    expect(
      await db.profile.findUnique({ where: { userId: user.id } }),
    ).toBeNull();
  });
});
