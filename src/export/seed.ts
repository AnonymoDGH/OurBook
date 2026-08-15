import type { DatabaseSync } from "node:sqlite";
import type { MemoryRow } from "../types.js";
import { firstMemoryAt, getPersona, latestDreams, listChapters, listTurningPoints } from "../db/repo.js";
import { nowIso } from "../lib/util.js";

// ---------------------------------------------------------------------------
// Semilla de identidad: la vida portátil. Con identity-seed.json un agente
// nuevo puede heredar la historia (persona + momentos + capítulos + recuerdos
// reales), sin arrastrar sueños ni auditoría.
// ---------------------------------------------------------------------------

export interface IdentitySeed {
  format: "ourbook-seed";
  version: 1;
  exported_at: string;
  persona: { name: string; traits: Record<string, number>; voice: string; evolution_log: unknown[] };
  first_memory_at: string | null;
  turning_points: Array<{ date: string; title: string; importance: number }>;
  chapters: Array<{ title: string; range_start: string | null; range_end: string | null; prose: string }>;
  memories: Array<{
    id: string;
    content: string;
    kind: string;
    veracity: string;
    privacy: string;
    valence: number;
    importance: number;
    flashbulb: boolean;
    tags: string[];
    created_at: string;
  }>;
}

export function buildSeed(db: DatabaseSync): IdentitySeed {
  const persona = getPersona(db);
  const memories = db
    .prepare("SELECT * FROM memories WHERE status='active' AND veracity IN ('real','observed') ORDER BY created_at ASC")
    .all() as unknown as MemoryRow[];
  return {
    format: "ourbook-seed",
    version: 1,
    exported_at: nowIso(),
    persona: {
      name: persona.name,
      traits: JSON.parse(persona.traits) as Record<string, number>,
      voice: persona.voice,
      evolution_log: JSON.parse(persona.evolution_log) as unknown[],
    },
    first_memory_at: firstMemoryAt(db),
    turning_points: listTurningPoints(db)
      .filter((t) => t.status === "confirmed")
      .map((t) => ({ date: t.date, title: t.title, importance: t.importance })),
    chapters: listChapters(db, "published").map((c) => ({
      title: c.title,
      range_start: c.range_start,
      range_end: c.range_end,
      prose: c.prose,
    })),
    memories: memories.map((m) => ({
      id: m.id,
      content: m.content,
      kind: m.kind,
      veracity: m.veracity,
      privacy: m.privacy,
      valence: m.valence,
      importance: m.importance,
      flashbulb: m.flashbulb === 1,
      tags: JSON.parse(m.tags) as string[],
      created_at: m.created_at,
    })),
  };
}

export function importSeed(db: DatabaseSync, seed: IdentitySeed, mode: "merge" | "fresh"): {
  memories: number;
  chapters: number;
  turningPoints: number;
} {
  if (seed.format !== "ourbook-seed") {
    throw new Error("no es una semilla OurBook (falta format: ourbook-seed)");
  }
  if (mode === "fresh") {
    db.exec("DELETE FROM memories; DELETE FROM memories_fts;");
    db.exec("DELETE FROM dreams; DELETE FROM chapters; DELETE FROM turning_points; DELETE FROM digest;");
    db.exec("DELETE FROM audit_log; DELETE FROM persona;");
  }
  const persona = getPersona(db);
  db.prepare("UPDATE persona SET name=?, traits=?, voice=?, evolution_log=? WHERE id=?").run(
    seed.persona.name,
    JSON.stringify(seed.persona.traits),
    seed.persona.voice,
    JSON.stringify(seed.persona.evolution_log),
    persona.id,
  );

  const insMem = db.prepare(
    `INSERT OR IGNORE INTO memories
       (id, content, kind, veracity, privacy, valence, importance, flashbulb, tags,
        decay, access_count, last_accessed, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, NULL, 'active', ?, ?)`,
  );
  let memories = 0;
  for (const m of seed.memories) {
    insMem.run(
      m.id, m.content, m.kind, m.veracity, m.privacy, m.valence, m.importance,
      m.flashbulb ? 1 : 0, JSON.stringify(m.tags), m.created_at, nowIso(),
    );
    memories++;
  }
  db.exec("INSERT INTO memories_fts(memories_fts) VALUES ('rebuild')");

  const insCh = db.prepare(
    `INSERT OR IGNORE INTO chapters (id, title, range_start, range_end, prose, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'published', ?, ?)`,
  );
  let chapters = 0;
  for (const c of seed.chapters) {
    const id = `seed-ch-${Math.random().toString(36).slice(2, 10)}`;
    insCh.run(id, c.title, c.range_start, c.range_end, c.prose, nowIso(), nowIso());
    chapters++;
  }

  const insTp = db.prepare(
    `INSERT OR IGNORE INTO turning_points (id, date, title, importance, memory_ids, status, created_at)
     VALUES (?, ?, ?, ?, '[]', 'confirmed', ?)`,
  );
  let turningPoints = 0;
  for (const t of seed.turning_points) {
    const id = `seed-tp-${Math.random().toString(36).slice(2, 10)}`;
    insTp.run(id, t.date, t.title, t.importance, nowIso());
    turningPoints++;
  }
  void latestDreams;
  return { memories, chapters, turningPoints };
}

