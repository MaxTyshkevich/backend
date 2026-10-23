import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

describe('Catalog categories and product details', () => {
  let app: INestApplication<App>;
  let db: PrismaService;
  const id = randomUUID();
  const slug = `test-${id}`;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    db = module.get(PrismaService);
    await app.init();
    await db.category.create({
      data: { id, slug, name: 'Empty test category' },
    });
  });

  afterAll(async () => {
    await db.product.deleteMany({ where: { id } });
    await db.category.deleteMany({ where: { id } });
    await app.close();
  });

  it('lists categories and distinguishes empty, missing and malformed filters', async () => {
    const server = app.getHttpServer();
    const response = await request(server).get('/api/categories').expect(200);
    expect(response.body as unknown).toEqual(
      expect.arrayContaining([{ id, slug, name: 'Empty test category' }]),
    );
    await request(server)
      .get('/api/products')
      .query({ category: slug })
      .expect(200)
      .expect([]);
    await request(server)
      .get('/api/products?category=does-not-exist')
      .expect(404);
    await request(server).get('/api/products?category=').expect(400);
    await request(server)
      .get('/api/products?category=a&category=b')
      .expect(400);
    await request(server)
      .get('/api/products')
      .query({ category: 'a'.repeat(101) })
      .expect(400);
  });

  it('filters in PostgreSQL and returns a full product by its independent ID', async () => {
    await db.product.create({
      data: {
        id,
        title: 'Catalog fixture',
        description: 'Full description',
        priceMinor: 100,
        categoryId: id,
      },
    });
    const server = app.getHttpServer();
    const response = await request(server)
      .get('/api/products')
      .query({ category: slug })
      .expect(200);
    const products = response.body as { id: string }[];
    expect(products.map((product) => product.id)).toEqual([id]);
    await request(server)
      .get(`/api/products/${id}`)
      .expect(200)
      .expect((response) => {
        expect(response.body as unknown).toEqual(
          expect.objectContaining({
            id,
            description: 'Full description',
            priceMinor: 100,
            rating: null,
            category: { id, slug, name: 'Empty test category' },
          }),
        );
      });
    await request(server).get('/api/products/missing-product').expect(404);
    // Database integrity: products cannot reference missing categories or lose their category.
    await expect(
      db.product.update({
        where: { id },
        data: { categoryId: 'missing-category' },
      }),
    ).rejects.toThrow();
    await expect(db.category.delete({ where: { id } })).rejects.toThrow();
  });
});
