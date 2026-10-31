import { Client } from 'pg';
import { config } from 'dotenv';
import { randomBytes, scryptSync } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { products, seedCatalog } from './seed.mjs';

export function localDemoUrl(connectionString) {
  const url = new URL(connectionString || '');
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.pathname !== '/microfronts'
  ) {
    throw new Error(
      'Demo seed requires the local development database microfronts.',
    );
  }
  return url;
}

const names = ['Алексей', 'Мария', 'Дмитрий', 'Анна', 'Иван'];
const texts = [
  'Использую в домашнем офисе, удобно для ежедневной работы.',
  'Хорошо вписался в рабочее место. Покупкой доволен.',
  'Проверила основные функции, всё работает как ожидалось.',
  'Понравилось качество сборки и простая настройка.',
  'Пользуюсь несколько дней, первые впечатления положительные.',
];

// The caller owns the connection. Stable IDs make repeated runs additive.
export async function seedDemo(client, password) {
  if (
    typeof password !== 'string' ||
    password.length < 12 ||
    password.length > 128
  ) {
    throw new Error('DEMO_PASSWORD must contain 12–128 characters.');
  }
  await seedCatalog(client);
  await client.query('BEGIN');
  try {
    for (let i = 0; i < names.length; i++) {
      const id = `d3e00000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync(password, salt, 64, {
        N: 32768,
        r: 8,
        p: 1,
        maxmem: 64 * 1024 * 1024,
      }).toString('hex');
      const existing = await client.query(
        'SELECT id, email FROM users WHERE id = $1 OR email = $2',
        [id, `demo${i + 1}@example.test`],
      );
      if (
        existing.rows.some(
          (row) => row.id !== id || row.email !== `demo${i + 1}@example.test`,
        )
      ) {
        throw new Error(
          'Demo account identifier collision; existing accounts were preserved.',
        );
      }
      await client.query(
        'INSERT INTO users (id, email, name, password_hash) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
        [id, `demo${i + 1}@example.test`, names[i], `${salt}:${hash}`],
      );
      await client.query(
        'INSERT INTO profiles (user_id, bio) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING',
        [id, 'Демонстрационный профиль для проверки магазина.'],
      );
    }
    for (let i = 0; i < 60; i++) {
      const authorIndex = (i + Math.floor(i / products.length)) % names.length;
      const userId = `d3e00000-0000-4000-8000-${String(authorIndex + 1).padStart(12, '0')}`;
      await client.query(
        'INSERT INTO comments (id, product_id, user_id, text) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
        [
          `d3c00000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
          products[i % products.length].id,
          userId,
          texts[authorIndex],
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
  const url = localDemoUrl(process.env.DATABASE_URL);
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  try {
    await seedDemo(client, process.env.DEMO_PASSWORD);
    console.log(
      'Local demo seed complete: 30 products, 5 users/profiles and 60 comments. Existing records preserved.',
    );
  } finally {
    await client.end();
  }
}
