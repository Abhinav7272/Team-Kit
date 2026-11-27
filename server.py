"""Prime Play server: serves the site and stores team dress codes in data/teams.json.

Run:  python3 server.py  (then open http://localhost:8765)
"""

import json
import os
import re
import threading
import time
import uuid
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(ROOT, "data", "teams.json")
PORT = int(os.environ.get("PORT", "8765"))
SHADE_COUNT = 32
PIECES = ("top", "bottom", "shoes")
MAX_NAME = 40
LOCK_MS = 60 * 60 * 1000
CLOSED_ERROR = "This colour is closed. It can only be changed or deleted within 60 minutes of saving."

lock = threading.Lock()


def load_teams():
    if not os.path.exists(DATA_FILE):
        return []
    with open(DATA_FILE, encoding="utf-8") as f:
        return json.load(f)


def save_teams(teams):
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    tmp = DATA_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(teams, f, indent=2)
    os.replace(tmp, DATA_FILE)


def clean_payload(body):
    """Return (record_fields, error_message)."""
    if not isinstance(body, dict):
        return None, "Invalid request."
    team = str(body.get("team", "")).strip()
    captain = str(body.get("captain", "")).strip()
    if not team or not captain:
        return None, "Team name and captain name are required."
    if len(team) > MAX_NAME or len(captain) > MAX_NAME:
        return None, f"Names must be {MAX_NAME} characters or fewer."
    colors = body.get("colors")
    if not isinstance(colors, dict):
        return None, "Kit colours are missing."
    clean_colors = {}
    for piece in PIECES:
        value = colors.get(piece)
        if not isinstance(value, int) or not 1 <= value <= SHADE_COUNT:
            return None, f"Pick a valid shade for {piece}."
        clean_colors[piece] = value
    return {"team": team, "captain": captain, "colors": clean_colors}, None


def is_closed(record, now=None):
    created = record.get("createdAt")
    if not isinstance(created, (int, float)):
        return True
    if now is None:
        now = int(time.time() * 1000)
    return now - int(created) >= LOCK_MS


def name_taken(teams, team, exclude_id=None):
    key = team.casefold()
    return any(t["team"].casefold() == key and t["id"] != exclude_id for t in teams)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def _send_json(self, status, payload):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def _read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length > 10_000:
            return None
        try:
            return json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            return None

    def _team_id(self):
        m = re.fullmatch(r"/api/teams/([0-9a-f-]{36})", self.path)
        return m.group(1) if m else None

    def do_GET(self):
        path = unquote(urlsplit(self.path).path)
        if path == "/api/teams":
            with lock:
                teams = load_teams()
            return self._send_json(HTTPStatus.OK, teams)
        if path.startswith("/data") or path.endswith(".py") or "/." in path:
            return self.send_error(HTTPStatus.NOT_FOUND)
        return super().do_GET()

    def do_POST(self):
        if self.path != "/api/teams":
            return self.send_error(HTTPStatus.NOT_FOUND)
        fields, error = clean_payload(self._read_json())
        if error:
            return self._send_json(HTTPStatus.BAD_REQUEST, {"error": error})
        with lock:
            teams = load_teams()
            if name_taken(teams, fields["team"]):
                return self._send_json(
                    HTTPStatus.CONFLICT,
                    {"error": f"“{fields['team']}” is already saved. Edit it from the table instead."},
                )
            now = int(time.time() * 1000)
            record = {"id": str(uuid.uuid4()), **fields, "createdAt": now, "updatedAt": now}
            teams.append(record)
            save_teams(teams)
        return self._send_json(HTTPStatus.CREATED, record)

    def do_PUT(self):
        team_id = self._team_id()
        if not team_id:
            return self.send_error(HTTPStatus.NOT_FOUND)
        fields, error = clean_payload(self._read_json())
        if error:
            return self._send_json(HTTPStatus.BAD_REQUEST, {"error": error})
        with lock:
            teams = load_teams()
            record = next((t for t in teams if t["id"] == team_id), None)
            if not record:
                return self._send_json(HTTPStatus.NOT_FOUND, {"error": "That team no longer exists."})
            if is_closed(record):
                return self._send_json(HTTPStatus.FORBIDDEN, {"error": CLOSED_ERROR})
            if name_taken(teams, fields["team"], exclude_id=team_id):
                return self._send_json(
                    HTTPStatus.CONFLICT, {"error": f"Another team is already called “{fields['team']}”."}
                )
            record.update(fields, updatedAt=int(time.time() * 1000))
            save_teams(teams)
        return self._send_json(HTTPStatus.OK, record)

    def do_DELETE(self):
        team_id = self._team_id()
        if not team_id:
            return self.send_error(HTTPStatus.NOT_FOUND)
        with lock:
            teams = load_teams()
            record = next((t for t in teams if t["id"] == team_id), None)
            if not record:
                return self._send_json(HTTPStatus.NOT_FOUND, {"error": "That team no longer exists."})
            if is_closed(record):
                return self._send_json(HTTPStatus.FORBIDDEN, {"error": CLOSED_ERROR})
            remaining = [t for t in teams if t["id"] != team_id]
            save_teams(remaining)
        return self._send_json(HTTPStatus.OK, {"ok": True})


if __name__ == "__main__":
    print(f"Prime Play running at http://localhost:{PORT}")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
