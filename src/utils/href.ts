/**
 * Tidies a link typed into a text field so editors can't break a save or a page
 * with a loosely typed address.
 *
 *   https://x.com/a, http://..., mailto:, tel:  -> kept
 *   /work, #section, ?tab=1                      -> kept (site-relative)
 *   www.example.com, example.com/a               -> https://www.example.com
 *   work/project                                 -> /work/project
 *   empty, javascript:, data:, anything with spaces -> undefined (no link)
 */
export function normalizeHref(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const v = value.trim();
	if (!v || /\s/.test(v)) return undefined;

	if (/^(https?:|mailto:|tel:)/i.test(v)) return v;
	if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return undefined; // javascript:, data:, etc.
	if (v.startsWith("//")) return `https:${v}`;
	if (/^[/#?]/.test(v)) return v;
	if (/^[^/]+\.[a-z]{2,}(?::\d+)?(?:[/?#]|$)/i.test(v)) return `https://${v}`;
	return `/${v}`;
}
