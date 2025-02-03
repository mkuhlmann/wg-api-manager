declare module 'bun' {
	interface Env {
		DATABASE_URL: string;
		ADMIN_TOKEN: string;
	}
}