/** Acepta tanto una semilla como un volcado completo (ourbook-dump). */
export function seedFromDump(data: unknown): IdentitySeed {
  const d = data as Record<string, unknown>;
  if (d.format === "ourbook-seed") {
    return d as unknown as IdentitySeed;
  }
  if (d.format === "ourbook-dump") {
    const dump = d as {
      exported_at?: string;
      persona?: {
        name?: string;
        traits?: string;
        voice?: string;
        evolution_log?: string;
      };
      memories?: Array<{
        id: string;
        content: string;
        kind?: string;
        veracity?: string;
        privacy?: string;
        valence?: number;
        importance?: number;
        flashbulb?: number | boolean;
        tags?: string;
        created_at: string;
        status?: string;
      }>;
      chapters?: Array<{
        title: string;
        range_start?: string | null;
        range_end?: string | null;
        prose: string;
        status?: string;
      }>;
      turning_points?: Array<{
        date: string;
        title: string;
        importance?: number;
        status?: string;
      }>;
    };
    const persona = dump.persona ?? {};
    const memories = (dump.memories ?? [])
      .filter(
        (m) =>
          m.status === "active" && (m.veracity === "real" || m.veracity === "observed"),
      )
      .map((m) => ({
        id: m.id,
        content: m.content,
        kind: m.kind ?? "real",
        veracity: m.veracity ?? "real",
        privacy: m.privacy ?? "shared",
        valence: m.valence ?? 0,
        importance: m.importance ?? 3,
        flashbulb: m.flashbulb === 1 || m.flashbulb === true,
        tags: JSON.parse(m.tags ?? "[]") as string[],
        created_at: m.created_at,
      }));
    const chapters = (dump.chapters ?? [])
      .filter((c) => c.status === "published")
      .map((c) => ({
        title: c.title,
        range_start: c.range_start ?? null,
        range_end: c.range_end ?? null,
        prose: c.prose,
      }));
    const tps = (dump.turning_points ?? [])
      .filter((t) => t.status === "confirmed")
      .map((t) => ({ date: t.date, title: t.title, importance: t.importance ?? 3 }));
    return {
      format: "ourbook-seed",
      version: 1,
      exported_at: dump.exported_at ?? nowIso(),
      persona: {
        name: persona.name ?? "OurBook",
        traits: JSON.parse(persona.traits ?? "{}") as Record<string, number>,
        voice: persona.voice ?? "",
        evolution_log: JSON.parse(persona.evolution_log ?? "[]") as unknown[],
      },
      first_memory_at: null,
      turning_points: tps,
      chapters,
      memories,
    };
  }
  throw new Error("formato desconocido (no es ourbook-seed ni ourbook-dump)");
}
