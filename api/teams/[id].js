import {
  HttpError,
  cleanPayload,
  deleteTeam,
  handle,
  json,
  readBody,
  updateTeam,
  validId,
} from "../../lib/teams.js";

function teamId(request) {
  const id = new URL(request.url).pathname.split("/").pop();
  if (!validId(id)) throw new HttpError(404, "That team no longer exists.");
  return id;
}

export function PUT(request) {
  return handle(async () => {
    const id = teamId(request);
    const fields = cleanPayload(await readBody(request));
    return json(200, await updateTeam(id, fields));
  });
}

export function DELETE(request) {
  return handle(async () => {
    await deleteTeam(teamId(request));
    return json(200, { ok: true });
  });
}
