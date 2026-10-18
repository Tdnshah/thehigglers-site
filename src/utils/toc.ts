/** Table of contents from Portable Text headings (h2 and h3). Ids are stable and unique per post. */
export interface TocItem {
	id: string;
	text: string;
	level: 2 | 3;
}

type PtNode = { _type?: string; style?: string; children?: Array<{ text?: unknown }>; _tocId?: string };

const slugify = (text: string) =>
	text
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^\p{L}\p{N}]+/gu, "-")
		.replace(/^-+|-+$/g, "") || "section";

/**
 * Walks the content, tags each h2/h3 node with `_tocId` (read by TocHeading.astro)
 * and returns the matching list. Mutates the in-memory nodes only, so the editor's
 * visual-editing metadata on the array stays intact.
 */
export function buildToc(content: unknown): TocItem[] {
	if (!Array.isArray(content)) return [];
	const used = new Map<string, number>();
	const items: TocItem[] = [];

	for (const node of content as PtNode[]) {
		if (node?._type !== "block" || (node.style !== "h2" && node.style !== "h3")) continue;
		const text = (node.children ?? []).map((c) => (typeof c.text === "string" ? c.text : "")).join("").trim();
		if (!text) continue;

		const base = slugify(text);
		const n = (used.get(base) ?? 0) + 1;
		used.set(base, n);
		const id = n === 1 ? base : `${base}-${n}`;

		node._tocId = id;
		items.push({ id, text, level: node.style === "h2" ? 2 : 3 });
	}
	return items;
}
