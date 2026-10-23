import { Client } from 'pg';
import { config } from 'dotenv';
import { pathToFileURL } from 'node:url';

const categories = [
  { id: 'peripherals', name: 'Периферия', slug: 'peripherals' },
  { id: 'monitors', name: 'Мониторы', slug: 'monitors' },
  { id: 'other', name: 'Прочее', slug: 'other' },
];

const products = [
  {
    id: 'keyboard',
    title: 'Split keyboard',
    description: 'A split keyboard for a comfortable desktop workspace.',
    priceMinor: 14900,
    badge: 'new',
    categoryId: 'peripherals',
  },
  {
    id: 'monitor',
    title: 'Portable monitor',
    description:
      'A portable monitor for an additional screen at home or on the move.',
    priceMinor: 22900,
    badge: null,
    categoryId: 'monitors',
  },
  {
    id: 'dock',
    title: 'USB-C dock',
    description: 'A USB-C dock for connecting desktop peripherals.',
    priceMinor: 11900,
    badge: 'team pick',
    categoryId: 'peripherals',
  },
];

// The caller owns the connected client. All inserts are atomic and preserve existing rows.
export async function seedCatalog(client) {
  await client.query('BEGIN');
  try {
    for (const category of categories) {
      await client.query(
        'INSERT INTO categories (id, name, slug) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
        [category.id, category.name, category.slug],
      );
    }
    for (const product of products) {
      await client.query(
        'INSERT INTO products (id, title, description, price_minor, currency, badge, category_id) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING',
        [
          product.id,
          product.title,
          product.description,
          product.priceMinor,
          'USD',
          product.badge,
          product.categoryId,
        ],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  config({ quiet: true });
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString)
    throw new Error('DATABASE_URL is required to seed the catalog.');
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await seedCatalog(client);
    console.log('Catalog seed complete. Existing records were preserved.');
  } finally {
    await client.end();
  }
}
