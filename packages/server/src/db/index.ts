import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { Database } from 'bun:sqlite';
import * as schema from './schema';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

if (process.env.NODE_ENV == 'test') {
	process.env.DATABASE_PATH = ':memory:';
} else if (!process.env.DATABASE_PATH) {
	process.env.DATABASE_PATH = '../../data/sqlite.db';
}

if (process.env.DATABASE_PATH !== ':memory:') {
	const dbDirectory = dirname(process.env.DATABASE_PATH);

	if (!existsSync(dbDirectory)) {
		mkdirSync(dbDirectory, { recursive: true });
	}
}

const sqlite = new Database(process.env.DATABASE_PATH);

export const db = drizzle({
	client: sqlite,
	schema,
});

export const migrateDb = async () => {
	migrate(db, {
		migrationsFolder: './drizzle',
	});
};
