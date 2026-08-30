# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

This is a Bun workspace monorepo (`packages/server`, `packages/app`). Root scripts run across both via `bun --filter`.

```bash
bun install                       # from repo root
bun run dev                       # root: runs `dev` in both packages in parallel (server on :3000, vite on :5173 w/ proxy)
```

**Server** (`packages/server`, Elysia + Bun + Drizzle/SQLite):
```bash
bun run --cwd packages/server dev              # bun --watch src/index.ts
bun run --cwd packages/server test             # NODE_ENV=test bun test --preload ./src/tests/setup.ts
bun test --preload ./src/tests/setup.ts src/api/groups.test.ts   # single file, run from packages/server
bun run --cwd packages/server build            # bun build src/index.ts --outdir dist --target bun
```
No real network/root privileges are needed for `dev` or `test` — see "Dev shim" below. There is no server-side
typecheck script; `tsc -p packages/server/tsconfig.json` currently fails (TS7 removed `moduleResolution: "node"`,
pre-existing, unrelated to app code) and isn't part of the workflow. Bun's own build/test strip types without
fully checking them, so `bun run --cwd packages/app type-check` (below) is the closest thing to a server-side
typecheck, since it transitively resolves the whole Elysia plugin chain through the `App` type (see Architecture).

**App** (`packages/app`, Vue 3 + Vite + Tailwind v4):
```bash
bun run --cwd packages/app dev            # vite dev server, proxies /api -> localhost:3000
bun run --cwd packages/app build          # type-check + vite build
bun run --cwd packages/app type-check     # bun scripts/type-check.mjs --build - see the file's header comment for why
                                            # this isn't just `vue-tsc --build` (TS7 + Bun interop workarounds)
```
No app-level tests exist.

**Database** (`packages/server`, drizzle-kit, SQLite):
```bash
bun run --cwd packages/server drizzle-kit generate   # after editing src/db/schema.ts - writes drizzle/000N_*.sql
```
Migrations run automatically on server boot (`migrateDb()` in `src/index.ts`). `DATABASE_PATH` defaults to
`../../data/sqlite.db` relative to the server's CWD (`:memory:` under `NODE_ENV=test`).

Formatting: Prettier, tabs, single quotes, 250-char print width (`.prettierrc`). No lint script configured.

## Architecture

### Two packages, one type contract, no codegen

The frontend never calls a generated client or a hand-maintained schema package. `packages/app` depends on
`@wg-manager/server: workspace:*` and both tsconfigs alias `@server/*` -> `packages/server/src/*`, so
`packages/app/src/queries/edenClient.ts` does `treaty<App>(...)` (Eden Treaty) against
`export type App = typeof _app` from `packages/server/src/index.ts` directly. This means:
- **Adding/changing a server route or its TypeBox (`t.Object(...)`) schema changes the frontend's types
  immediately**, with no build step in between.
- The frontend also imports DB row types directly (`import type { Peer } from '@server/db/schema'`) instead of
  duplicating them.
- There is no shared runtime validation - Elysia's `t.*` validates on the server; the app hand-rolls its own
  matching client-side validation in each modal component (e.g. `ServerModal.vue`, `PeerModal.vue`). Keep both in
  sync by hand when changing a field's constraints.

### Server: Elysia plugin composition

`packages/server/src/index.ts` composes route plugins from `src/api/*.ts` (each an `Elysia` instance, e.g.
`serversRoutes`, `serversPeersRoute`, `peersRoutes`, `groupsRoutes`) under `.group('/api/v1', ...)`, in front of a
static-file plugin serving `packages/app/dist` with an SPA fallback. Because `App` is `typeof _app`, TypeScript
must fully resolve every plugin's types to type-check anything that imports `App` - in practice this means the
app's typecheck (`type-check` above) transitively validates most of the server too.

**Auth** (`src/api/auth.ts`) is a single Elysia macro, `verifyAuth: { scope: 'admin' | 'server' | 'peer' }`, with
no user table: a bearer token either equals `process.env.ADMIN_TOKEN` (god-mode) or matches the `authToken`
column on the row named by `params.id` for that scope (`serverPeers.authToken` or `peers.authToken` - each row
carries its own credential, generated with `nanoid(32)`). A `server`-scoped token therefore authorizes every
route parameterized by that server's id, including all of its peers and groups.

### Persistence: Drizzle + SQLite, no shared-schema layer

