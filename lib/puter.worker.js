const PROJECT_PREFIX = "archify_project_";
const PUBLIC_PREFIX = "archify_public_";

// ponytail: records written before the rename. Reads fall back to these and
// the next save rewrites under the new prefix; drop both once migrated.
const LEGACY_PROJECT_PREFIX = "roomify_project_";
const LEGACY_PUBLIC_PREFIX = "roomify_public_";

const privateKey = (id) => `${PROJECT_PREFIX}${id}`;
const publicKey = (id) => `${PUBLIC_PREFIX}${id}`;
const legacyPrivateKey = (id) => `${LEGACY_PROJECT_PREFIX}${id}`;
const legacyPublicKey = (id) => `${LEGACY_PUBLIC_PREFIX}${id}`;

const jsonError = (status, message, extra = {}) =>
  new Response(JSON.stringify({ error: message, ...extra }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });

const getAuthedUser = async (userPuter) => {
  try {
    const user = await userPuter.auth.getUser();
    return user?.uuid ? { uuid: user.uuid, username: user.username } : null;
  } catch {
    return null;
  }
};

// Public copies live in the worker app's shared KV, so every caller can write
// to the same keyspace. Ownership must be checked on every mutation.
// ponytail: this check and the write that follows it are not atomic - Puter KV
// has no compare-and-set. Project ids are UUIDs, so two users cannot contend
// for the same key; if ids ever stop being unique, guard publishes with an
// incr()-based lock on publicKey(id).
const readPublic = async (id) => {
  try {
    return (
      (await me.puter.kv.get(publicKey(id))) ||
      (await me.puter.kv.get(legacyPublicKey(id))) ||
      null
    );
  } catch {
    return null;
  }
};

const readOwn = async (userPuter, id) =>
  (await userPuter.kv.get(privateKey(id))) ||
  (await userPuter.kv.get(legacyPrivateKey(id))) ||
  null;

const isValidId = (id) => typeof id === "string" && id.length > 0;

router.post("/api/projects/save", async ({ request, user }) => {
  try {
    const userPuter = user?.puter;
    if (!userPuter) return jsonError(401, "Authentication failed");

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return jsonError(400, "Invalid JSON body", {
        message: e.message || "Unknown error",
      });
    }

    const project = body?.project;
    if (!isValidId(project?.id) || !project?.sourceImage)
      return jsonError(400, "Missing project id or sourceImage");

    const authed = await getAuthedUser(userPuter);
    if (!authed) return jsonError(401, "Authentication failed");

    const existingPublic = await readPublic(project.id);
    const ownsPublic = existingPublic?.ownerId === authed.uuid;

    const payload = {
      ...project,
      ownerId: authed.uuid,
      isPublic: ownsPublic,
      sharedBy: ownsPublic ? existingPublic.sharedBy : null,
      sharedAt: ownsPublic ? existingPublic.sharedAt : null,
      updatedAt: new Date().toISOString(),
    };

    await userPuter.kv.set(privateKey(project.id), payload);
    // Keep an already-published copy in sync (e.g. once a render finishes).
    if (ownsPublic) await me.puter.kv.set(publicKey(project.id), payload);

    return { saved: true, id: project.id, project: payload };
  } catch (e) {
    return jsonError(500, "Failed to save project", {
      message: e.message || "Unknown error",
    });
  }
});

router.post("/api/projects/visibility", async ({ request, user }) => {
  try {
    const userPuter = user?.puter;
    if (!userPuter) return jsonError(401, "Authentication failed");

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return jsonError(400, "Invalid JSON body", {
        message: e.message || "Unknown error",
      });
    }

    const { id, visibility } = body || {};
    if (!isValidId(id)) return jsonError(400, "Missing project id");
    if (visibility !== "public" && visibility !== "private")
      return jsonError(400, "visibility must be 'public' or 'private'");

    const authed = await getAuthedUser(userPuter);
    if (!authed) return jsonError(401, "Authentication failed");

    // The private copy is the source of truth; you can only publish your own.
    const own = await readOwn(userPuter, id);
    if (!own) return jsonError(404, "Project not found");

    const existingPublic = await readPublic(id);
    if (existingPublic && existingPublic.ownerId !== authed.uuid)
      return jsonError(403, "This project is published by another user");

    if (visibility === "private") {
      if (existingPublic) {
        await me.puter.kv.del(publicKey(id));
        await me.puter.kv.del(legacyPublicKey(id));
      }
      const payload = {
        ...own,
        ownerId: authed.uuid,
        isPublic: false,
        sharedBy: null,
        sharedAt: null,
      };
      await userPuter.kv.set(privateKey(id), payload);
      return { id, visibility, project: payload };
    }

    const payload = {
      ...own,
      ownerId: authed.uuid,
      isPublic: true,
      sharedBy: authed.username || null,
      sharedAt: existingPublic?.sharedAt || new Date().toISOString(),
    };
    await me.puter.kv.set(publicKey(id), payload);
    await userPuter.kv.set(privateKey(id), payload);

    return { id, visibility, project: payload };
  } catch (e) {
    return jsonError(500, "Failed to update visibility", {
      message: e.message || "Unknown error",
    });
  }
});

router.get("/api/projects/list", async ({ user }) => {
  try {
    const userPuter = user?.puter;
    if (!userPuter) return jsonError(401, "Authentication failed");

    const authed = await getAuthedUser(userPuter);
    if (!authed) return jsonError(401, "Authentication failed");

    const unwrap = (entries) =>
      (entries || []).map((entry) => entry?.value ?? entry).filter(Boolean);

    const [own, legacyOwn, published, legacyPublished] = await Promise.all([
      userPuter.kv.list(`${PROJECT_PREFIX}*`, true).then(unwrap),
      userPuter.kv.list(`${LEGACY_PROJECT_PREFIX}*`, true).then(unwrap),
      me.puter.kv.list(`${PUBLIC_PREFIX}*`, true).then(unwrap),
      me.puter.kv.list(`${LEGACY_PUBLIC_PREFIX}*`, true).then(unwrap),
    ]);

    // Own copies win: they are the source of truth and may be newer.
    const byId = new Map();
    for (const p of [...legacyPublished, ...published]) {
      if (isValidId(p?.id)) byId.set(p.id, { ...p, isPublic: true });
    }
    for (const p of [...legacyOwn, ...own]) {
      // Anything in the caller's own KV is theirs by definition; records saved
      // before ownerId existed would otherwise never pass an owner check.
      if (isValidId(p?.id))
        byId.set(p.id, { ...p, ownerId: p.ownerId ?? authed.uuid });
    }

    return { projects: [...byId.values()] };
  } catch (e) {
    return jsonError(500, "Failed to list projects", {
      message: e.message || "Unknown error",
    });
  }
});

router.get("/api/projects/get", async ({ request, user }) => {
  try {
    const userPuter = user?.puter;
    if (!userPuter) return jsonError(401, "Authentication failed");

    const authed = await getAuthedUser(userPuter);
    if (!authed) return jsonError(401, "Authentication failed");

    const id = new URL(request.url).searchParams.get("id");
    if (!isValidId(id)) return jsonError(400, "Missing project id");

    const own = await readOwn(userPuter, id);
    if (own) return { project: { ...own, ownerId: own.ownerId ?? authed.uuid } };

    const published = await readPublic(id);
    if (published) return { project: { ...published, isPublic: true } };

    return jsonError(404, "Project not found");
  } catch (e) {
    return jsonError(500, "Failed to fetch project", {
      message: e.message || "Unknown error",
    });
  }
});
