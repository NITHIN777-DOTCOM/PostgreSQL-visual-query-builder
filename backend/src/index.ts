import "dotenv/config";
import express from "express";
import cors from "cors";
import { createPool } from "./db.js";
import { getEnv } from "./env.js";
import { indexSchema, loadDatabaseSchema } from "./schema.js";
import { buildSql, generateSql, VisualQuerySchema } from "./sqlBuilder.js";
import { ManualSqlRequestSchema, validateManualSql, wrapPaged } from "./safeSql.js";
import {
  AlterTableSchema,
  CreateTableSchema,
  DeleteTableSchema,
  RenameTableSchema,
  alterTable,
  createTable,
  deleteTable,
  renameTable,
} from "./admin.js";

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
    const built = buildSql(vq, idx);
    const sql = built.sql + ";";
    const result = await pool.query(built.sql, built.params);
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

app.post("/api/sql/run", async (req, res) => {
  try {
    const parsed = ManualSqlRequestSchema.parse(req.body);
    const { baseSql } = validateManualSql(parsed.sql);
    const { pagedSql, countSql, params } = wrapPaged(baseSql, parsed.limit, parsed.offset);

    const [paged, count] = await Promise.all([pool.query(pagedSql, params), pool.query<{ total: number }>(countSql)]);

    res.json({
      sql: baseSql + ";",
      limit: parsed.limit,
      offset: parsed.offset,
      totalCount: count.rows[0]?.total ?? 0,
      rowCount: paged.rowCount ?? 0,
      fields: paged.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
      rows: paged.rows,
    });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

app.post("/api/admin/table/create", async (req, res) => {
  try {
    const parsed = CreateTableSchema.parse(req.body);
    const result = await createTable(pool, parsed);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(400).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});

app.post("/api/admin/table/rename", async (req, res) => {
  try {
    const parsed = RenameTableSchema.parse(req.body);
    const result = await renameTable(pool, parsed.schema, parsed.from, parsed.to);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(400).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});

app.post("/api/admin/table/delete", async (req, res) => {
  try {
    const parsed = DeleteTableSchema.parse(req.body);
    const result = await deleteTable(pool, parsed.schema, parsed.table);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(400).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});

app.post("/api/admin/table/alter", async (req, res) => {
  try {
    const parsed = AlterTableSchema.parse(req.body);
    const result = await alterTable(pool, parsed);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(400).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${env.PORT}`);
});

