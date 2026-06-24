# JobBridge — Local Development README

This project has been converted to use a local Express backend with optional SQLite storage.

Quick start

1. Install dependencies (including the SQLite binding):

```powershell
npm install
npm install better-sqlite3
```

2. Start the local API server (defaults to port 5050):

```powershell
node server/index.js
```

3. Start the frontend (Vite):

```powershell
npm run dev
```

Notes
- The server uses JSON files (`server/jobs.json`, `server/jobbridge_users.json`, `server/jobbridge_otps.json`) by default.
- If `better-sqlite3` is installed the server will create `server/jobbridge.sqlite` and migrate existing JSON data into SQLite on startup.
- JWT tokens are issued by `POST /login` and verified by middleware for protected routes (e.g. `POST /jobs`). The frontend stores tokens in `localStorage` under `jobbridge_token`.
- Recruiter role is required to create jobs. Use the signup/login flows to create a recruiter account.

Environment
- `VITE_LOCAL_API_URL` — frontend local API base URL (defaults to `http://localhost:5050`).
- `JWT_SECRET` — server JWT secret (defaults to `dev_secret_change_me`).

If you want me to remove any remaining legacy files or further harden auth/storage, tell me which step to take next.
# JobBridge
# JobBridge