`src/db/schema.ts` defines four tables: `serverPeersTable` (one per WireGuard interface/server), `peersTable`
(clients, FK'd to a server), `peerGroupsTable` and `peerGroupRulesTable` (see "Restricted clients" below).
**SQLite foreign-key enforcement is never turned on** (no `PRAGMA foreign_keys = ON` anywhere) - `onDelete`
clauses in the schema are declarative intent only; cascade/cleanup on delete is done by hand in the API handler
(see `DELETE /wg/servers/:id/groups/:groupId` in `src/api/groups.ts` for the pattern: an explicit
`db.transaction(...)` that unassigns members and deletes referencing rules before deleting the row itself).
`bun:sqlite` is a synchronous driver, so `db.transaction()` callbacks are synchronous too (`.run()`, not
`await`).

### The wg/ layer: real vs. shim, and three independent capability axes

`src/wg/shell.ts` is a capability-detecting dispatcher, evaluated once at import time (top-level `await`), that
picks between `shell.real.ts` (actual `wg`/`wg-quick`/`ip`/`nft` invocations) and `shell.shim.ts` (in-memory
fakes) **per capability**, not as a single on/off switch:

| Axis | Probed by | Powers |
|---|---|---|
| `crypto` | `Bun.which('wg')` | `wgGenKey`/`wgGenPsk`/`wgDerivePublicKey` |
| `network` | `wg-quick`+`ip` present, and an actual `ip link add ... type dummy` probe (binaries can exist without `NET_ADMIN`) | `startServer`/`reloadServer`/`stopServer`/`wgShow`/`isInterfaceUp` |
| `firewall` | `nft` present and `nft list tables` actually succeeds | `applyFirewall`/`resetFirewall` |

In production (`NODE_ENV=production`), missing any capability throws on boot unless `WG_DEV_SHIM=true` is set
explicitly - it will not silently fall back to shimmed behavior. Outside production, each missing capability
logs a warning and shims just that axis. **When adding a new exported function to this layer, add it to all
three files (`shell.ts`, `shell.real.ts`, `shell.shim.ts`) and to the `mock.module('@server/wg/shell', ...)`
block in `src/tests/setup.ts`**, which replaces the whole module for every test - a function missing there is
`undefined` in every test.

Local dev/tests never need root or real WireGuard tooling: `WG_DEV_SHIM=true bun run dev` (or just running
outside a privileged container) exercises the full app against the shim.

### Restricted clients: groups, rules, and the firewall as the actual boundary

Peers can optionally belong to a `peerGroup` (`peers.groupId`, nullable - **null means fully unrestricted**,
identical to pre-feature behavior, so ungrouped peers are unaffected by any of this). A group's outbound
reachability is a set of `peerGroupRules` rows, each `(srcGroupId, dstGroupId | dstCidr)` - i.e. a directional
group -> group or group -> CIDR allow list, replaced wholesale per group via `PUT
/wg/servers/:id/groups/:groupId/rules` (delete-then-insert in one transaction).

**The client's own WireGuard config (`AllowedIPs`, in `src/wg/config.ts`) is a routing hint only, never the
enforcement boundary** - a client owns that file and can edit it. The actual boundary is a single nftables
`table inet wgmgr` generated by `src/wg/firewall.ts` and applied atomically (`table {}; delete table; table {...}`)
across *all* servers at once on every relevant mutation (`syncFirewall()`, called from peer/server/group CRUD
handlers and from `wgManager` start/stop). Read the top-of-file comments in `firewall.ts` before touching it -
notable non-obvious invariants: nft object names are ordinal (`s{serverIdx}g{groupIdx}`), never derived from
nanoid ids or `interfaceName`, because those don't satisfy nft's identifier charset; the diagonal
(group -> itself) is a real, separate toggle - two peers in the same group cannot reach each other unless it's
set; and enabling a server's `enableNat` must not silently grant ungrouped peers internet access (there's an
explicit forward-chain guard for this - see the comment above `egressGuard` in `firewall.ts`).

`src/wg/firewall.ts` splits into a pure `buildRuleset(servers: FirewallServer[])` (no db, no io - this is what
`firewall.test.ts` drives directly with fixtures) and a thin `generateFirewallRuleset()`/`syncFirewall()` that
load state from the db and apply it. Keep new test scenarios on the pure function - `bun:sqlite` under
`NODE_ENV=test` is a single in-memory database shared across *all* test files in the same run, so anything
reading "all servers" from the db in a test would pick up fixtures inserted by unrelated test files (this is why
existing fixtures prefix ids per-file, e.g. `serversRouter-server`, `peersRouters-server`, `groupsRouter-server`).

### Frontend: no component library, one design system

`packages/app` is plain Vue 3 SFCs + Tailwind v4 utilities - **read `DESIGN.md` before touching any UI**. It
documents the "operator terminal console" system in detail (bracketed `[ action ]` buttons, `>` prompt glyphs,
`///` section markers, the `Base*` component set, the token palette in `src/assets/main.css`) and explicitly
lists what not to reach for (no PrimeVue/icon packages/second accent color - both were deliberately removed).
State: TanStack Vue Query for all server state (`src/queries/*.ts`, `queryOptions()` pattern, mutations inline
in the modal components that use them), a single Pinia store for the in-memory (non-persisted) auth token
(`src/stores/auth.ts` - reloading the page logs you out by design).
