# ABE — Minimal Express + API for Vercel

This project contains a small Express app that serves the SPA and provides a simple authentication + task API. It is prepared to run locally (`node server/index.js`) and deploy to Vercel (serverless function at `api/index.js`).

Quick local run:

```powershell
npm install
npm run start
```

Environment variables (create `.env` in project root):

- `MONGO_URI` — MongoDB connection string
- `SESSION_SECRET` — (optional) session secret

On Vercel set the same environment variables in the dashboard.
