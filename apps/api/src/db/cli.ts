import { loadEnv } from '../config/env';
import { createDb } from './client';
import { migrateDb } from './migrate';
import { seedDatabase } from './seed';
import { DEMO_PIN, SEED_USERS } from './seed-data';

const command = process.argv[2];
if (command !== 'migrate' && command !== 'seed' && command !== 'setup') {
  console.error('Usage: cli.ts <migrate|seed|setup>');
  process.exit(1);
}

const env = loadEnv();
const db = createDb(env.DATABASE_URL, env.DATABASE_AUTH_TOKEN);

if (command === 'migrate' || command === 'setup') {
  await migrateDb(db);
  console.log('Migrations applied.');
}

if (command === 'seed' || command === 'setup') {
  await seedDatabase(db, Date.now());
  console.log('Seeded. Accounts (mock login by email):');
  for (const u of Object.values(SEED_USERS)) console.log(`  ${u.role.padEnd(8)} ${u.email}`);
  console.log(`Demo PIN for parents A and B: ${DEMO_PIN} (parent C has no PIN).`);
}
