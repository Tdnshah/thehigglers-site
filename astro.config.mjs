import node from "@astrojs/node";
import react from "@astrojs/react";
import { defineConfig, fontProviders } from "astro/config";
import emdash, { local } from "emdash/astro";
import { postgres, sqlite } from "emdash/db";

// Local dev uses the SQLite file (no DATABASE_URL set). Production Docker
// builds pass a Postgres connection string as a build-time env var (see
// Dockerfile) -- picked automatically since it's the only "postgres:"/
// "postgresql:" URL that would ever be set here.
const databaseUrl = process.env.DATABASE_URL;
const database =
  databaseUrl && /^postgres(ql)?:/.test(databaseUrl)
    ? postgres({ connectionString: databaseUrl })
    : sqlite({ url: databaseUrl ?? "file:./data.db" });

export default defineConfig({
  output: "server",

  adapter: node({
      mode: "standalone",
	}),

  // Reverse-proxy deployment (Nginx/Apache -> localhost:3233): Astro only
  // trusts X-Forwarded-* headers for allowed hostnames, and Vite's dev-mode
  // Host check needs the same hostname allow-listed. Without this, EmDash
  // computes the internal http://localhost:3233 origin instead of the public
  // https://thehigglers.com one, which breaks passkey/WebAuthn verification.
  security: {
    allowedDomains: [{ hostname: "thehigglers.com", protocol: "https" }],
  },

  image: {
      layout: "constrained",
      responsiveStyles: true,
	},

  fonts: [
      {
          provider: fontProviders.google(),
          name: "Space Mono",
          cssVariable: "--font-mono",
          weights: [400, 700],
      },
	],

  integrations: [
      react(),
      emdash({
          database,
          storage: local({
              directory: process.env.UPLOADS_DIR ?? "./uploads",
              baseUrl: "/_emdash/api/media/file",
          }),
      }),
	],

  devToolbar: { enabled: false },

  vite: {
    server: {
			allowedHosts: ["thehigglers.com"],
			watch: {
				usePolling: true,
				interval: 100,
			},
		},
  },
});