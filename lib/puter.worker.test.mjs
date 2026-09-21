// Self-check for the worker's public/private split and ownership rules.
// Run: node lib/puter.worker.test.mjs
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const makeKv = () => {
  const m = new Map();
  return {
    get: async (k) => (m.has(k) ? structuredClone(m.get(k)) : null),
    set: async (k, v) => void m.set(k, structuredClone(v)),
    del: async (k) => void m.delete(k),
    list: async (glob, withValues) => {
      const prefix = glob.replace(/\*$/, "");
      const hits = [...m.entries()].filter(([k]) => k.startsWith(prefix));
      return withValues
        ? hits.map(([key, value]) => ({ key, value: structuredClone(value) }))
        : hits.map(([k]) => k);
    },
  };
};

const routes = {};
const router = {
  post: (p, h) => (routes[`POST ${p}`] = h),
  get: (p, h) => (routes[`GET ${p}`] = h),
};
const me = { puter: { kv: makeKv() } };
new Function("router", "me", readFileSync("lib/puter.worker.js", "utf8"))(
  router,
  me,
);

const mkUser = (uuid, username) => ({
  id: uuid,
  puter: { auth: { getUser: async () => ({ uuid, username }) }, kv: makeKv() },
});

const call = async (route, { user, body, query } = {}) => {
  const request = {
    json: async () => {
      if (body === undefined) throw new SyntaxError("Unexpected end of JSON input");
      return body;
    },
    url: `https://w.test/x${query ? `?${query}` : ""}`,
  };
  const out = await routes[route]({ request, user, params: {} });
  return out instanceof Response
    ? { status: out.status, body: await out.json() }
    : { status: 200, body: out };
};

const alice = mkUser("uuid-alice", "alice");
const bob = mkUser("uuid-bob", "bob");
const proj = { id: "p1", name: "Loft", sourceImage: "https://x.puter.site/a.png" };
const ids = (r) => r.body.projects.map((p) => p.id).sort();

// unauthenticated -> 401, not a 500
assert.equal((await call("POST /api/projects/save", { body: { project: proj } })).status, 401);
assert.equal((await call("GET /api/projects/list", {})).status, 401);

// malformed / invalid input -> 400
assert.equal((await call("POST /api/projects/save", { user: alice })).status, 400);
assert.equal(
  (await call("POST /api/projects/save", { user: alice, body: { project: { ...proj, id: {} } } })).status,
  400,
);

// 1. alice saves -> private only
assert.equal((await call("POST /api/projects/save", { user: alice, body: { project: proj } })).status, 200);
assert.deepEqual(ids(await call("GET /api/projects/list", { user: alice })), ["p1"]);
assert.deepEqual(ids(await call("GET /api/projects/list", { user: bob })), []);
assert.equal((await call("GET /api/projects/get", { user: bob, query: "id=p1" })).status, 404);

// 2. alice publishes -> visible to bob, attributed
const shared = await call("POST /api/projects/visibility", {
  user: alice,
  body: { id: "p1", visibility: "public" },
});
assert.equal(shared.status, 200);
assert.equal(shared.body.project.sharedBy, "alice");
assert.deepEqual(ids(await call("GET /api/projects/list", { user: bob })), ["p1"]);
const bobView = await call("GET /api/projects/get", { user: bob, query: "id=p1" });
assert.equal(bobView.status, 200);
assert.equal(bobView.body.project.isPublic, true);

// 3. bob cannot unshare or hijack alice's published project
assert.equal(
  (await call("POST /api/projects/visibility", { user: bob, body: { id: "p1", visibility: "private" } })).status,
  404, // bob has no private copy -> not his to change
);
await call("POST /api/projects/save", { user: bob, body: { project: { ...proj, name: "Hijacked" } } });
assert.equal(
  (await call("POST /api/projects/visibility", { user: bob, body: { id: "p1", visibility: "public" } })).status,
  403,
);
assert.equal((await me.puter.kv.get("roomify_public_p1")).name, "Loft");
assert.equal((await me.puter.kv.get("roomify_public_p1")).ownerId, "uuid-alice");

// bob's own save did not leak into the shared store as his
assert.equal((await call("GET /api/projects/get", { user: bob, query: "id=p1" })).body.project.name, "Hijacked");

// 4. alice re-saves after a render -> published copy stays published and syncs
await call("POST /api/projects/save", {
  user: alice,
  body: { project: { ...proj, renderedImage: "https://x.puter.site/r.png" } },
});
const pub = await me.puter.kv.get("roomify_public_p1");
assert.equal(pub.renderedImage, "https://x.puter.site/r.png");
assert.equal(pub.isPublic, true);
assert.equal(pub.sharedBy, "alice");

// 5. alice unpublishes -> drops out of bob's feed, stays in hers
assert.equal(
  (await call("POST /api/projects/visibility", { user: alice, body: { id: "p1", visibility: "private" } })).status,
  200,
);
assert.equal(await me.puter.kv.get("roomify_public_p1"), null);
assert.deepEqual(ids(await call("GET /api/projects/list", { user: alice })), ["p1"]);
assert.deepEqual(ids(await call("GET /api/projects/list", { user: bob })), ["p1"]); // only his own copy
assert.equal((await call("GET /api/projects/list", { user: bob })).body.projects[0].name, "Hijacked");

console.log("all worker visibility checks passed");
