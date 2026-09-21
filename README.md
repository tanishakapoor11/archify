# Archify

Upload a 2D floor plan, get a photorealistic top-down 3D render. Renders are
generated with Gemini via Puter, stored in Puter KV, and can be published to a
shared community feed.

## Stack

- React Router 8 (SSR) + React 19 + TypeScript
- Tailwind CSS 4
- [Puter](https://puter.com) for auth, KV storage, static hosting, and AI

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the worker URL
npm run dev
```

The app runs at `http://localhost:5173`.

### Environment

| Variable | Purpose |
| --- | --- |
| `VITE_PUTER_WORKER_URL` | Base URL of the deployed Puter worker |

Without it, project save/list/get silently no-op and the upload flow reports a
save failure.

## The Puter worker

[`lib/puter.worker.js`](lib/puter.worker.js) is deployed separately to Puter —
it is not bundled by Vite. Redeploy it after any change there, or the client
will call routes that do not exist yet.

It uses two Puter identities:

| Identity | Scope | Holds |
| --- | --- | --- |
| `user.puter.kv` | the calling user, isolated | private projects (`archify_project_<id>`) |
| `me.puter.kv` | the worker app, shared by all callers | published copies (`archify_public_<id>`) |

Because every caller can write to `me.puter.kv`, each mutation checks
`ownerId` before touching a published record.

Records written before the `roomify` → `archify` rename are still read from
the old prefixes; the next save rewrites them under the new ones.

### Routes

| Route | Purpose |
| --- | --- |
| `POST /api/projects/save` | Write the private copy; re-sync a published copy you own |
| `POST /api/projects/visibility` | Publish or unpublish (`{ id, visibility }`) |
| `GET /api/projects/list` | Your projects merged with all published ones |
| `GET /api/projects/get?id=` | Your copy, falling back to the published one |

## Tests

```bash
node lib/puter.worker.test.mjs
```

Exercises the worker's visibility and ownership rules against stubbed
`router` / `me` globals. No dependencies, no test runner.

## Build

```bash
npm run build
npm run typecheck
```

## Deploying

`VITE_PUTER_WORKER_URL` is inlined by Vite **at build time**, not read at
runtime. It must be present in the environment that runs `npm run build`, or
every worker call silently no-ops in the deployed app.

```bash
docker build --build-arg VITE_PUTER_WORKER_URL=https://<your-worker>.puter.work -t archify .
docker run -p 3000:3000 archify
```

The build fails loudly if the arg is missing. Redeploy
[`lib/puter.worker.js`](lib/puter.worker.js) to Puter separately whenever it
changes — it is not part of this bundle.
