#!/usr/bin/env node
/**
 * Compare a running EmDash instance's schema with a seed file and (optionally)
 * bring it in line. EmDash only applies a seed to an EMPTY database, and on
 * restart it only creates brand-new block types, so changes to existing
 * collections, fields and block types never reach an already-bootstrapped
 * site by themselves. This script closes that gap.
 *
 * It handles:
 *   1. collection fields that exist in the seed but not on the site (adds them)
 *   2. block types missing from the site (creates them at version 1)
 *   3. block types whose fields differ from the seed (amends the active version)
 *   4. the `pages.layout` blocks field allowed types
 * Steps run in that order, so a layout never allows a block type that does not
 * exist yet. Block types cannot be deleted in EmDash, so review the dry run.
 *
 * DRY RUN by default. Nothing is written unless you pass --apply.
 *
 * Usage:
 *   node scripts/sync-schema.mjs                                   # local dev, dry run
 *   node scripts/sync-schema.mjs --apply                           # local dev, write
 *   EMDASH_TOKEN=... node scripts/sync-schema.mjs \
 *     --url https://thehigglers.com --seed seed/seed.prod.json     # production, dry run
 *   EMDASH_TOKEN=... node scripts/sync-schema.mjs \
 *     --url https://thehigglers.com --seed seed/seed.prod.json --apply
 *
 * Localhost needs no token (dev bypass). Anything else needs EMDASH_TOKEN
 * (an API token with schema/admin scope). Never paste the token into a file.
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

// ---- auth + request helper ---------------------------------------------------
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

// Canonical form so key order and server-added metadata do not look like drift.
const canon = (value) => {
	if (Array.isArray(value)) return value.map(canon);
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.keys(value)
				.sort()
				.map((key) => [key, canon(value[key])]),
		);
	}
	return value;
};
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const FIELD_KEYS = ["slug", "label", "type", "required", "unique", "searchable", "indexed", "translatable", "defaultValue", "validation", "options", "widget"];
const pickField = (f) => Object.fromEntries(FIELD_KEYS.filter((k) => f[k] !== undefined).map((k) => [k, f[k]]));

// ---- preflight: fail clearly on auth/scope problems instead of guessing -----------
// Block types need a broader token scope than collections, so probe both. A 401/403
// must never be reported as "missing".
const describe = (res) => `HTTP ${res.status}${res.json?.error?.code ? ` ${res.json.error.code}` : ""}`;
for (const [label, path, hint] of [
	["collections", "/schema/collections", "needs schema:read"],
	["block types", "/schema/block-types", 'needs the "admin" scope (and an admin user)'],
]) {
	const res = await call("GET", path);
	if (res.status === 401 || res.status === 403) {
		console.error(`Cannot read ${label} (${describe(res)}): the token is invalid, expired, or lacks permission (${hint}).`);
		console.error("Create a new token in Settings -> API Tokens with the right scopes, then re-run.");
		process.exit(1);
	}
	if (!res.ok) {
		console.error(`Cannot read ${label} (${describe(res)}). Check --url and that the site is up.`);
		process.exit(1);
	}
}

// ---- build the plan ----------------------------------------------------------
const plan = [];
const notes = [];

for (const collection of seed.collections ?? []) {
	const res = await call("GET", `/schema/collections/${collection.slug}/fields`);
	if (res.status === 404) {
		notes.push(`collection "${collection.slug}": not found on site; create it in the admin first`);
		continue;
	}
	if (!res.ok) {
		notes.push(`collection "${collection.slug}": could not read (${describe(res)}); skipped`);
		continue;
	}
	const existing = new Map((res.json?.data?.items ?? []).map((f) => [f.slug, f]));
	// Report (never remove) fields that exist on the site but not in the seed.
	const seedSlugs = new Set(collection.fields.map((f) => f.slug));
	for (const slug of existing.keys()) {
		if (!seedSlugs.has(slug)) {
			notes.push(`field ${collection.slug}.${slug} exists on the site but not in the seed (left alone; removing a field deletes its data, so check it first)`);
		}
	}
	for (const field of collection.fields) {
		const live = existing.get(field.slug);
		if (!live) {
			plan.push({
				phase: 1,
				label: `add field ${collection.slug}.${field.slug} (${field.type})`,
				run: () => call("POST", `/schema/collections/${collection.slug}/fields`, pickField(field)),
			});
		} else if (field.type === "blocks" && !same(field.validation?.allowedTypes, live.validation?.allowedTypes)) {
			plan.push({
				phase: 4,
				label: `set ${collection.slug}.${field.slug} allowed types -> ${field.validation.allowedTypes.join(", ")}`,
				run: () =>
					call("PUT", `/schema/collections/${collection.slug}/fields/${field.slug}`, {
						validation: {
							allowedTypes: field.validation.allowedTypes,
							minItems: field.validation.minItems ?? 0,
							maxItems: field.validation.maxItems ?? 30,
						},
					}),
			});
		}
	}
}

for (const block of seed.blockTypes ?? []) {
	const res = await call("GET", `/schema/block-types/${block.slug}`);
	if (res.status === 404) {
		const fields = (block.versions.find((v) => v.version === block.currentVersion) ?? block.versions[0]).fields;
		if (block.currentVersion !== 1 || block.versions.length !== 1) {
			notes.push(`block type "${block.slug}": missing on site and the seed has several versions; create it deliberately in the admin or via the API`);
			continue;
		}
		plan.push({
			phase: 2,
			label: `create block type ${block.slug} (${fields.length} fields)`,
			run: () =>
				call("POST", "/schema/block-types", {
					slug: block.slug,
					label: block.label,
					...(block.category ? { category: block.category } : {}),
					...(block.icon ? { icon: block.icon } : {}),
					fields,
				}),
		});
		continue;
	}
	const live = res.json?.data?.item;
	if (!res.ok || !live) {
		notes.push(`block type "${block.slug}": could not read (${describe(res)}); skipped`);
		continue;
	}
	const seedVersion = block.versions.find((v) => v.version === block.currentVersion) ?? block.versions.at(-1);
	const liveVersion = live.versions.find((v) => v.version === live.currentVersion);
	if (live.currentVersion !== block.currentVersion) {
		notes.push(`block type "${block.slug}": site is on version ${live.currentVersion}, seed on ${block.currentVersion}; needs a deliberate version activation`);
		continue;
	}
	if (!same(seedVersion.fields, liveVersion.fields)) {
		plan.push({
			phase: 3,
			label: `amend block type ${block.slug} v${live.currentVersion} (fields differ from seed)`,
			run: () =>
				call("PUT", `/schema/block-types/${block.slug}`, {
					fields: seedVersion.fields,
					expectedFingerprint: liveVersion.fingerprint,
				}),
		});
	}
}

plan.sort((a, b) => a.phase - b.phase);

// ---- report / apply ----------------------------------------------------------
console.log(`Site: ${base}\nSeed: ${args.seed}\nMode: ${args.apply ? "APPLY" : "dry run (add --apply to write)"}\n`);
for (const note of notes) console.log(`  note: ${note}`);

if (plan.length === 0) {
	console.log(notes.length ? "\nNo automatic changes to make." : "In sync. Nothing to do.");
	process.exit(0);
}

console.log(`\n${plan.length} change(s):`);
for (const step of plan) console.log(`  - ${step.label}`);

if (!args.apply) process.exit(0);

console.log("");
let failed = 0;
for (const step of plan) {
	const res = await step.run();
	console.log(`${res.ok ? "ok  " : "FAIL"} ${step.label}${res.ok ? "" : ` -> ${res.status} ${JSON.stringify(res.json?.error ?? res.json).slice(0, 200)}`}`);
	if (!res.ok) {
		failed++;
		// Later steps may depend on this one (e.g. the layout needs the block types).
		console.log("Stopping at the first failure. Fix it and re-run; finished steps are skipped automatically.");
		break;
	}
}
process.exit(failed ? 1 : 0);
