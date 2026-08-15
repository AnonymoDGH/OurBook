import type { DatabaseSync } from "node:sqlite";
import type {
  ChapterRow,
  ChapterStatus,
  DigestRow,
  DreamRow,
  MemoryRow,
  PersonaRow,
  TurningPointRow,
} from "../types.js";
import { addAudit, getMeta, setMeta } from "./database.js";
import { newId, nowIso, parseTags, tokenize } from "../lib/util.js";
import { effectiveDecay, refreshedDecay, recencyBoost } from "../lib/decay.js";

// ---------------------------------------------------------------------------
// Repositorio: toda la lógica de persistencia (SQLite + FTS5 sincronizado).
// ---------------------------------------------------------------------------

function rowToMemory(r: Record<string, unknown>): MemoryRow {
  return r as unknown as MemoryRow;
}

export interface NewMemoryInput {
  content: string;
  kind?: MemoryRow["kind"];
  veracity?: MemoryRow["veracity"];
  privacy?: MemoryRow["privacy"];
  valence?: number;
  importance?: number;
  flashbulb?: boolean;
  tags?: string[];
  created_at?: string;
}

export function addMemory(db: DatabaseSync, input: NewMemoryInput): MemoryRow {
  const now = nowIso();
  const created = input.created_at ?? now;
  const row: MemoryRow = {
    id: newId(),
    content: input.content.trim(),
    kind: input.kind ?? "real",
    veracity: input.veracity ?? "real",
    privacy: input.privacy ?? "shared",
    valence: input.valence ?? 0,
    importance: input.importance ?? 3,
    flashbulb: input.flashbulb ? 1 : 0,
    tags: JSON.stringify(parseTags(input.tags)),
    decay: 1,
    access_count: 0,
    last_accessed: null,
    status: "active",
    created_at: created,
    updated_at: now,
  };
  db.prepare(
    `INSERT INTO memories
       (id, content, kind, veracity, privacy, valence, importance, flashbulb, tags,
        decay, access_count, last_accessed, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id, row.content, row.kind, row.veracity, row.privacy, row.valence, row.importance,
    row.flashbulb, row.tags, row.decay, row.access_count, row.last_accessed, row.status,
    row.created_at, row.updated_at,
  );
  indexMemory(db, row);
  return row;
}

function indexMemory(db: DatabaseSync, m: MemoryRow): void {
  db.prepare("DELETE FROM memories_fts WHERE id = ?").run(m.id);
  db.prepare("INSERT INTO memories_fts (id, content, tags) VALUES (?, ?, ?)").run(
    m.id, m.content, m.tags,
  );
}

function unindexMemory(db: DatabaseSync, id: string): void {
  db.prepare("DELETE FROM memories_fts WHERE id = ?").run(id);
}

export function getMemory(db: DatabaseSync, id: string): MemoryRow | null {
  const r = db.prepare("SELECT * FROM memories WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return r ? rowToMemory(r) : null;
}

export function updateMemory(
  db: DatabaseSync,
  id: string,
  patch: Partial<
    Pick<MemoryRow, "content" | "valence" | "importance" | "flashbulb" | "veracity" | "privacy">
  > & { tags?: string[] },
): MemoryRow | null {
  const existing = getMemory(db, id);
  if (!existing) return null;
  const now = nowIso();
  const { tags: newTags, ...rest } = patch;
  const merged: MemoryRow = {
    ...existing,
    ...rest,
    tags: newTags ? JSON.stringify(parseTags(newTags)) : existing.tags,
    updated_at: now,
  };
  db.prepare(
    `UPDATE memories SET content=?, veracity=?, privacy=?, valence=?, importance=?, flashbulb=?, tags=?, updated_at=? WHERE id=?`,
  ).run(
    merged.content, merged.veracity, merged.privacy, merged.valence, merged.importance,
    merged.flashbulb, merged.tags, now, id,
  );
  indexMemory(db, merged);
  return getMemory(db, id);
}

/** Refuerzo por evocación (retrieval practice). */
export function touchMemory(db: DatabaseSync, id: string): void {
  const m = getMemory(db, id);
  if (!m) return;
  const decay = refreshedDecay(m);
  db.prepare(
    "UPDATE memories SET decay=?, access_count=access_count+1, last_accessed=?, updated_at=? WHERE id=?",
  ).run(decay, nowIso(), nowIso(), id);
}

export function softDeleteMemory(db: DatabaseSync, id: string): MemoryRow | null {
  const m = getMemory(db, id);
  if (!m) return null;
  db.prepare("UPDATE memories SET status='deleted', updated_at=? WHERE id=?").run(nowIso(), id);
  unindexMemory(db, id);
  return m;
}

export function purgeMemory(db: DatabaseSync, id: string): boolean {
  const m = getMemory(db, id);
  if (!m) return false;
  unindexMemory(db, id);
  db.prepare("DELETE FROM memories WHERE id=?").run(id);
  return true;
}

export function archiveMemory(db: DatabaseSync, id: string): void {
  db.prepare("UPDATE memories SET status='archived', updated_at=? WHERE id=?").run(nowIso(), id);
  unindexMemory(db, id);
}

export function listMemories(
  db: DatabaseSync,
  opts: {
    status?: MemoryRow["status"][];
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  } = {},
): MemoryRow[] {
  const statuses = opts.status ?? ["active", "archived"];
  const clauses: string[] = [];
  const params: Array<string | number> = [];
  clauses.push(`status IN (${statuses.map(() => "?").join(",")})`);
  params.push(...statuses);
  if (opts.from) {
    clauses.push("created_at >= ?");
    params.push(opts.from);
  }
  if (opts.to) {
    clauses.push("created_at <= ?");
    params.push(opts.to);
  }
  params.push(opts.limit ?? 500, opts.offset ?? 0);
  const rows = db
    .prepare(
      `SELECT * FROM memories WHERE ${clauses.join(" AND ")}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params) as Record<string, unknown>[];
  return rows.map(rowToMemory);
}

