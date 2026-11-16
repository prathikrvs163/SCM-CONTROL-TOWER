import { config } from 'dotenv';

/**
 * Connection string for the API-test database.
 *
 * Uses DATABASE_URL_TEST when set; otherwise derives it from DATABASE_URL by
 * appending `_test` to the database name. Refuses any database whose name
 * does not end in `_test`, because the tests truncate every table.
 */
export function getTestDatabaseUrl(): string {
  config({ quiet: true });

  const explicit = process.env.DATABASE_URL_TEST;
  const base = explicit ?? process.env.DATABASE_URL;

  if (!base) {
    throw new Error(
      'Set DATABASE_URL (or DATABASE_URL_TEST) in backend/.env to run API tests.',
    );
  }

  const url = new URL(base);
  const databaseName = decodeURIComponent(url.pathname.slice(1));

  if (!explicit) {
    url.pathname = `/${encodeURIComponent(`${databaseName}_test`)}`;
  }

  const testDatabaseName = decodeURIComponent(url.pathname.slice(1));

  if (!testDatabaseName.endsWith('_test')) {
    throw new Error(
      `Refusing to run API tests against "${testDatabaseName}": the database name must end with "_test".`,
    );
  }

  return url.toString();
}

export function describeDatabase(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  return `${url.hostname}:${url.port || 3306}${url.pathname}`;
}
