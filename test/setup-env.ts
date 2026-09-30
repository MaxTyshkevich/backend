// Fail closed even if Jest is invoked directly rather than through npm scripts.
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl)
  throw new Error(
    'Run tests with npm test / npm run test:e2e after npm run db:test:up.',
  );
const parsed = new URL(testUrl);
if (
  !['localhost', '127.0.0.1', 'db-test'].includes(parsed.hostname) ||
  parsed.pathname !== '/microfronts_test'
) {
  throw new Error('Refusing to run tests against a non-test database.');
}
process.env.DATABASE_URL = testUrl;