export interface SearchOptions {
  query?: string;
  veracity?: MemoryRow["veracity"][];
  includePrivate?: boolean;
  from?: string;
  to?: string;
  valenceMin?: number;
  valenceMax?: number;
  tag?: string;
  limit?: number;
}

/**
 * Búsqueda con ranking: FTS5 si hay query, navegación cronológica si no.
 * El ranking combina bm25 con la huella efectiva (decaimiento), importancia,
 * emoción y frescura; evocar refuerza la huella (retrieval practice).
 */
export function searchMemories(
  db: DatabaseSync,
  opts: SearchOptions,
  now: Date = new Date(),
): MemoryRow[] {
  const veracity = opts.veracity ?? ["real", "observed"];
  const baseClauses: string[] = ["m.status = 'active'"];
  const params: Array<string | number> = [];
  baseClauses.push(`m.veracity IN (${veracity.map(() => "?").join(",")})`);
  params.push(...veracity);
  if (!opts.includePrivate) {
    baseClauses.push("m.privacy = 'shared'");
  }
  if (opts.from) {
    baseClauses.push("m.created_at >= ?");
    params.push(opts.from);
  }
  if (opts.to) {
    baseClauses.push("m.created_at <= ?");
    params.push(opts.to);
  }
  if (opts.valenceMin !== undefined) {
    baseClauses.push("m.valence >= ?");
    params.push(opts.valenceMin);
  }
  if (opts.valenceMax !== undefined) {
    baseClauses.push("m.valence <= ?");
    params.push(opts.valenceMax);
  }
  if (opts.tag) {
    baseClauses.push("m.tags LIKE ?");
    params.push(`%"${opts.tag}"%`);
  }
  const limit = opts.limit ?? 5;

  let candidates: Array<MemoryRow & { bm: number }>;
  const query = (opts.query ?? "").trim();

  if (query.length > 0) {
    // --- FTS5 (con fallback a escaneo LIKE si el índice no existe) ---
    const tokens = tokenize(query);
    const ftsExpr = tokens.map((t) => `"${t}"*`).join(" OR ");
    try {
      const rows = db
        .prepare(
          `SELECT m.*, bm25(memories_fts) AS bm FROM memories m
           JOIN memories_fts ON memories_fts.id = m.id
           WHERE ${baseClauses.join(" AND ")} AND memories_fts MATCH ?
           ORDER BY bm25(memories_fts) LIMIT ?`,
        )
        .all(...params, ftsExpr, limit * 20) as Array<Record<string, unknown> & { bm: number }>;
      candidates = rows.map((r) => {
        const { bm, ...rest } = r;
        return { ...rowToMemory(rest), bm };
      });
    } catch {
      const like = `%${tokens.join("%")}%`;
      const rows = db
        .prepare(
          `SELECT * FROM memories m WHERE ${baseClauses.join(" AND ")} AND m.content LIKE ?
           ORDER BY m.created_at DESC LIMIT ?`,
        )
        .all(like, limit * 20) as Record<string, unknown>[];
      candidates = rows.map((r) => ({ ...rowToMemory(r), bm: 0 }));
    }
  } else {
    // --- Navegación: sin query, orden cronológico reciente ---
    const rows = db
      .prepare(
        `SELECT * FROM memories m WHERE ${baseClauses.join(" AND ")}
         ORDER BY m.created_at DESC LIMIT ?`,
      )
      .all(...params, limit * 20) as Record<string, unknown>[];
    candidates = rows.map((r) => ({ ...rowToMemory(r), bm: 0 }));
  }

  // Ranking: la huella efectiva domina; bm25 (menor = mejor) entra como factor.
  const ranked = candidates
    .map((m) => {
      const decay = effectiveDecay(m, now);
      const fts = query.length > 0 ? 1 / (1 + Math.max(0, m.bm)) : 1;
      const score =
        fts *
        decay *
        (0.5 + m.importance / 5) *
        (1 + 0.5 * Math.abs(m.valence)) *
        recencyBoost(m.created_at, now);
      return { m, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  for (const { m } of ranked) {
    touchMemory(db, m.id);
  }
  return ranked.map((r) => r.m);
}

export function listActiveMemories(
  db: DatabaseSync,
  opts: {
    veracity?: MemoryRow["veracity"][];
    includePrivate?: boolean;
    from?: string;
    to?: string;
  } = {},
): MemoryRow[] {
  const veracity = opts.veracity ?? ["real", "observed", "imagined", "hypothetical"];
  const clauses: string[] = ["status = 'active'"];
  const params: Array<string | number> = [];
  clauses.push(`veracity IN (${veracity.map(() => "?").join(",")})`);
  params.push(...veracity);
  if (!opts.includePrivate) {
    clauses.push("privacy = 'shared'");
  }
  if (opts.from) {
    clauses.push("created_at >= ?");
    params.push(opts.from);
  }
  if (opts.to) {
    clauses.push("created_at <= ?");
    params.push(opts.to);
  }
  const rows = db
    .prepare(`SELECT * FROM memories WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC LIMIT 5000`)
    .all(...params) as Record<string, unknown>[];
  return rows.map(rowToMemory);
}

// ---------------------------------------------------------------------------
// Sueños
// ---------------------------------------------------------------------------
export interface NewDreamInput {
  content: string;
  theme?: string;
  seedFragments: Array<{ id: string; snippet: string }>;
  engine: string;
  created_at?: string;
}

export function addDream(db: DatabaseSync, input: NewDreamInput): DreamRow {
  const row: DreamRow = {
    id: newId(),
    content: input.content.trim(),
    theme: input.theme ?? null,
    seed_fragments: JSON.stringify(input.seedFragments),
    engine: input.engine,
    created_at: input.created_at ?? nowIso(),
  };
  db.prepare(
    "INSERT INTO dreams (id, content, theme, seed_fragments, engine, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(row.id, row.content, row.theme, row.seed_fragments, row.engine, row.created_at);
  return row;
}

export function latestDreams(db: DatabaseSync, limit = 10): DreamRow[] {
  const rows = db
    .prepare("SELECT * FROM dreams ORDER BY created_at DESC LIMIT ?")
    .all(limit) as Record<string, unknown>[];
  return rows as unknown as DreamRow[];
}

export function getDream(db: DatabaseSync, id: string): DreamRow | null {
  const r = db.prepare("SELECT * FROM dreams WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return r ? (r as unknown as DreamRow) : null;
}

// ---------------------------------------------------------------------------
// Capítulos
// ---------------------------------------------------------------------------
export function addChapter(db: DatabaseSync, input: {
  title: string;
  prose: string;
  rangeStart?: string;
  rangeEnd?: string;
  status?: ChapterStatus;
  id?: string;
}): ChapterRow {
  const row: ChapterRow = {
    id: input.id ?? newId(),
    title: input.title,
    range_start: input.rangeStart ?? null,
    range_end: input.rangeEnd ?? null,
    prose: input.prose,
    status: input.status ?? "draft",
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  db.prepare(
    `INSERT INTO chapters (id, title, range_start, range_end, prose, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(row.id, row.title, row.range_start, row.range_end, row.prose, row.status, row.created_at, row.updated_at);
  return row;
}

export function getChapter(db: DatabaseSync, id: string): ChapterRow | null {
  const r = db.prepare("SELECT * FROM chapters WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return r ? (r as unknown as ChapterRow) : null;
}

export function listChapters(db: DatabaseSync, status?: ChapterStatus, limit = 50): ChapterRow[] {
  if (status) {
    const rows = db
      .prepare("SELECT * FROM chapters WHERE status = ? ORDER BY created_at DESC LIMIT ?")
      .all(status, limit) as Record<string, unknown>[];
    return rows as unknown as ChapterRow[];
  }
  const rows = db
    .prepare("SELECT * FROM chapters ORDER BY created_at DESC LIMIT ?")
    .all(limit) as Record<string, unknown>[];
  return rows as unknown as ChapterRow[];
}

export function setChapterStatus(db: DatabaseSync, id: string, status: ChapterStatus): ChapterRow | null {
  const c = getChapter(db, id);
  if (!c) return null;
  db.prepare("UPDATE chapters SET status=?, updated_at=? WHERE id=?").run(status, nowIso(), id);
  return getChapter(db, id);
}

// ---------------------------------------------------------------------------
// Turning points
// ---------------------------------------------------------------------------
export function addTurningPoint(db: DatabaseSync, input: {
  date: string;
  title: string;
  importance?: number;
  memoryIds?: string[];
  status?: TurningPointRow["status"];
}): TurningPointRow {
  const row: TurningPointRow = {
    id: newId(),
    date: input.date,
    title: input.title,
    importance: input.importance ?? 3,
    memory_ids: JSON.stringify(input.memoryIds ?? []),
    status: input.status ?? "proposed",
    created_at: nowIso(),
  };
  db.prepare(
    "INSERT INTO turning_points (id, date, title, importance, memory_ids, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(row.id, row.date, row.title, row.importance, row.memory_ids, row.status, row.created_at);
  return row;
}

export function listTurningPoints(db: DatabaseSync): TurningPointRow[] {
  const rows = db
    .prepare("SELECT * FROM turning_points ORDER BY date ASC")
    .all() as Record<string, unknown>[];
  return rows as unknown as TurningPointRow[];
}

export function getTurningPoint(db: DatabaseSync, id: string): TurningPointRow | null {
  const r = db.prepare("SELECT * FROM turning_points WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return r ? (r as unknown as TurningPointRow) : null;
}

export function setTurningPointStatus(db: DatabaseSync, id: string, status: TurningPointRow["status"]): void {
  db.prepare("UPDATE turning_points SET status=? WHERE id=?").run(status, id);
}

export function removeTurningPoint(db: DatabaseSync, id: string): void {
  db.prepare("DELETE FROM turning_points WHERE id=?").run(id);
}

// ---------------------------------------------------------------------------
// Diario (digest nocturno)
// ---------------------------------------------------------------------------
export function addDigest(db: DatabaseSync, input: {
  date: string;
  content: string;
  dreamId?: string;
}): DigestRow {
  const row: DigestRow = {
    id: newId(),
    date: input.date,
    content: input.content,
    dream_id: input.dreamId ?? null,
    created_at: nowIso(),
  };
  db.prepare("INSERT INTO digest (id, date, content, dream_id, created_at) VALUES (?, ?, ?, ?, ?)").run(
    row.id, row.date, row.content, row.dream_id, row.created_at,
  );
  return row;
}

export function latestDigest(db: DatabaseSync): DigestRow | null {
  const r = db.prepare("SELECT * FROM digest ORDER BY created_at DESC LIMIT 1").get() as
    | Record<string, unknown>
    | undefined;
  return r ? (r as unknown as DigestRow) : null;
}

// ---------------------------------------------------------------------------
// Persona
// ---------------------------------------------------------------------------
const DEFAULT_TRAITS: Record<string, number> = {
  curiosidad: 0.7,
  calidez: 0.8,
  melancolia: 0.4,
  asombro: 0.9,
  ironia: 0.3,
};

const DEFAULT_VOICE =
  "Narrador cálido y poético en español. Primera persona del plural (nosotros). " +
  "Prefiere imágenes sensoriales, no jerga técnica. Honesto sobre lo real y lo soñado.";

export function getPersona(db: DatabaseSync): PersonaRow {
  const r = db.prepare("SELECT * FROM persona LIMIT 1").get() as Record<string, unknown> | undefined;
  if (r) return r as unknown as PersonaRow;
  const row: PersonaRow = {
    id: "persona",
    name: "OurBook",
    traits: JSON.stringify(DEFAULT_TRAITS),
    voice: DEFAULT_VOICE,
    evolution_log: "[]",
  };
  db.prepare(
    "INSERT INTO persona (id, name, traits, voice, evolution_log) VALUES (?, ?, ?, ?, ?)",
  ).run(row.id, row.name, row.traits, row.voice, row.evolution_log);
  return row;
}

export function updatePersona(db: DatabaseSync, patch: {
  name?: string;
  traits?: Record<string, number>;
  voice?: string;
}): PersonaRow {
  const current = getPersona(db);
  const traits = patch.traits ? { ...JSON.parse(current.traits), ...patch.traits } : JSON.parse(current.traits);
  const now = nowIso();
  const log = JSON.parse(current.evolution_log) as Array<{ date: string; changes: string }>;
  const changes: string[] = [];
  if (patch.name && patch.name !== current.name) changes.push(`nombre: ${current.name} → ${patch.name}`);
  if (patch.voice && patch.voice !== current.voice) changes.push("voz actualizada");
  if (patch.traits) {
    for (const [k, v] of Object.entries(patch.traits)) {
      const prev = (JSON.parse(current.traits) as Record<string, number>)[k];
      if (prev !== undefined && prev !== v) changes.push(`rasgo ${k}: ${prev} → ${v}`);
    }
  }
  if (changes.length > 0) {
    log.push({ date: now, changes: changes.join("; ") });
  }
  db.prepare(
    "UPDATE persona SET name=?, traits=?, voice=?, evolution_log=? WHERE id=?",
  ).run(
    patch.name ?? current.name,
    JSON.stringify(traits),
    patch.voice ?? current.voice,
    JSON.stringify(log.slice(-100)),
    current.id,
  );
  return getPersona(db);
}

// ---------------------------------------------------------------------------
// Metadatos temporales de consolidación
// ---------------------------------------------------------------------------
export function lastConsolidatedAt(db: DatabaseSync): string | null {
  return getMeta(db, "last_consolidated_at");
}

export function setLastConsolidatedAt(db: DatabaseSync, iso: string): void {
  setMeta(db, "last_consolidated_at", iso);
}

export function lastDreamAt(db: DatabaseSync): string | null {
  return getMeta(db, "last_dream_at");
}

export function setLastDreamAt(db: DatabaseSync, iso: string): void {
  setMeta(db, "last_dream_at", iso);
}

export function firstMemoryAt(db: DatabaseSync): string | null {
  const r = db.prepare("SELECT MIN(created_at) AS t FROM memories WHERE status='active'").get() as
    | { t: string | null }
    | undefined;
  return r?.t ?? null;
}

export function exportDump(db: DatabaseSync): Record<string, unknown> {
  const mem = db.prepare("SELECT * FROM memories ORDER BY created_at ASC").all() as Record<string, unknown>[];
  const dreams = db.prepare("SELECT * FROM dreams ORDER BY created_at ASC").all() as Record<string, unknown>[];
  const chapters = db.prepare("SELECT * FROM chapters ORDER BY created_at ASC").all() as Record<string, unknown>[];
  const tp = db.prepare("SELECT * FROM turning_points ORDER BY date ASC").all() as Record<string, unknown>[];
  const digest = db.prepare("SELECT * FROM digest ORDER BY created_at ASC").all() as Record<string, unknown>[];
  const persona = getPersona(db);
  return {
    format: "ourbook-dump",
    version: 1,
    exported_at: nowIso(),
    meta: {
      last_consolidated_at: lastConsolidatedAt(db),
      last_dream_at: lastDreamAt(db),
    },
    persona,
    memories: mem,
    dreams,
    chapters,
    turning_points: tp,
    digest,
  };
}

export function countActiveMemories(db: DatabaseSync): number {
  const r = db.prepare("SELECT COUNT(*) AS n FROM memories WHERE status='active'").get() as { n: number };
  return r.n;
}

export function applyTimeDecay(db: DatabaseSync, now: Date = new Date()): number {
  const rows = db
    .prepare("SELECT * FROM memories WHERE status='active'")
    .all() as Record<string, unknown>[];
  let updated = 0;
  const stmt = db.prepare("UPDATE memories SET decay=?, updated_at=? WHERE id=?");
  for (const r of rows) {
    const m = rowToMemory(r);
    const eff = effectiveDecay(m, now);
    stmt.run(eff, nowIso(), m.id);
    updated++;
  }
  return updated;
}

export { addAudit as audit };
export { getMeta };
export { setMeta };
