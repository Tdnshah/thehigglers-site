import type { APIRoute } from "astro";
import { getEmDashCollection, getSiteSettings } from "emdash";

// Replaces EmDash's generated pages sitemap for one reason: the home page is the
// CMS page with slug "home" but is served at "/", so it must be listed as "/".
// Everything else mirrors the default: published pages that are not hidden from
// search engines. Posts keep EmDash's own /sitemap-posts.xml.
export const prerender = false;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const GET: APIRoute = async ({ url }) => {
	const settings = await getSiteSettings();
	const site = (settings.url || url.origin).replace(/\/$/, "");
	const { entries } = await getEmDashCollection("pages");

	const urls = entries
		.filter((e) => !(e.data as { seo?: { noIndex?: boolean } }).seo?.noIndex)
		.map((e) => {
			const path = e.id === "home" ? "/" : `/${e.id}`;
			const updated = e.data.updatedAt ? new Date(e.data.updatedAt).toISOString() : null;
			return `  <url>\n    <loc>${esc(site + path)}</loc>${updated ? `\n    <lastmod>${updated}</lastmod>` : ""}\n  </url>`;
		});

	const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
	return new Response(body, {
		headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
	});
};
