/** Estimated reading time from Portable Text content -- real word count, not a fabricated number. */
export function estimateReadingMinutes(content: unknown, wordsPerMinute = 200): number {
	if (!Array.isArray(content)) return 1;

	let words = 0;
	for (const block of content) {
		if (!block || typeof block !== "object") continue;
		const children = (block as { children?: unknown }).children;
		if (!Array.isArray(children)) continue;

		for (const child of children) {
			const text = (child as { text?: unknown; _text?: unknown })?.text ??
				(child as { text?: unknown; _text?: unknown })?._text;
			if (typeof text === "string") {
				words += text.trim().split(/\s+/).filter(Boolean).length;
			}
		}
	}

	return Math.max(1, Math.round(words / wordsPerMinute));
}
