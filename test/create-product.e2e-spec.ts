import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import { configureValidation } from '../src/configure-validation';
import request from 'supertest';
import type { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { AuthService, sessionCookie } from '../src/auth/auth.service';
import { clearTestDatabase } from './database';

describe('Administrator product creation', () => {
  let app: INestApplication<App>;
  let db: PrismaService;
  let adminCookie: string;
  let userCookie: string;
  let adminId: string;
  const productIds: string[] = [];
  const headers = {
    Origin: 'http://localhost:5173',
    'X-Requested-With': 'microfronts',
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureValidation(app);
    db = module.get(PrismaService);
    await app.init();
    await clearTestDatabase(db);
    const auth = module.get(AuthService);
    const password = 'correct horse battery staple';
    const admin = await auth.register({
      name: 'Admin',
      email: 'product-admin@example.com',
      password,
    });
    adminId = admin.id;
    await db.user.update({ where: { id: adminId }, data: { role: 'ADMIN' } });
    adminCookie = `${sessionCookie}=${await auth.start(admin)}`;
    const user = await auth.register({
      name: 'User',
      email: 'product-user@example.com',
      password,
    });
    userCookie = `${sessionCookie}=${await auth.start(user)}`;
  });

  afterAll(async () => {
    await db.product.deleteMany({ where: { id: { in: productIds } } });
    await clearTestDatabase(db);
    await app.close();
  });

  function product() {
    const id = `test-${randomUUID()}`;
    productIds.push(id);
    return {
      id,
      title: 'New keyboard',
      description: 'Product description',
      priceMinor: 12345,
      categoryId: 'other',
    };
  }

  it('requires a valid session and ADMIN even when the client claims to be an admin', async () => {
    const server = app.getHttpServer();
    await request(server)
      .post('/api/products')
      .set(headers)
      .send(product())
      .expect(401);
    await request(server)
      .post('/api/products')
      .set({ ...headers, Cookie: `${sessionCookie}=${'0'.repeat(64)}` })
      .send(product())
      .expect(401);
    await request(server)
      .post('/api/products')
      .set({ ...headers, Cookie: userCookie, 'X-Role': 'ADMIN' })
      .send(product())
      .expect(403);
    await request(server)
      .post('/api/products')
      .set({
        ...headers,
        Cookie: adminCookie,
        'X-Session-User': 'another-user',
      })
      .send(product())
      .expect(401);
    await request(server)
      .post('/api/products')
      .set('Cookie', adminCookie)
      .send(product())
      .expect(403);
    await request(server)
      .post('/api/products')
      .set({ ...headers, Cookie: adminCookie, Origin: 'https://evil.example' })
      .send(product())
      .expect(403);
  });

  it('creates a publicly readable product with server-owned defaults and detects duplicate IDs', async () => {
    const data = product();
    const response = await request(app.getHttpServer())
      .post('/api/products')
      .set({ ...headers, Cookie: adminCookie })
      .send(data)
      .expect(201);
    expect(response.body as unknown).toEqual({
      ...data,
      currency: 'USD',
      rating: null,
      category: { id: 'other', slug: 'other', name: 'Прочее' },
      createdAt: expect.any(String) as unknown,
      updatedAt: expect.any(String) as unknown,
    });
    await request(app.getHttpServer())
      .get(`/api/products/${data.id}`)
      .expect(200)
      .expect(response.body as object);
    await request(app.getHttpServer())
      .post('/api/products')
      .set({ ...headers, Cookie: adminCookie })
      .send(data)
      .expect(409);
  });

  it('rejects invalid prices, blank fields, unknown categories and extra fields', async () => {
    const invalid = [
      { priceMinor: -1 },
      { priceMinor: 1.5 },
      { priceMinor: 2147483648 },
      { priceMinor: '100' },
      { id: '../invalid' },
      { title: '   ' },
      { description: '' },
      { categoryId: 'missing-category' },
      { currency: 'EUR' },
      { rating: 5 },
      { role: 'ADMIN' },
    ];
    for (const fields of invalid) {
      await request(app.getHttpServer())
        .post('/api/products')
        .set({ ...headers, Cookie: adminCookie })
        .send({ ...product(), ...fields })
        .expect(400);
    }
  });

  it('reads role changes from the database on every write and rejects expired sessions', async () => {
    await db.user.update({ where: { id: adminId }, data: { role: 'USER' } });
    await request(app.getHttpServer())
      .post('/api/products')
      .set({ ...headers, Cookie: adminCookie })
      .send(product())
      .expect(403);
    await db.user.update({ where: { id: adminId }, data: { role: 'ADMIN' } });
    await db.session.updateMany({
      where: { userId: adminId },
      data: { expiresAt: new Date(0) },
    });
    await request(app.getHttpServer())
      .post('/api/products')
      .set({ ...headers, Cookie: adminCookie })
      .send(product())
      .expect(401);
  });
});
