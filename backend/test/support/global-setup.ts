import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

import { describeDatabase, getTestDatabaseUrl } from './test-database.js';

/**
 * Bring the test database to the latest schema once per run. `migrate
 * deploy` creates the database if it does not exist and only applies
 * committed migrations; it never touches the development database.
 */
export default function setup() {
  const databaseUrl = getTestDatabaseUrl();
  const backendRoot = resolve(import.meta.dirname, '..', '..');

  console.log(`API tests: migrating ${describeDatabase(databaseUrl)}`);

  execFileSync(
    process.execPath,
    [
      resolve(backendRoot, 'node_modules', 'prisma', 'build', 'index.js'),
      'migrate',
      'deploy',
      '--config',
      'prisma7.config.ts',
    ],
    {
      cwd: backendRoot,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'inherit',
    },
  );
}
