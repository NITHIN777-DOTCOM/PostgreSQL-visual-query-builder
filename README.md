## PostgreSQL Visual Query Builder (MVP)

Drag tables onto a canvas, connect columns to create joins, select fields, generate SQL live, run it, and view results.

### Tech

- **Frontend**: React + TypeScript + Vite + React Flow
- **Backend**: Node.js + Express + `pg`
- **DB**: PostgreSQL (via Docker Compose, or your local PostgreSQL)

### Run locally

1) Start Postgres (demo schema is auto-created)

```bash
docker compose up -d
```

If you don’t have Docker installed, create a database locally and run `db/init.sql` manually, then set `backend/.env` `DATABASE_URL` accordingly.

2) Backend

```bash
cd backend
copy .env.example .env
npm install
npm run dev
```

3) Frontend

```bash
cd frontend
copy .env.example .env
npm install
npm run dev
```

Open the app at `http://localhost:5173`.

### How to use

- Click a table in the left sidebar to add it to the canvas
- Drag from a column handle to another column to create a join
- Tick checkboxes next to columns to include them in `SELECT`
- Click **Run** to execute against Postgres and show results

