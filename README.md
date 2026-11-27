# Prime Play

Single-page site where team captains pick dress code colours from a 32-shade wheel, save their team and captain name, and see every team's selection in a shared table. Each saved team can be previewed in a popup, edited, or deleted — but only within the 60-minute edit window. After that, nothing can be deleted or changed.

## Selection Rules

- Each team must select one colour from the 32 options.
- The edit window will remain open for 60 minutes. Once this period expires, the window will close, and no further changes or deletions will be allowed.

## Deploy on Vercel

1. Import this repo into Vercel (no build settings needed).
2. In the Vercel project, open **Storage → Create → Blob**. Choose **Private** access, keep the read-write token checkbox ticked, and connect the store to this project. This adds `BLOB_READ_WRITE_TOKEN` and `BLOB_STORE_ID`.
3. Redeploy. Teams are saved through `api/teams.js` and `api/teams/[id].js` into Vercel Blob.

## Run locally

Requires Python 3 (no packages to install).

```bash
python3 server.py
```

Open http://localhost:8765. Locally, saved teams are stored in `data/teams.json`.
