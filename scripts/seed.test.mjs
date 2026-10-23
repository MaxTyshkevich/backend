import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { Client } from 'pg';
import { seedCatalog } from './seed.mjs';

test('fresh migrations contain no demo data; seed is repeatable and preserves edited/custom records', async () => {
  const url = new URL(process.env.TEST_DATABASE_URL || '');
  if (
    url.pathname !== '/microfronts_test' ||
    !['localhost', '127.0.0.1', 'db-test'].includes(url.hostname)
  ) {
    throw new Error(
      'Seed tests require isolated microfronts_test; use npm test.',
    );
  }
  const client = new Client({ connectionString: url.toString() });
  const schema = 'seed_test_' + randomBytes(6).toString('hex');
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    const migrations = new URL('../prisma/migrations/', import.meta.url);
    const entries = await readdir(migrations, { withFileTypes: true });
    for (const name of entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()) {
      await client.query(
        await readFile(new URL(`${name}/migration.sql`, migrations), 'utf8'),
      );
    }
    assert.equal(
      (await client.query('SELECT count(*)::int AS count FROM products'))
        .rows[0].count,
      0,
    );
    assert.equal(
      (await client.query('SELECT count(*)::int AS count FROM categories'))
        .rows[0].count,
      0,
    );
    await seedCatalog(client);
    assert.equal(
      (await client.query('SELECT count(*)::int AS count FROM categories'))
        .rows[0].count,
      3,
    );
    assert.deepEqual(
      (await client.query('SELECT id, category_id FROM products ORDER BY id'))
        .rows,
      [
        { id: 'dock', category_id: 'peripherals' },
        { id: 'keyboard', category_id: 'peripherals' },
        { id: 'monitor', category_id: 'monitors' },
      ],
    );
    await client.query(
      "UPDATE products SET title = 'Edited keyboard', price_minor = 777, category_id = 'other', updated_at = CURRENT_TIMESTAMP WHERE id = 'keyboard'",
    );
    await client.query(
      "UPDATE categories SET name = 'Edited category' WHERE id = 'peripherals'",
    );
    await client.query(
      "INSERT INTO products (id, title, description, price_minor) VALUES ('custom', 'Custom product', 'Keep me', 500)",
    );
    await client.query(
      `INSERT INTO carts (id, quantities, revision) VALUES ('saved-cart', '{"keyboard":2,"custom":1}', 7)`,
    );
    const before = (await client.query('SELECT * FROM products ORDER BY id'))
      .rows;
    const beforeCategories = (
      await client.query('SELECT * FROM categories ORDER BY id')
    ).rows;
    const beforeCarts = (await client.query('SELECT * FROM carts')).rows;
    await seedCatalog(client);
    await seedCatalog(client);
    assert.deepEqual(
      (await client.query('SELECT * FROM products ORDER BY id')).rows,
      before,
    );
    assert.deepEqual(
      (await client.query('SELECT * FROM categories ORDER BY id')).rows,
      beforeCategories,
    );
    assert.deepEqual(
      (await client.query('SELECT * FROM carts')).rows,
      beforeCarts,
    );
  } finally {
    await client.query('SET search_path TO public');
    if (!/^seed_test_[0-9a-f]{12}$/.test(schema))
      throw new Error('Unexpected cleanup schema');
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  }
});
