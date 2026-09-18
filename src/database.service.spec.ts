import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseService } from './database.service';
import { AuthService } from './auth.service';
import { ShopService } from './shop.service';

it('persists users, sessions and carts across database reopen', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'microfronts-auth-'));
  const oldPath = process.env.APP_DB_PATH;
  process.env.APP_DB_PATH = join(directory, 'test.sqlite');
  let database = new DatabaseService();
  try {
    let auth = new AuthService(database);
    const user = await auth.register({ name: 'Persistent', email: 'persist@example.com', password: 'long test password' });
    const token = auth.start(user);
    new ShopService(database).change(`user:${user.id}`, 'dock', 3);
    database.onModuleDestroy();
    database = new DatabaseService();
    auth = new AuthService(database);
    expect(auth.user(`microfronts_session=${token}`)?.id).toBe(user.id);
    expect(new ShopService(database).getCart(`user:${user.id}`).items[0].quantity).toBe(3);
    expect((await auth.login({ email: user.email, password: 'long test password', name: '' })).id).toBe(user.id);
  } finally {
    database.onModuleDestroy();
    if (oldPath === undefined) delete process.env.APP_DB_PATH; else process.env.APP_DB_PATH = oldPath;
    rmSync(directory, { recursive: true });
  }
});
