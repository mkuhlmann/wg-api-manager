declare module 'bun' {
	interface Env {
		DATABASE_PATH?: string;
		ADMIN_TOKEN: string;
	}
}
