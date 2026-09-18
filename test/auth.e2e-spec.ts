import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database.service';

describe('Authentication and cart ownership', () => {
  let app: INestApplication;
  let database: DatabaseService;
  const password = 'correct horse battery staple';
  const headers = { 'X-Requested-With': 'microfronts', Origin: 'http://localhost:5173' };
  beforeEach(async () => {
    process.env.APP_DB_PATH = ':memory:';
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    database = module.get(DatabaseService);
    await app.init();
  });
  afterEach(async () => { await app.close(); });
  it('registers, merges only once, restores session, isolates accounts and revokes logout', async () => {
    const guest = randomUUID();
    const server = app.getHttpServer();
    await request(server).post('/api/cart/items').set({ ...headers, 'X-Cart-Key': guest }).send({ productId: 'dock', quantity: 2 }).expect(201);
    const registered = await request(server).post('/api/auth/register').set({ ...headers, 'X-Cart-Key': guest }).send({ name: 'Alice', email: 'ALICE@example.com', password }).expect(201);
    const cookie = registered.headers['set-cookie'][0].split(';')[0];
    expect(registered.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(registered.body.user.email).toBe('alice@example.com');
    expect(registered.body.user.password_hash).toBeUndefined();
    const id = registered.body.user.id;
    const authenticated = { ...headers, Cookie: cookie, 'X-Session-User': id };
    await request(server).get('/api/auth/me').set('Cookie', cookie).expect(200).expect(({ body }) => expect(body.user.id).toBe(id));
    await request(server).get('/api/cart').set(authenticated).expect(200).expect(({ body }) => expect(body.items[0].quantity).toBe(2));
    await request(server).get('/api/cart').set('X-Cart-Key', guest).expect(410);
    // Supplying a user id as the guest key cannot read that user's cart.
    await request(server).get('/api/cart').set('X-Cart-Key', `user:${id}`).expect(400);
    const login = await request(server).post('/api/auth/login').set({ ...authenticated, 'X-Cart-Key': guest }).send({ email: 'alice@example.com', password }).expect(201);
    const newCookie = login.headers['set-cookie'][0].split(';')[0];
    await request(server).get('/api/cart').set({ ...authenticated, Cookie: newCookie }).expect(({ body }) => expect(body.items[0].quantity).toBe(2));
    await request(server).get('/api/cart').set(authenticated).expect(401);
    const bob = await request(server).post('/api/auth/register').set(headers).send({ name: 'Bob', email: 'bob@example.com', password }).expect(201);
    await request(server).get('/api/cart').set('Cookie', bob.headers['set-cookie'][0].split(';')[0]).expect(({ body }) => expect(body.items).toEqual([]));
    await request(server).get('/api/cart').set({ Cookie: newCookie, 'X-Session-User': bob.body.user.id }).expect(401);
    await request(server).post('/api/auth/logout').set({ ...headers, Cookie: newCookie }).expect(201);
    await request(server).get('/api/auth/me').set('Cookie', newCookie).expect(({ body }) => expect(body.user).toBeNull());
    await request(server).get('/api/cart').set({ ...authenticated, Cookie: newCookie }).expect(401);
  });
  it('rejects invalid credentials, duplicate emails, CSRF and expired sessions', async () => {
    const server = app.getHttpServer();
    await request(server).post('/api/auth/register').send({}).expect(403);
    await request(server).post('/api/auth/register').set({ ...headers, Origin: 'https://evil.example' }).send({}).expect(403);
    await request(server).post('/api/auth/register').set(headers).send({ name: 'A', email: 'invalid', password }).expect(400);
    const user = { name: 'A', email: 'a@example.com', password };
    const registered = await request(server).post('/api/auth/register').set(headers).send(user).expect(201);
    await request(server).post('/api/auth/register').set(headers).send(user).expect(409);
    await request(server).post('/api/auth/login').set(headers).send({ ...user, password: 'wrong password 123' }).expect(401);
    const cookie = registered.headers['set-cookie'][0].split(';')[0];
    database.db.prepare('UPDATE sessions SET expires_at = 0').run();
    await request(server).get('/api/auth/me').set('Cookie', cookie).expect(({ body }) => expect(body.user).toBeNull());
    await request(server).post('/api/cart/items').set({ ...headers, Cookie: cookie, 'X-Session-User': registered.body.user.id }).send({ productId: 'dock', quantity: 1 }).expect(401);
    for (let index = 0; index < 7; index++) await request(server).post('/api/auth/login').set(headers).send({ ...user, password: 'wrong password 123' });
    await request(server).post('/api/auth/login').set(headers).send(user).expect(429);
  });
});
