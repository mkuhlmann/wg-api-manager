import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	dialect: 'sqlite',
	dbCredentials: {
		url: '../../data/sqlite.db',
	},
	schema: './src/db/schema.ts',
	out: './drizzle',
});
