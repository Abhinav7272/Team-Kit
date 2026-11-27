import { cleanPayload, createTeam, handle, json, loadTeams, readBody } from "../lib/teams.js";

export function GET() {
  return handle(async () => json(200, await loadTeams()));
}

export function POST(request) {
  return handle(async () => {
    const fields = cleanPayload(await readBody(request));
    return json(201, await createTeam(fields));
  });
}
