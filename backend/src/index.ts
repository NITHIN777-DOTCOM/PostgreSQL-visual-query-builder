import "dotenv/config";
import express from "express";
import cors from "cors";
import { createPool } from "./db.js";
import { getEnv } from "./env.js";
import { indexSchema, loadDatabaseSchema } from "./schema.js";
import { generateSql, VisualQuerySchema } from "./sqlBuilder.js";

const env = getEnv();
const pool = createPool(env.DATABASE_URL);

const app = express();
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", async (_req, res) => {
  try {
    const { rows } = await pool.query("select 1 as ok");
    res.json({ ok: true, db: rows[0]?.ok === 1 });
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});

app.get("/api/schema", async (_req, res) => {
  try {
    const schema = await loadDatabaseSchema(pool);
    res.json(schema);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

app.post("/api/query/generate", async (req, res) => {
  try {
    const schema = await loadDatabaseSchema(pool);
    const idx = indexSchema(schema);
    const vq = VisualQuerySchema.parse(req.body);
    const sql = generateSql(vq, idx);
    res.json({ sql });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

app.post("/api/query/run", async (req, res) => {
  try {
    const schema = await loadDatabaseSchema(pool);
    const idx = indexSchema(schema);
    const vq = VisualQuerySchema.parse(req.body);
    const sql = generateSql(vq, idx);
    const result = await pool.query(sql);
    res.json({
      sql,
      rowCount: result.rowCount ?? 0,
      fields: result.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
      rows: result.rows,
    });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${env.PORT}`);
});

