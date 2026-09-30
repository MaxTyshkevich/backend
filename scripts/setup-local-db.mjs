import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';

const root = fileURLToPath(new URL('../', import.meta.url));
const path = resolve(root, '.env');
const old = existsSync(path) ? readFileSync(path, 'utf8') : '';
const values = parse(old);
if ((values.DATABASE_URL || values.POSTGRES_PASSWORD) && !process.argv.includes('--configure-local')) {
  if (!values.DATABASE_URL || !values.POSTGRES_PASSWORD) {
    throw new Error('Incomplete local database settings. To replace them (a backup is kept), run npm run db:setup -- --configure-local. This does not change an existing database password.');
  }
  console.log('Existing database settings kept. See docs/DATABASE_GUIDE.md to change credentials.');
} else {
  if (old) copyFileSync(path, resolve(root, `.env.before-postgres-${Date.now()}`));
  const password = randomBytes(24).toString('hex');
  const port = values.POSTGRES_PORT || '5432';
  const defaults = [
    !values.PORT ? 'PORT=3000' : '',
    !values.CORS_ORIGINS ? 'CORS_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:5175' : '',
    !values.POSTGRES_PORT ? `POSTGRES_PORT=${port}` : '',
    `POSTGRES_PASSWORD=${password}`,
    `DATABASE_URL=postgresql://microfronts:${password}@localhost:${port}/microfronts?schema=public`,
  ].filter(Boolean);
  const kept = old.split(/\r?\n/).filter(line => !/^\s*(DATABASE_URL|POSTGRES_PASSWORD|APP_DB_PATH)\s*=/.test(line)).join('\n');
  writeFileSync(path, `${kept.trimEnd()}\n${defaults.join('\n')}\n`, { encoding: 'utf8', mode: 0o600 });
  console.log('Local .env configured with a random password (not printed). Next: npm run db:up, npm run db:deploy.');
}
