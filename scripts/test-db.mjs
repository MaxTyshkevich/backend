import { spawnSync } from 'node:child_process';
import { config } from 'dotenv';
config({ quiet: true });

const url = process.env.TEST_DATABASE_URL || `postgresql://microfronts:local-test-only@127.0.0.1:${process.env.POSTGRES_TEST_PORT || 5434}/microfronts_test?schema=public`;
const parsed = new URL(url);
if (!['localhost', '127.0.0.1', 'db-test'].includes(parsed.hostname) || parsed.pathname !== '/microfronts_test') {
  throw new Error('Tests require an isolated local database named microfronts_test. Never use the development/production URL.');
}
const env = { ...process.env, NODE_ENV: 'test', DATABASE_URL: url, TEST_DATABASE_URL: url };
const run = args => {
  const result = spawnSync(process.execPath, args, { env, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
};
run(['node_modules/prisma/build/index.js', 'generate']);
run(['node_modules/prisma/build/index.js', 'migrate', 'deploy']);
const [kind, ...extra] = process.argv.slice(2);
if (kind === 'server') {
  const { Client } = await import('pg');
  const client = new Client({ connectionString: url });
  await client.connect();
  try { await client.query('TRUNCATE sessions, guest_claims, carts, auth_attempts, users CASCADE'); }
  finally { await client.end(); }
  Object.assign(process.env, env);
  await import('../dist/main.js');
} else {
  run(['--experimental-vm-modules', 'node_modules/jest/bin/jest.js', ...(kind === 'e2e' ? ['--config', 'test/jest-e2e.json'] : []), '--runInBand', ...extra.filter(arg => arg !== '--runInBand')]);
}
