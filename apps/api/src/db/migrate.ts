import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/libsql/migrator';
import type { Db } from './client';

const migrationsFolder = fileURLToPath(new URL('./migrations', import.meta.url));

export async function migrateDb(db: Db) {
  await migrate(db, { migrationsFolder });
}
