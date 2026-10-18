#!/usr/bin/env node
/**
 * Move stored blocks to the block type's active version.
 *
 * After sync-schema.mjs activates a new block version (e.g. card_grid v2), blocks
 * already saved on pages keep their old `_version` and the editor keeps showing
 * the old field definitions for them. This script rewrites `_version` on those
 * blocks (same keys, same values) using `migrateBlocks: true`.
 *
 * It saves the page DRAFT only. It never publishes: the live page keeps rendering
 * the old version, which the site handles, until an editor publishes the page.
 * Pages with an unpublished draft keep their draft changes.
 *
 * DRY RUN by default. Nothing is written unless you pass --apply.
 *
 * Usage:
 *   node scripts/migrate-block-versions.mjs                                   # local dev, dry run
 *   node scripts/migrate-block-versions.mjs --apply                           # local dev, write
 *   EMDASH_TOKEN=... node scripts/migrate-block-versions.mjs \
 *     --url https://thehigglers.com --seed seed/seed.prod.json [--apply]
 *
 * Localhost needs no token (dev bypass). Anything else needs EMDASH_TOKEN
 * (an API token with content write scope). Never paste the token into a file.
 */
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
	options: {
		url: { type: "string", default: "http://localhost:4321" },
		seed: { type: "string", default: "seed/seed.prod.json" },
		apply: { type: "boolean", default: false },
		token: { type: "string" },
	},
});

const base = args.url.replace(/\/$/, "");
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(base);
const token = args.token ?? process.env.EMDASH_TOKEN;
const seed = JSON.parse(readFileSync(args.seed, "utf8"));

const headers = { "content-type": "application/json", "x-emdash-request": "1" };
if (token) {
	headers.authorization = `Bearer ${token}`;
} else if (isLocal) {
	const res = await fetch(`${base}/_emdash/api/auth/dev-bypass`, { redirect: "manual" });
	const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0];
	await res.text().catch(() => {});
	if (cookie) headers.cookie = cookie;
} else {
	console.error("Refusing to talk to a non-local site without EMDASH_TOKEN (or --token).");
	process.exit(1);
}

async function call(method, path, body) {
	const res = await fetch(`${base}/_emdash/api${path}`, {
		method,
		headers,
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const json = await res.json().catch(() => null);
	return { ok: res.ok, status: res.status, json };
}

// Block types that moved past version 1, and the version stored blocks should be on.
const targets = new Map();
for (const block of seed.blockTypes ?? []) {
	if (block.currentVersion <= 1) continue;
	const live = await call("GET", `/schema/block-types/${block.slug}`);
	const item = live.json?.data?.item;
	if (!item || item.currentVersion !== block.currentVersion) {
		console.log(`skip ${block.slug}: the site is on v${item?.currentVersion ?? "?"}, seed on v${block.currentVersion}. Run sync-schema.mjs first.`);
		continue;
	}
	targets.set(block.slug, block.currentVersion);
}
if (targets.size === 0) {
	console.log("No block types to migrate.");
	process.exit(0);
}

// Every collection field of type "blocks" in the seed.
const fields = [];
for (const c of seed.collections ?? []) {
	for (const f of c.fields ?? []) if (f.type === "blocks") fields.push({ collection: c.slug, field: f.slug });
}

console.log(`Site: ${base}\nSeed: ${args.seed}\nMode: ${args.apply ? "APPLY (drafts only, nothing is published)" : "dry run (add --apply to write)"}\n`);

let candidates = 0;
let failed = 0;
for (const { collection, field } of fields) {
	let cursor;
	do {
		const qs = new URLSearchParams({ limit: "100", ...(cursor ? { cursor } : {}) });
		const list = await call("GET", `/content/${collection}?${qs}`);
		if (!list.ok) {
			console.log(`FAIL list ${collection}: ${list.status}`);
			process.exit(1);
		}
		for (const entry of list.json?.data?.items ?? []) {
			const full = await call("GET", `/content/${collection}/${entry.id}`);
			const item = full.json?.data?.item;
			const blocks = item?.data?.[field];
			if (!Array.isArray(blocks)) continue;

			const stale = blocks.filter((b) => targets.has(b._type) && b._version < targets.get(b._type));
			if (stale.length === 0) continue;
			candidates++;
			const summary = stale.map((b) => `${b._type} v${b._version}->v${targets.get(b._type)}`).join(", ");
			console.log(`${collection}/${item.slug} (${item.status}): ${summary}`);
			if (!args.apply) continue;

			const migrated = blocks.map((b) => (stale.includes(b) ? { ...b, _version: targets.get(b._type) } : b));
			const res = await call("PUT", `/content/${collection}/${entry.id}`, {
				data: { [field]: migrated },
				_rev: full.json?.data?._rev,
				migrateBlocks: true,
			});
			console.log(`  ${res.ok ? "ok  " : "FAIL"}${res.ok ? "" : ` ${res.status} ${JSON.stringify(res.json?.error ?? res.json).slice(0, 200)}`}`);
			if (!res.ok) failed++;
		}
		cursor = list.json?.data?.nextCursor ?? undefined;
	} while (cursor);
}

console.log(candidates === 0 ? "Nothing to migrate." : `\n${candidates} page(s) ${args.apply ? "processed" : "need migration"}.`);
process.exit(failed ? 1 : 0);
