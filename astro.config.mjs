import node from "@astrojs/node";
import react from "@astrojs/react";
import { defineConfig, fontProviders } from "astro/config";
import emdash, { local } from "emdash/astro";
import { sqlite } from "emdash/db";

export default defineConfig({
  output: "server",

  adapter: node({
      mode: "standalone",
	}),

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
          database: sqlite({ url: process.env.DATABASE_URL ?? "file:./data.db" }),
          storage: local({
              directory: process.env.UPLOADS_DIR ?? "./uploads",
              baseUrl: "/_emdash/api/media/file",
          }),
      }),
	],

  devToolbar: { enabled: false },

  vite: {
    server: {
			watch: {
				usePolling: true,
				interval: 100,
			},
		},
  },
});