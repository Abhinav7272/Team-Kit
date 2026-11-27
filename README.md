# Team-Kit

Single-page site where team captains pick kit colours (top, bottom, shoes) from a 32-shade wheel, save their team and captain name, and see every team's selection in a shared table. Each saved team can be previewed in a popup, edited, or deleted (delete requires confirmation inside the preview).

## Deploy on Vercel

1. Import this repo into Vercel (no build settings needed).
2. In the Vercel project, open **Storage → Create → Blob**, and connect the store to this project. This adds the `BLOB_READ_WRITE_TOKEN` environment variable.
3. Redeploy. Teams are saved through `api/teams.js` and `api/teams/[id].js` into Vercel Blob.

## Run locally

Requires Python 3 (no packages to install).

```bash
python3 server.py
```

Open http://localhost:8765. Locally, saved teams are stored in `data/teams.json`.
