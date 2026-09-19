# Deploying to Dokploy

This site deploys to Dokploy (`platform.thehigglers.com`) as a Dockerfile-based
Application, with SQLite + uploaded media on persistent volumes. Dokploy
rebuilds and redeploys automatically on every push to `master`.

CI (`.github/workflows/ci.yml`) only runs typecheck + build checks on
PRs/pushes -- it does not deploy. Dokploy's own git webhook handles the
actual deploy, independently.

## One-time setup (do this once, in the Dokploy dashboard)

### 1. Create the Application

1. In your Dokploy project, **Create Service → Application**.
2. Connect it to this repo's GitHub source, branch `master`.
3. **Build type: Dockerfile**. Dockerfile path: `Dockerfile`, context: `.` (repo root). No build stage override needed.

### 2. Set the container port

- Dokploy needs to know which port the container listens on: **3000** (set in the Dockerfile's `EXPOSE`/`ENV PORT`).
- In the Application's **Domains** tab, when you add the domain, point it at container port `3000`.

### 3. Add persistent volumes

In **Advanced → Mounts**, add two **named volumes** (not bind mounts -- named volumes are what Dokploy's backup feature can back up):

| Volume name | Mount path in container | Holds |
|---|---|---|
| `higglers-db` | `/app/data` | `data.db` (SQLite) |
| `higglers-uploads` | `/app/uploads` | uploaded media files |

These paths are fixed by the Dockerfile (`DATABASE_URL=file:/app/data/data.db`, `UPLOADS_DIR=/app/uploads`) -- don't change the mount paths without also changing the Dockerfile.

### 4. Set environment variables

In the **Environment** tab, add:

| Variable | Value | Notes |
|---|---|---|
| `EMDASH_ENCRYPTION_KEY` | output of `npx emdash secrets generate` | **Generate a fresh one now, specifically for prod.** Do not reuse the value from your local `.env`. Set it once and never rotate it -- rotating it makes previously-encrypted data unreadable. |
| `EMDASH_SITE_URL` | `https://thehigglers.com` | Must be the real public domain so passkeys, OAuth redirects, CSRF checks, and sitemap/JSON-LD URLs are correct behind Dokploy's proxy. |

Do **not** add `DATABASE_URL` or `UPLOADS_DIR` here -- those are baked into the image at build time by the Dockerfile and setting them at runtime has no effect (Astro reads them while evaluating `astro.config.mjs` during `pnpm build`, not per-request).

### 5. Enable auto-deploy

In **General → Auto Deploy** (or the Deployments tab), confirm the GitHub webhook is active for pushes to `master`. Every merge to `master` will now trigger a Dokploy build + deploy automatically.

### 6. First deploy

1. Trigger the first deploy (push to `master`, or click Deploy manually).
2. Watch the build logs in Dokploy until it's healthy.
3. Visit `https://thehigglers.com/_emdash/admin/setup` and create the admin account (first-run setup wizard -- only appears once, since the DB starts empty).
4. Confirm the homepage shows **"The Higglers Company"** as the title (this comes from `seed/seed.prod.json`, which is baked into the image in place of the demo-content seed used for local dev -- see below).

### 7. Volume backups (recommended)

In **Volume Backups**, for both `higglers-db` and `higglers-uploads`:

- Destination: an S3-compatible bucket (add it under **Secrets Providers** first if not already configured).
- Schedule: e.g. daily (`0 3 * * *`).
- Container behavior: **Container OFF** (safer -- stops the app briefly during backup to avoid a half-written SQLite file).

You'll need to supply the actual bucket/credentials -- I can't provision those for you.

## How the pieces fit together

- **Migrations**: EmDash runs pending schema migrations automatically on the first request after each deploy, directly against the DB on the `higglers-db` volume. No separate migration step or command needed.
- **Seed data**: `seed/seed.json` (used by local `pnpm dev`) contains demo content -- a placeholder "About" page and "Welcome" post, and the title "My Site". Production never sees this. The Dockerfile copies `seed/seed.prod.json` (schema/taxonomies/menu only, real site title "The Higglers Company" / tagline "Technological Solution Delivered", zero demo content) to `.emdash/seed.json` before `pnpm build` -- EmDash checks `.emdash/seed.json` before `seed/seed.json`, so the clean seed wins in the Docker build without touching what local dev uses.
- **Uploads**: media uploaded through the admin UI is written to `/app/uploads`, which is the `higglers-uploads` volume -- it survives every redeploy.

## If you ever need to change the schema

Edit `seed/seed.json` (and mirror any *structural* change -- new collections, fields, taxonomies -- into `seed/seed.prod.json` too, since seed files only apply their schema changes on top of what's already in the DB when relevant; content stays separate). Since the DB already has data after go-live, schema changes going forward are best made via `npx emdash schema ...` against the live site or through the admin UI, not by relying on the seed file re-applying.
