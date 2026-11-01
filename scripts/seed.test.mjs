import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { Client } from 'pg';
import { products, seedCatalog } from './seed.mjs';
import { seedDemo, localDemoUrl } from './seed-demo.mjs';

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
      products
        .map((product) => ({ id: product.id, category_id: product.categoryId }))
        .sort((a, b) => a.id.localeCompare(b.id)),
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
    assert.equal(products.length, 30);
    await seedDemo(client, 'demo-test-password');
    assert.equal(
      (await client.query('SELECT count(*)::int AS count FROM users')).rows[0]
        .count,
      5,
    );
    assert.equal(
      (await client.query('SELECT count(*)::int AS count FROM profiles'))
        .rows[0].count,
      5,
    );
    assert.equal(
      (await client.query('SELECT count(*)::int AS count FROM comments'))
        .rows[0].count,
      60,
    );
    await client.query(
      "UPDATE profiles SET bio = 'Edited profile' WHERE user_id = 'd3e00000-0000-4000-8000-000000000001'",
    );
    await client.query(
      "UPDATE comments SET text = 'Edited comment' WHERE id = 'd3c00000-0000-4000-8000-000000000001'",
    );
    const snapshot = async () => {
      const rows = [];
      for (const table of [
        'users',
        'profiles',
        'comments',
        'products',
        'carts',
      ]) {
        rows.push(
          (await client.query(`SELECT * FROM ${table} ORDER BY 1`)).rows,
        );
      }
      return rows;
    };
    const beforeDemo = await snapshot();
    await seedDemo(client, 'another-demo-password');
    assert.deepEqual(await snapshot(), beforeDemo);
    await assert.rejects(seedDemo(client, 'short'), /DEMO_PASSWORD/);
  } finally {
    await client.query('SET search_path TO public');
    if (!/^seed_test_[0-9a-f]{12}$/.test(schema))
      throw new Error('Unexpected cleanup schema');
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  }
});

test('demo CLI accepts only the local development database', () => {
  assert.equal(
    localDemoUrl('postgresql://user:pass@localhost:5432/microfronts').pathname,
    '/microfronts',
  );
  for (const url of [
    'postgresql://user:pass@remote/microfronts',
    'postgresql://user:pass@localhost/microfronts_test',
  ]) {
    assert.throws(() => localDemoUrl(url), /local development/);
  }
});
