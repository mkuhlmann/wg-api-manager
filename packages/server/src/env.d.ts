declare module 'bun' {
	interface Env {
		DATABASE_PATH?: string;
		ADMIN_TOKEN: string;
		/** Force ('true') or forbid ('false') the in-memory wg/network dev shim. Unset auto-detects. */
		WG_DEV_SHIM?: string;
	}
}
