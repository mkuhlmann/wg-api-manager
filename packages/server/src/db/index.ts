import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { Database } from 'bun:sqlite';
import * as schema from './schema';

const sqlite = new Database('../../data/sqlite.db');

export const db = drizzle({
	client: sqlite,
	schema,
});

export const migrateDb = async () => {
	migrate(db, {
		migrationsFolder: './drizzle',
	});
};
