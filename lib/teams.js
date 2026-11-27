import { del, get, list, put } from "@vercel/blob";

// Each team lives at teams/<id>/<random>.json. Every save writes a new blob
// (fresh URL, so the Blob CDN cache can never serve stale data) and removes
// the older versions of that team.
const PREFIX = "teams/";
const SHADE_COUNT = 32;
const PIECES = ["top", "bottom", "shoes"];
const MAX_NAME = 40;
const ID_RE = /^[0-9a-f-]{36}$/;

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function json(status, payload) {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function handle(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, { error: err.message });
    console.error(err);
    return json(500, { error: "Could not reach team storage. Please try again." });
  }
}

export function validId(id) {
  return ID_RE.test(id || "");
}

export async function readBody(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Invalid request.");
  }
}

export function cleanPayload(body) {
  if (!body || typeof body !== "object") throw new HttpError(400, "Invalid request.");
  const team = String(body.team ?? "").trim();
  const captain = String(body.captain ?? "").trim();
  if (!team || !captain) throw new HttpError(400, "Team name and captain name are required.");
  if (team.length > MAX_NAME || captain.length > MAX_NAME) {
    throw new HttpError(400, `Names must be ${MAX_NAME} characters or fewer.`);
  }
  const colors = body.colors;
  if (!colors || typeof colors !== "object") throw new HttpError(400, "Kit colours are missing.");
  const clean = {};
  for (const piece of PIECES) {
    const value = colors[piece];
    if (!Number.isInteger(value) || value < 1 || value > SHADE_COUNT) {
      throw new HttpError(400, `Pick a valid shade for ${piece}.`);
    }
    clean[piece] = value;
  }
  return { team, captain, colors: clean };
}

async function listBlobs(prefix) {
  const blobs = [];
  let cursor;
  do {
    const page = await list({ prefix, cursor });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return blobs;
}

// Map of team id -> all blob versions for that team, newest first.
async function versionsById() {
  const byId = new Map();
  for (const blob of await listBlobs(PREFIX)) {
    const id = blob.pathname.slice(PREFIX.length).split("/")[0];
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(blob);
  }
  for (const versions of byId.values()) {
    versions.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  }
  return byId;
}

async function fetchRecord(blob) {
  // Private stores reject anonymous reads, so the file is fetched with the
  // store token (OIDC on Vercel, BLOB_READ_WRITE_TOKEN otherwise).
  const result = await get(blob.url, { access: "private" });
  if (!result || result.statusCode !== 200) throw new Error(`Blob fetch failed for ${blob.pathname}`);
  return JSON.parse(await new Response(result.stream).text());
}

export async function loadTeams() {
  const byId = await versionsById();
  return Promise.all([...byId.values()].map((versions) => fetchRecord(versions[0])));
}

async function writeRecord(record) {
  await put(`${PREFIX}${record.id}/team.json`, JSON.stringify(record), {
    access: "private",
    addRandomSuffix: true,
    contentType: "application/json",
  });
}

export function nameTaken(teams, team, excludeId) {
  const key = team.toLocaleLowerCase();
  return teams.some((t) => t.team.toLocaleLowerCase() === key && t.id !== excludeId);
}

export async function createTeam(fields) {
  const teams = await loadTeams();
  if (nameTaken(teams, fields.team)) {
    throw new HttpError(409, `“${fields.team}” is already saved. Edit it from the table instead.`);
  }
  const now = Date.now();
  const record = { id: crypto.randomUUID(), ...fields, createdAt: now, updatedAt: now };
  await writeRecord(record);
  return record;
}

export async function updateTeam(id, fields) {
  const byId = await versionsById();
  const versions = byId.get(id);
  if (!versions) throw new HttpError(404, "That team no longer exists.");

  const teams = await Promise.all([...byId.values()].map((v) => fetchRecord(v[0])));
  if (nameTaken(teams, fields.team, id)) {
    throw new HttpError(409, `Another team is already called “${fields.team}”.`);
  }
  const current = teams.find((t) => t.id === id);
  const record = { ...current, ...fields, updatedAt: Date.now() };
  await writeRecord(record);
  await del(versions.map((b) => b.url));
  return record;
}

export async function deleteTeam(id) {
  const versions = await listBlobs(`${PREFIX}${id}/`);
  if (!versions.length) throw new HttpError(404, "That team no longer exists.");
  await del(versions.map((b) => b.url));
}
