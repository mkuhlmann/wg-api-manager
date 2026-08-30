#!/usr/bin/env bun
// Type-checks the app (including .vue files) against a classic TypeScript
// compiler under Bun. Two separate problems make `vue-tsc --build` unusable
// as-is here:
//
// 1. TypeScript 7's `typescript` package ships a native-binary shim at
//    `lib/tsc.js` with no classic compiler source in it, so vue-tsc (which
//    patches the classic tsc.js text to inject its Vue language plugin)
//    can't run against it at all. We keep `typescript` itself on 7.x for
//    everything else and use the `typescript-classic` alias (typescript
//    6.x, the last classic-compiler release) for type-checking instead.
//
// 2. Independent of TS7: vue-tsc injects its patch by monkeypatching
//    Node's `fs.readFileSync` and relying on the CJS loader to call it
//    while `require()`-ing the compiler. Bun's `require()` doesn't route
//    through that patched function, so under Bun the patch silently never
//    applies and `.vue` imports fail to resolve (`vue-tsc --build` fails
//    the same way even on a plain TS 5.x/6.x setup — this isn't new).
//
// So instead of calling vue-tsc's own `run()`, this reimplements its
// small wrapper (see vue-tsc's `index.js` and @volar/typescript's
// `quickstart/runTsc.js`, both still used for the actual patching logic),
// but applies the patch by writing a transformed copy of the compiler to
// disk and `require()`-ing that real file, which works the same under
// Bun and Node. Remove this once vue-tsc supports both TS7 and Bun.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const runTscModule = require('@volar/typescript/lib/quickstart/runTsc');
const { transformTscContent } = runTscModule;
const vueLanguageCore = require('@vue/language-core');

const windowsPathRE = /\\/g;
const retryToken = new Error('[Vue] Extensions changed');
const runExtensions = new Set(['vue']);

function getLanguagePlugins(ts, options) {
	const { configFilePath } = options.options;
	const vueOptions =
		typeof configFilePath === 'string'
			? vueLanguageCore.createParsedCommandLine(ts, ts.sys, configFilePath.replace(windowsPathRE, '/')).vueOptions
			: vueLanguageCore.createParsedCommandLineByJson(ts, ts.sys, (options.host ?? ts.sys).getCurrentDirectory(), {}).vueOptions;
	const allExtensions = vueLanguageCore.getAllExtensions(vueOptions);
	if (allExtensions.every((ext) => runExtensions.has(ext))) {
		const vueLanguagePlugin = vueLanguageCore.createVueLanguagePlugin(ts, options.options, vueOptions, (id) => id);
		return { languagePlugins: [vueLanguagePlugin] };
	}
	for (const ext of allExtensions) runExtensions.add(ext);
	throw retryToken;
}

function runOnce(tscPath) {
	const proxyApiPath = require.resolve('@volar/typescript/lib/node/proxyCreateProgram');
	const dir = path.dirname(tscPath);
	let raw = fs.readFileSync(tscPath, 'utf8');

	let patched;
	try {
		patched = transformTscContent(raw, proxyApiPath, [...runExtensions], []);
	} catch {
		// tsc.js may just be a shim requiring the real compiler file (the
		// pattern @volar/typescript already special-cases for TS >=5.7).
		const requireRegex = /module\.exports\s*=\s*require\((?:"|')(?<path>\.\/\w+\.js)(?:"|')\)/;
		const requirePath = requireRegex.exec(raw)?.groups?.path;
		if (!requirePath) throw new Error(`Failed to locate the classic compiler source from ${tscPath}`);
		raw = fs.readFileSync(path.join(dir, requirePath), 'utf8');
		patched = transformTscContent(raw, proxyApiPath, [...runExtensions], []);
	}

	const patchedPath = path.join(dir, '.vue-tsc-classic-patched.cjs');
	fs.writeFileSync(patchedPath, patched);
	runTscModule.getLanguagePlugins = getLanguagePlugins;
	// The classic compiler calls process.exit() once it's done, so a normal
	// try/finally here never runs — clean up on the 'exit' event instead.
	process.on('exit', () => {
		try {
			fs.rmSync(patchedPath, { force: true });
		} catch {}
	});
	require(patchedPath);
}

const tscPath = require.resolve('typescript-classic/lib/tsc');

for (;;) {
	try {
		runOnce(tscPath);
		break;
	} catch (err) {
		if (err !== retryToken) throw err;
	}
}
