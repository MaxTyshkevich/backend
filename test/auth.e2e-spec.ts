import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { clearTestDatabase } from './database';

describe('Authentication and cart ownership', () => {
  let app: INestApplication<App>;
  let database: PrismaService;
  const password = 'correct horse battery staple';
  const headers = {
    'X-Requested-With': 'microfronts',
    Origin: 'http://localhost:5173',
  };
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    database = module.get(PrismaService);
    // Test.createNestApplication does not execute main.ts.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    await clearTestDatabase(database);
  });
  afterEach(async () => {
    await app.close();
  });
  it('returns database products with descriptions, ratings and ISO timestamps', async () => {
    const id = randomUUID();
    try {
      await database.product.create({
        data: {
          id,
          title: 'API product',
          description: 'Product from the database',
          priceMinor: 4200,
          rating: 4.2,
        },
      });
      const response = await request(app.getHttpServer())
        .get('/api/products')
        .expect(200);
      const products = response.body as {
        id: string;
        createdAt: string;
        updatedAt: string;
      }[];
      const product = products.find((item: { id: string }) => item.id === id);
      if (!product) throw new Error('Expected product in API response');
      expect(product).toEqual({
        id,
        title: 'API product',
        description: 'Product from the database',
        priceMinor: 4200,
        currency: 'USD',
        rating: 4.2,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      });
      expect(new Date(product.createdAt).toISOString()).toBe(product.createdAt);
      expect(new Date(product.updatedAt).toISOString()).toBe(product.updatedAt);
    } finally {
      await database.product.deleteMany({ where: { id } });
    }
  });
  it('registers, keeps guest cart separate, restores session, isolates accounts and revokes logout', async () => {
    const guest = randomUUID();
    const server = app.getHttpServer();
    await request(server)
      .post('/api/cart/items')
      .set({ ...headers, 'X-Cart-Key': guest })
      .send({ productId: 'dock', quantity: 2 })
      .expect(201);
    const registered = await request(server)
      .post('/api/auth/register')
      .set({ ...headers, 'X-Cart-Key': guest })
      .send({ name: 'Alice', email: 'alice@example.com', password })
      .expect(201);
    const cookie = registered.headers['set-cookie'][0].split(';')[0];
    expect(registered.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(registered.body as unknown).toEqual({ success: true });
    const alice = await database.user.findUniqueOrThrow({
      where: { email: 'alice@example.com' },
    });
    const id = alice.id;
    const authenticated = { ...headers, Cookie: cookie, 'X-Session-User': id };
    await request(server)
      .get('/api/auth/me')
      .set('Cookie', cookie)
      .expect(200)
      .expect({
        user: { id, email: 'alice@example.com', name: 'Alice', role: 'USER' },
      });
    await request(server)
      .get('/api/cart')
      .set(authenticated)
      .expect(200)
      .expect(({ body }: { body: { items: { quantity: number }[] } }) =>
        expect(body.items).toEqual([]),
      );
    await request(server)
      .get('/api/cart')
      .set('X-Cart-Key', guest)
      .expect(200)
      .expect(({ body }: { body: { items: { quantity: number }[] } }) =>
        expect(body.items[0].quantity).toBe(2),
      );
    // Supplying a user id as the guest key cannot read that user's cart.
    await request(server)
      .get('/api/cart')
      .set('X-Cart-Key', `user:${id}`)
      .expect(400);
    const login = await request(server)
      .post('/api/auth/login')
      .set({ ...authenticated, 'X-Cart-Key': guest })
      .send({ email: 'alice@example.com', password })
      .expect(200);
    const newCookie = login.headers['set-cookie'][0].split(';')[0];
    await request(server)
      .get('/api/cart')
      .set({ ...authenticated, Cookie: newCookie })
      .expect(({ body }: { body: { items: { quantity: number }[] } }) =>
        expect(body.items).toEqual([]),
      );
    await request(server).get('/api/cart').set(authenticated).expect(401);
    const bob = await request(server)
      .post('/api/auth/register')
      .set(headers)
      .send({ name: 'Bob', email: 'bob@example.com', password })
      .expect(201);
    const bobUser = await database.user.findUniqueOrThrow({
      where: { email: 'bob@example.com' },
    });
    await request(server)
      .get('/api/cart')
      .set('Cookie', bob.headers['set-cookie'][0].split(';')[0])
      .expect(({ body }: { body: { items: unknown[] } }) =>
        expect(body.items).toEqual([]),
      );
    await request(server)
      .get('/api/cart')
      .set({ Cookie: newCookie, 'X-Session-User': bobUser.id })
      .expect(401);
    await request(server)
      .post('/api/auth/logout')
      .set({ ...headers, Cookie: newCookie })
      .expect(200);
    await request(server)
      .get('/api/auth/me')
      .set('Cookie', newCookie)
      .expect({ user: null });
    await request(server)
      .get('/api/cart')
      .set({ ...authenticated, Cookie: newCookie })
      .expect(401);
  });
  it('rejects invalid credentials, duplicate emails, CSRF and expired sessions', async () => {
    const server = app.getHttpServer();
    await request(server).post('/api/auth/register').send({}).expect(403);
    await request(server)
      .post('/api/auth/register')
      .set({ ...headers, Origin: 'https://evil.example' })
      .send({})
      .expect(403);
    await request(server)
      .post('/api/auth/register')
      .set(headers)
      .send({ name: 'A', email: 'invalid', password })
      .expect(400);
    const user = { name: 'Alice', email: 'a@example.com', password };
    const registered = await request(server)
      .post('/api/auth/register')
      .set(headers)
      .send(user)
      .expect(201);
    await request(server)
      .post('/api/auth/register')
      .set(headers)
      .send(user)
      .expect(409);
    await request(server)
      .post('/api/auth/login')
      .set(headers)
      .send({ email: user.email, password: 'wrong password 123' })
      .expect(401);
    const cookie = registered.headers['set-cookie'][0].split(';')[0];
    const stored = await database.user.findUniqueOrThrow({
      where: { email: user.email },
    });
    await database.session.updateMany({ data: { expiresAt: new Date(0) } });
    await request(server)
      .get('/api/auth/me')
      .set('Cookie', cookie)
      .expect({ user: null });
    await request(server)
      .post('/api/cart/items')
      .set({
        ...headers,
        Cookie: cookie,
        'X-Session-User': stored.id,
      })
      .send({ productId: 'dock', quantity: 1 })
      .expect(401);
    for (let index = 0; index < 7; index++)
      await request(server)
        .post('/api/auth/login')
        .set(headers)
        .send({ email: user.email, password: 'wrong password 123' });
    await request(server)
      .post('/api/auth/login')
      .set(headers)
      .send({ email: user.email, password })
      .expect(429);
  });
});
