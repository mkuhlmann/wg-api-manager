import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { Database } from 'bun:sqlite';
import * as schema from './schema';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const dbPath = '../../data';
const dbFile = join(dbPath, 'sqlite.db');

if (!existsSync(dbPath)) {
	mkdirSync(dbPath, { recursive: true });
}

const sqlite = new Database(dbFile);

export const db = drizzle({
	client: sqlite,
	schema,
});

export const migrateDb = async () => {
	migrate(db, {
		migrationsFolder: './drizzle',
	});
};
