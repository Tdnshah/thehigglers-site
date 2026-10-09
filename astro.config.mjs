import node from "@astrojs/node";
import react from "@astrojs/react";
import { defineConfig, fontProviders, sessionDrivers } from "astro/config";
import emdash, { local } from "emdash/astro";
import { postgres, sqlite } from "emdash/db";
import { emdashSmtp } from "emdash-smtp";
import { formsPlugin } from "@emdash-cms/plugin-forms";

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

  // @astrojs/node's default session driver bakes an ABSOLUTE path
  // (fileURLToPath against the build machine's astroConfig.cacheDir) into
  // the compiled server bundle -- on CI that's the GitHub Actions runner's
  // checkout path, which doesn't exist on the deploy target, so every
  // session write throws ENOENT and login (passkey/magic-link/OAuth all use
  // sessions) breaks silently in production. Overriding with our own
  // fsLite driver and a RELATIVE base path fixes this: unstorage's fs
  // driver resolves a relative `base` via path.resolve() at driver-init
  // time, which happens at server startup (real runtime), not build time --
  // so it resolves against process.cwd() on the actual server (PM2 sets
  // cwd to the deploy path). The directory is auto-created on first write.
  session: {
    driver: sessionDrivers.fsLite({ base: "./node_modules/.astro/sessions" }),
  },

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
          // Enables the email pipeline (magic links, invites, recovery).
          // Actual SMTP/provider credentials are entered in the admin under
          // Settings -> Email after deploying, not here.
          plugins: [emdashSmtp(), formsPlugin()],
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