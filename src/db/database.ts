import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

export const SCHEMA_VERSION = 1;

export function openDatabase(dbPath: string): DatabaseSync {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  migrate(db);
  return db;
}

export function migrate(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memories (
      id            TEXT PRIMARY KEY,
      content       TEXT NOT NULL,
      kind          TEXT NOT NULL DEFAULT 'real' CHECK (kind IN ('real','observed')),
      veracity      TEXT NOT NULL DEFAULT 'real' CHECK (veracity IN ('real','observed','imagined','hypothetical')),
      privacy       TEXT NOT NULL DEFAULT 'shared' CHECK (privacy IN ('shared','private')),
      valence       REAL NOT NULL DEFAULT 0 CHECK (valence BETWEEN -1 AND 1),
      importance    INTEGER NOT NULL DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
      flashbulb     INTEGER NOT NULL DEFAULT 0 CHECK (flashbulb IN (0,1)),
      tags          TEXT NOT NULL DEFAULT '[]',
      decay         REAL NOT NULL DEFAULT 1,
      access_count  INTEGER NOT NULL DEFAULT 0,
      last_accessed TEXT,
      status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','deleted')),
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at);
    CREATE INDEX IF NOT EXISTS idx_memories_status ON memories(status);
    CREATE INDEX IF NOT EXISTS idx_memories_valence ON memories(valence);

    CREATE TABLE IF NOT EXISTS dreams (
      id             TEXT PRIMARY KEY,
      content        TEXT NOT NULL,
      theme          TEXT,
      seed_fragments TEXT NOT NULL DEFAULT '[]',
      engine         TEXT NOT NULL,
      created_at     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chapters (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      range_start TEXT,
      range_end   TEXT,
      prose       TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS turning_points (
      id         TEXT PRIMARY KEY,
      date       TEXT NOT NULL,
      title      TEXT NOT NULL,
      importance INTEGER NOT NULL DEFAULT 3,
      memory_ids TEXT NOT NULL DEFAULT '[]',
      status     TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','confirmed')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS digest (
      id         TEXT PRIMARY KEY,
      date       TEXT NOT NULL,
      content    TEXT NOT NULL,
      dream_id   TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS persona (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      traits        TEXT NOT NULL DEFAULT '{}',
      voice         TEXT NOT NULL DEFAULT '',
      evolution_log TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS engine_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      op         TEXT NOT NULL,
      engine     TEXT NOT NULL,
      model      TEXT,
      ok         INTEGER NOT NULL,
      latency_ms INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      action     TEXT NOT NULL,
      target_id  TEXT NOT NULL DEFAULT '',
      detail     TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      id UNINDEXED, content, tags,
      tokenize='unicode61'
    );
  `);

  const versionRow = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
    | { value: string }
    | undefined;
  if (!versionRow) {
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)").run(
      String(SCHEMA_VERSION),
    );
  }

  // Sincroniza el índice FTS5 si hay memorias sin indexar.
  const memCount = (db.prepare("SELECT COUNT(*) AS n FROM memories").get() as { n: number }).n;
  const ftsCount = (db.prepare("SELECT COUNT(*) AS n FROM memories_fts").get() as { n: number }).n;
  if (memCount > 0 && ftsCount === 0) {
    db.exec("INSERT INTO memories_fts(memories_fts) VALUES ('rebuild')");
  }
}

export function getMeta(db: DatabaseSync, key: string): string | null {
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setMeta(db: DatabaseSync, key: string, value: string): void {
  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)").run(key, value);
}

export function addAudit(
  db: DatabaseSync,
  action: string,
  targetId: string,
  detail: unknown,
): void {
  db.prepare(
    "INSERT INTO audit_log (action, target_id, detail, created_at) VALUES (?, ?, ?, ?)",
  ).run(action, targetId, JSON.stringify(detail), new Date().toISOString());
}

export function logEngine(
  db: DatabaseSync,
  op: string,
  engine: string,
  model: string | null,
  ok: boolean,
  latencyMs: number | null,
): void {
  db.prepare(
    "INSERT INTO engine_log (op, engine, model, ok, latency_ms, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(op, engine, model, ok ? 1 : 0, latencyMs, new Date().toISOString());
}
