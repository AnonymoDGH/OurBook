import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { Config } from "./config.js";
import type { Mnemosyne } from "./mnemosyne/engine.js";
import {
  addChapter,
  addDigest,
  addDream,
  addMemory,
  addTurningPoint,
  applyTimeDecay,
  archiveMemory,
  audit,
  countActiveMemories,
  exportDump,
  firstMemoryAt,
  getMemory,
  getPersona,
  lastConsolidatedAt,
  lastDreamAt,
  listActiveMemories,
  listChapters,
  listTurningPoints,
  purgeMemory,
  removeTurningPoint,
  searchMemories,
  setChapterStatus,
  setLastConsolidatedAt,
  setLastDreamAt,
  setTurningPointStatus,
  softDeleteMemory,
  updateMemory,
  updatePersona,
} from "./db/repo.js";
import { addAudit, logEngine } from "./db/database.js";
import type { MemoryRow } from "./types.js";
import { clamp, dateOnly, nowIso, prettyDate, snippet, tokenize } from "./lib/util.js";
import { dreamSalience, isArchiveCandidate } from "./lib/decay.js";
import { diaryPrompt, dreamPrompt, labelPrompt } from "./mnemosyne/prompt.js";
import { offlineDiary, offlineDream, offlineLabel } from "./mnemosyne/offline.js";
import { buildBookHtml, buildBookMarkdown } from "./export/render.js";
import { buildSeed, importSeed, seedFromDump, type IdentitySeed } from "./export/seed.js";

// ---------------------------------------------------------------------------
// Tools de OurBook. Cada handler recibe argumentos ya validados por zod.
// ---------------------------------------------------------------------------

export interface ToolContext {
  db: DatabaseSync;
  cfg: Config;
  mnemosyne: Mnemosyne;
}

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

function ok(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

function fail(text: string): ToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

function firstWords(s: string, n: number): string {
  return s.split(/\s+/).slice(0, n).join(" ") || "Un momento";
}

function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function pickWeighted(pool: MemoryRow[], count: number): MemoryRow[] {
  const scored = pool
    .map((m) => ({ m, s: dreamSalience(m) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, Math.max(count * 3, count));
  const total = scored.reduce((a, x) => a + x.s, 0) || 1;
  const out: MemoryRow[] = [];
  while (out.length < Math.min(count, scored.length)) {
    let r = Math.random() * total;
    let pick = scored[0]!;
    for (const x of scored) {
      r -= x.s;
      if (r <= 0) {
        pick = x;
        break;
      }
    }
    if (!out.includes(pick.m)) out.push(pick.m);
  }
  return out;
}

function formatMemory(m: MemoryRow, includePrivate: boolean): string {
  const date = prettyDate(m.created_at);
  const tags = (JSON.parse(m.tags) as string[]).join(" #");
  const priv = m.privacy === "private" && includePrivate ? " 🔒" : "";
  return `- [${date}] (${m.veracity}, importancia ${m.importance}, huella ${Math.round(m.decay * 100)}%)${priv} ${m.content}${tags ? ` #${tags}` : ""}`;
}

// ---------------------------------------------------------------------------
// remember
// ---------------------------------------------------------------------------
export async function remember(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const { db, cfg, mnemosyne } = ctx;
  const a = args as {
    content: string;
    kind?: string;
    veracity?: string;
    privacy?: string;
    valence?: number;
    importance?: number;
    tags?: string[];
    flashbulb?: boolean;
  };
  const m = addMemory(db, {
    content: a.content,
    kind: a.kind as MemoryRow["kind"],
    veracity: a.veracity as MemoryRow["veracity"],
    privacy: a.privacy as MemoryRow["privacy"],
    valence: a.valence,
    importance: a.importance,
    tags: a.tags,
    flashbulb: a.flashbulb,
  });
  audit(db, "remember", m.id, { veracity: m.veracity, privacy: m.privacy });
  if (cfg.autoLabel && cfg.engine !== "offline") {
    void (async () => {
      const res = await mnemosyne.complete("label", labelPrompt(m.content), () => JSON.stringify(offlineLabel(m.content)));
      try {
        const parsed = JSON.parse(extractJson(res.text)) as {
          valence?: number;
          importance?: number;
          tags?: string[];
        };
        updateMemory(db, m.id, {
          valence: parsed.valence !== undefined ? clamp(parsed.valence, -1, 1) : m.valence,
          importance: parsed.importance !== undefined ? clamp(Math.round(parsed.importance), 1, 5) : m.importance,
          tags: parsed.tags,
        });
      } catch {
        /* etiquetado automático es best-effort */
      }
    })();
  }
  return ok(`Guardado en el libro: ${formatMemory(m, true)}`);
}

// ---------------------------------------------------------------------------
// recall
// ---------------------------------------------------------------------------
export async function recall(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const { db } = ctx;
  const a = args as {
    query?: string;
    veracity?: MemoryRow["veracity"][];
    include_private?: boolean;
    from?: string;
    to?: string;
    valence_min?: number;
    valence_max?: number;
    tag?: string;
    limit?: number;
    max_chars?: number;
  };
  const hits = searchMemories(db, {
    query: a.query,
    veracity: a.veracity,
    includePrivate: a.include_private,
    from: a.from,
    to: a.to,
    valenceMin: a.valence_min,
    valenceMax: a.valence_max,
    tag: a.tag,
    limit: a.limit,
  });
  if (hits.length === 0) {
    return ok("No encuentro nada en el libro con esas condiciones. ¿Quieres contármelo para guardarlo?");
  }
  const lines = hits.map((m) => `- [${prettyDate(m.created_at)}] (${m.veracity}, importancia ${m.importance}) ${snippet(m.content, a.query ?? "", a.max_chars)}`);
  return ok(`Recuerdos encontrados (${hits.length}):\n${lines.join("\n")}`);
}

// ---------------------------------------------------------------------------
// dream (REM) — Mnemosyne
// ---------------------------------------------------------------------------
export async function dream(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const { db, cfg, mnemosyne } = ctx;
  const a = args as {
    mode: "tonight" | "themed" | "daydream";
    theme?: string;
    seed_tags?: string[];
    count?: number;
    include_private?: boolean;
  };
  const includePrivate = a.include_private ?? cfg.includePrivateInDreams;
  let pool = listActiveMemories(db, { veracity: ["real", "observed"], includePrivate });
  if (pool.length === 0) {
    return fail("Mnemosyne no tiene fragmentos que soñar: el libro aún no tiene recuerdos.");
  }

  let selected: MemoryRow[];
  if (a.mode === "themed") {
    const filters = [...(a.seed_tags ?? [])];
    if (a.theme) filters.push(...tokenize(a.theme));
    if (filters.length > 0) {
      const sub = pool.filter((m) =>
        (JSON.parse(m.tags) as string[]).some((t) => filters.includes(t)),
      );
      if (sub.length > 0) pool = sub;
    }
    selected = pickWeighted(pool, a.count ?? 6);
  } else if (a.mode === "daydream") {
    selected = shuffle(pool).slice(0, a.count ?? 6);
  } else {
    selected = pickWeighted(pool, a.count ?? 6);
  }

  const frags = selected.map((m) => ({
    id: m.id,
    content: snippet(m.content, "", 240),
    valence: m.valence,
    tags: JSON.parse(m.tags) as string[],
  }));
  const persona = getPersona(db);
  const prompt = dreamPrompt(persona, frags, { mode: a.mode, theme: a.theme, seedTags: a.seed_tags });
  const offline = () => offlineDream({
    fragments: frags.map((f) => ({ id: f.id, content: f.content })),
    theme: a.theme,
    mode: a.mode,
  });

  let text: string;
  let engine: string;
  let model: string | null = null;
  let theme: string | null;
  if (cfg.engine === "offline") {
    const od = offline();
    text = od.content;
    theme = a.theme ?? od.theme;
    engine = "offline";
  } else {
    const res = await mnemosyne.complete("dream", prompt, () => offline().content);
    text = res.text;
    engine = res.engine;
    model = res.model;
    theme = a.theme ?? firstWords(text.split("\n")[0] ?? "", 8).replace(/^SUEÑO:?\s*/i, "");
    if (!theme || theme.length < 3) theme = a.theme ?? "sueño sin nombre";
  }

  const dreamRow = addDream(db, {
    content: text,
    theme: theme ?? undefined,
    seedFragments: frags.map((f) => ({ id: f.id, snippet: f.content })),
    engine,
  });
  setLastDreamAt(db, nowIso());
  audit(db, "dream", dreamRow.id, { engine, fragments: frags.map((f) => f.id) });

  const sources = frags.map((f) => `  ${f.id.slice(0, 8)} — ${f.content.slice(0, 120)}`).join("\n");
  return ok(
    `Mnemosyne ha soñado (motor: ${engine}${model ? ` / ${model}` : ""}, ${frags.length} fragmentos):\n\n${text}\n\n` +
      `FUENTES DEL SUEÑO (fragmentos):\n${sources}\n\n` +
      `⚠ Este sueño es veracity=imagined: ficción honesta, no un hecho. Nunca debe presentarse como recuerdo real.`,
  );
}

// ---------------------------------------------------------------------------
// consolidate (NREM) — página del diario + decaimiento + archivo
// ---------------------------------------------------------------------------
interface DiaryGroup {
  label: string;
  count: number;
  top: MemoryRow[];
}

function groupByTag(memories: MemoryRow[]): DiaryGroup[] {
  const groups = new Map<string, MemoryRow[]>();
  for (const m of memories) {
    const tags = JSON.parse(m.tags) as string[];
    const key = tags[0] ?? "sin tema";
    const arr = groups.get(key) ?? [];
    arr.push(m);
    groups.set(key, arr);
  }
  return [...groups.entries()]
    .map(([label, arr]) => ({
      label,
      count: arr.length,
      top: [...arr].sort((a, b) => b.importance - a.importance).slice(0, 4),
    }))
    .sort((a, b) => b.count - a.count);
}

export async function consolidate(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const { db, cfg, mnemosyne } = ctx;
  const a = args as { force?: boolean; auto_archive?: boolean };
  const active = listActiveMemories(db, { veracity: ["real", "observed"], includePrivate: true });
  if (active.length === 0) return fail("El libro está vacío: no hay nada que consolidar.");
  if (!a.force && active.length < 5) {
    return ok(`Aún no es noche de consolidar: hay ${active.length} recuerdos (mínimo 5). Sigue contando.`);
  }

  applyTimeDecay(db);
  const groups = groupByTag(active);
  const seenCandidates = new Set<string>();
  const candidates = active
    .filter((m) => m.importance >= 4 || m.flashbulb || Math.abs(m.valence) >= 0.8)
    .map((m) => {
      const title = firstWords(m.content, 8);
      const key = title.toLowerCase();
      if (seenCandidates.has(key)) return null;
      seenCandidates.add(key);
      return { id: m.id, title, importance: m.importance, date: dateOnly(m.created_at) };
    })
    .filter((c): c is { id: string; title: string; importance: number; date: string } => c !== null);

  const persona = getPersona(db);
  const date = dateOnly(nowIso());
  const prompt = diaryPrompt(persona, groups, candidates, date);
  const res = await mnemosyne.complete("consolidate", prompt, () => offlineDiary({ groups, date }));
  addDigest(db, { date, content: res.text });

  let archived = 0;
  const doArchive = a.auto_archive ?? cfg.autoArchive;
  if (doArchive) {
    for (const m of active) {
      if (isArchiveCandidate(m)) {
        archiveMemory(db, m.id);
        audit(db, "archive", m.id, { reason: "decay", note: "consolidado en el diario, nunca borrado" });
        archived++;
      }
    }
  }

  const existing = new Set(listTurningPoints(db).map((t) => t.title));
  let added = 0;
  for (const c of candidates) {
    if (c.importance >= 4 && !existing.has(c.title)) {
      addTurningPoint(db, { date: c.date, title: c.title, importance: c.importance, memoryIds: [c.id], status: "proposed" });
      existing.add(c.title);
      added++;
    }
  }

  setLastConsolidatedAt(db, nowIso());
  audit(db, "consolidate", "diary", { engine: res.engine, groups: groups.length, archived, turning_points: added });
  return ok(
    `Consolidación NREM completada (motor: ${res.engine}).\n\n` +
      `PÁGINA DEL DIARIO (${date}):\n${res.text}\n\n` +
      `- ${groups.length} temas del día · ${added} momentos propuestos · ${archived} recuerdos archivados al resumen (nunca borrados).`,
  );
}

// ---------------------------------------------------------------------------
// chapter — el agente compone con el modelo principal; OurBook solo entrega
// ---------------------------------------------------------------------------
export async function chapter(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const { db } = ctx;
  const a = args as {
    action: "draft" | "commit" | "publish" | "list";
    title?: string;
    prose?: string;
    range_start?: string;
    range_end?: string;
    chapter_id?: string;
    limit?: number;
  };

  if (a.action === "list") {
    const chapters = listChapters(db, undefined, a.limit ?? 10);
    if (chapters.length === 0) return ok("Todavía no hay capítulos.");
    return ok(
      chapters
        .map((c) => `- [${c.status}] ${c.title} — ${c.prose.length} caracteres, ${prettyDate(c.created_at)}`)
        .join("\n"),
    );
  }

  if (a.action === "publish") {
    const id = a.chapter_id;
    if (!id) return fail("chapter_id requerido para publicar.");
    const c = setChapterStatus(db, id, "published");
    if (!c) return fail("Capítulo no encontrado.");
    audit(db, "chapter_publish", id, { title: c.title });
    return ok(`Capítulo publicado: ${c.title}`);
  }

  if (a.action === "commit") {
    if (!a.prose) return fail("commit requiere prose.");
    const title = a.title?.trim() || "Capítulo sin título";
    const c = addChapter(db, {
      title,
      prose: a.prose,
      rangeStart: a.range_start,
      rangeEnd: a.range_end,
      status: "draft",
    });
    audit(db, "chapter_commit", c.id, { title, chars: a.prose.length });
    return ok(`Capítulo guardado como borrador: "${c.title}" (id ${c.id.slice(0, 8)}). Publícalo con action='publish' cuando quieras.`);
  }

  // draft
  const mems = listActiveMemories(db, {
    veracity: ["real", "observed"],
    includePrivate: false,
    from: a.range_start,
    to: a.range_end,
  }).sort((x, y) => x.created_at.localeCompare(y.created_at));
  if (mems.length === 0) {
    return fail("No hay recuerdos reales en ese rango para escribir un capítulo.");
  }
  const persona = getPersona(db);
  const tps = listTurningPoints(db).filter(
    (t) => (!a.range_start || t.date >= dateOnly(a.range_start)) && (!a.range_end || t.date <= dateOnly(a.range_end)),
  );
  const lines = [
    `Prepara el capítulo "${a.title ?? "de esta época"}" (${mems.length} recuerdos reales en el rango).`,
    "",
    "FRAGMENTOS (usa SOLO estos, en este orden temporal):",
    ...mems.map((m, i) => `${i + 1}. [${prettyDate(m.created_at)}] ${m.content}`),
  ];
  if (tps.length > 0) {
    lines.push("", "MOMENTOS DESTACADOS:", ...tps.map((t) => `- ★ ${t.title} (${prettyDate(t.date)})`));
  }
  lines.push(
    "",
    "INSTRUCCIONES PARA EL NARRADOR (modelo principal):",
    `- Compón 400-800 palabras en español, primera persona del plural, con la voz: ${persona.voice}`,
    "- No inventes hechos que no estén en los fragmentos.",
    "- No menciones sueños ni fantasías: esto es la crónica real.",
    `- Cuando lo tengas, llama a la tool book.chapter con action='commit', title=<título>, prose=<tu texto>, range_start=..., range_end=...`,
  );
  return ok(lines.join("\n"));
}

// ---------------------------------------------------------------------------
// timeline / anniversaries
// ---------------------------------------------------------------------------
export async function timeline(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const { db } = ctx;
  const a = args as { limit?: number; from?: string; to?: string };
  const mems = listActiveMemories(db, {
    veracity: ["real", "observed"],
    includePrivate: true,
    from: a.from,
    to: a.to,
  }).sort((x, y) => x.created_at.localeCompare(y.created_at));
  const tps = listTurningPoints(db).filter(
    (t) => (!a.from || t.date >= dateOnly(a.from)) && (!a.to || t.date <= dateOnly(a.to)),
  );
  const events: Array<{ date: string; line: string }> = [];
  for (const tp of tps) events.push({ date: tp.date, line: `★ **${tp.title}**` });
  for (const m of mems) events.push({ date: m.created_at.slice(0, 10), line: m.content });
  events.sort((x, y) => x.date.localeCompare(y.date));
  const slice = events.slice(-(a.limit ?? 50));
  return ok(
    `Línea de vida (${slice.length} de ${events.length} eventos):\n${slice.map((e) => `- ${prettyDate(e.date)}: ${e.line}`).join("\n")}`,
  );
}

function mmdd(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function anniversaries(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const { db } = ctx;
  const a = args as { date?: string; days_window?: number; limit?: number };
  const target = a.date ?? dateOnly(nowIso());
  const base = new Date(`${target}T00:00:00Z`);
  const windowDates: string[] = [];
  for (let off = -(a.days_window ?? 1); off <= (a.days_window ?? 1); off++) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + off);
    windowDates.push(mmdd(d));
  }
  const cutoff = new Date(base);
  cutoff.setUTCDate(cutoff.getUTCDate() - 7);
  const cutoffIso = cutoff.toISOString();
  const cutoffDate = cutoffIso.slice(0, 10);

  const memRows = db
    .prepare(
      `SELECT * FROM memories WHERE status='active' AND substr(created_at,6,5) IN (${windowDates.map(() => "?").join(",")})
       AND created_at < ? ORDER BY importance DESC LIMIT ?`,
    )
    .all(...windowDates, cutoffIso, a.limit ?? 10) as unknown as MemoryRow[];
  const tpRows = db
    .prepare(
      `SELECT * FROM turning_points WHERE substr(date,6,5) IN (${windowDates.map(() => "?").join(",")})
       AND date < ? ORDER BY importance DESC LIMIT ?`,
    )
    .all(...windowDates, cutoffDate, a.limit ?? 10) as Array<{
    date: string;
    title: string;
    importance: number;
  }>;

  if (memRows.length === 0 && tpRows.length === 0) {
    return ok(`Hoy (${target}) no hay aniversarios en el libro todavía.`);
  }
  const yearNow = base.getUTCFullYear();
  const lines: string[] = [];
  for (const tp of tpRows) {
    const years = yearNow - Number(tp.date.slice(0, 4));
    lines.push(`- ★ Hace ${years} año${years === 1 ? "" : "s"}: ${tp.title}`);
  }
  for (const m of memRows) {
    const years = yearNow - Number(m.created_at.slice(0, 4));
    lines.push(`- Hace ${years} año${years === 1 ? "" : "s"}: ${m.content}`);
  }
  return ok(`Aniversarios del ${target}:\n${lines.join("\n")}`);
}

// ---------------------------------------------------------------------------
// persona / correct / forget / redact / turning_point
// ---------------------------------------------------------------------------
export async function persona(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const { db } = ctx;
  const a = args as { action?: "get" | "update"; name?: string; traits?: Record<string, number>; voice?: string };
  if (a.action === "update") {
    const p = updatePersona(db, { name: a.name, traits: a.traits, voice: a.voice });
    audit(db, "persona_update", p.id, { fields: Object.keys({ name: a.name, traits: a.traits, voice: a.voice }).filter((k) => (a as Record<string, unknown>)[k] !== undefined) });
    return ok(personaText(p.id, p.name, JSON.parse(p.traits), p.voice, JSON.parse(p.evolution_log)));
  }
  const p = getPersona(db);
  return ok(personaText(p.id, p.name, JSON.parse(p.traits), p.voice, JSON.parse(p.evolution_log)));
}

function personaText(
  id: string,
  name: string,
  traits: Record<string, number>,
  voice: string,
  log: Array<{ date: string; changes: string }>,
): string {
  const t = Object.entries(traits).map(([k, v]) => `${k} ${Math.round(v * 100)}%`).join(" · ");
  const evo = log.slice(-5).map((e) => `- ${prettyDate(e.date)}: ${e.changes}`).join("\n");
  return `Persona (${id}):\n- Nombre: ${name}\n- Rasgos: ${t}\n- Voz: ${voice}\n${log.length > 0 ? `\nEvolución (últimas):\n${evo}` : ""}`;
}

export async function correct(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const { db } = ctx;
  const a = args as { memory_id: string; corrected_content: string; note?: string };
  const existing = getMemory(db, a.memory_id);
  if (!existing) return fail("Memoria no encontrada.");
  const updated = updateMemory(db, a.memory_id, { content: a.corrected_content });
  if (!updated) return fail("No se pudo corregir.");
  audit(db, "correct", a.memory_id, {
    old_content: existing.content,
    new_content: a.corrected_content,
    note: a.note ?? "",
  });
  return ok(
    `Reconsolidación: la memoria fue reescrita en su sitio (no añadida).\nANTES: ${existing.content}\nAHORA: ${updated.content}`,
  );
}

export async function forget(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const { db } = ctx;
  const a = args as { memory_id: string; purge?: boolean };
  const existing = getMemory(db, a.memory_id);
  if (!existing) return fail("Memoria no encontrada.");
  if (a.purge) {
    purgeMemory(db, a.memory_id);
    audit(db, "forget_purge", a.memory_id, { content: existing.content });
    return ok("Memoria eliminada por completo del libro.");
  }
  softDeleteMemory(db, a.memory_id);
  audit(db, "forget", a.memory_id, { content: existing.content });
  return ok("Memoria olvidada (queda en el archivo de auditoría; puedes purgarla con purge=true).");
}

export async function redact(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const { db } = ctx;
  const a = args as { terms: string[] };
  const now = nowIso();
  let total = 0;
  const targets: Array<[string, string, string]> = [
    ["memories", "content", "UPDATE memories SET content = replace(content, ?, '[redactado]'), updated_at=? WHERE content LIKE ?"],
    ["dreams", "content", "UPDATE dreams SET content = replace(content, ?, '[redactado]') WHERE content LIKE ?"],
    ["chapters", "prose", "UPDATE chapters SET prose = replace(prose, ?, '[redactado]') WHERE prose LIKE ?"],
    ["digest", "content", "UPDATE digest SET content = replace(content, ?, '[redactado]') WHERE content LIKE ?"],
  ];
  for (const term of a.terms) {
    for (const [table, , sql] of targets) {
      const stmt = db.prepare(sql);
      const r = table === "memories" ? stmt.run(term, now, `%${term}%`) : stmt.run(term, `%${term}%`);
      total += Number(r.changes);
    }
  }
  db.exec("INSERT INTO memories_fts(memories_fts) VALUES ('rebuild')");
  audit(db, "redact", "", { terms: a.terms, replaced: total });
  return ok(`Redacción completada: ${total} apariciones de ${a.terms.length} término(s) reemplazadas por [redactado].`);
}

export async function turningPoint(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const { db } = ctx;
  const a = args as {
    action: "list" | "add" | "remove" | "confirm";
    id?: string;
    date?: string;
    title?: string;
    importance?: number;
    memory_ids?: string[];
  };
  if (a.action === "list") {
    const tps = listTurningPoints(db);
    if (tps.length === 0) return ok("No hay momentos señalados todavía.");
    return ok(tps.map((t) => `- [${t.status}] ★ ${t.title} — ${prettyDate(t.date)} (importancia ${t.importance})`).join("\n"));
  }
  if (a.action === "add") {
    if (!a.title) return fail("title requerido.");
    const tp = addTurningPoint(db, {
      date: a.date ?? dateOnly(nowIso()),
      title: a.title,
      importance: a.importance,
      memoryIds: a.memory_ids,
      status: "proposed",
    });
    audit(db, "turning_point_add", tp.id, { title: a.title });
    return ok(`Momento añadido: ★ ${a.title}`);
  }
  if (a.action === "remove") {
    if (!a.id) return fail("id requerido.");
    removeTurningPoint(db, a.id);
    audit(db, "turning_point_remove", a.id, {});
    return ok("Momento retirado.");
  }
  if (a.action === "confirm") {
    if (!a.id) return fail("id requerido.");
    setTurningPointStatus(db, a.id, "confirmed");
    audit(db, "turning_point_confirm", a.id, {});
    return ok("Momento confirmado en la crónica.");
  }
  return fail("acción desconocida");
}

// ---------------------------------------------------------------------------
// export / import / status
// ---------------------------------------------------------------------------
export async function exportBook(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const { db, cfg } = ctx;
  const a = args as { format?: string; out_dir?: string };
  const outDir = a.out_dir ?? cfg.exportDir;
  fs.mkdirSync(outDir, { recursive: true });
  const fmt = a.format ?? "all";
  const written: string[] = [];

  const write = (name: string, content: string) => {
    const p = path.join(outDir, name);
    fs.writeFileSync(p, content, "utf8");
    written.push(`${name} (${fs.statSync(p).size} bytes)`);
  };

  if (fmt === "markdown" || fmt === "all") write("OurBook.md", buildBookMarkdown(db));
  if (fmt === "html" || fmt === "all") write("OurBook.html", buildBookHtml(buildBookMarkdown(db)));
  if (fmt === "json" || fmt === "all") write("ourbook-dump.json", JSON.stringify(exportDump(db), null, 2));
  if (fmt === "seed" || fmt === "all") write("identity-seed.json", JSON.stringify(buildSeed(db), null, 2));

  audit(db, "export", "", { format: fmt, files: written });
  return ok(`El libro fue escrito en ${outDir}:\n${written.map((w) => `- ${w}`).join("\n")}`);
}

export async function importBook(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const { db } = ctx;
  const a = args as { path: string; mode?: "merge" | "fresh" };
  let raw: string;
  try {
    raw = fs.readFileSync(a.path, "utf8");
  } catch (e) {
    return fail(`No pude leer ${a.path}: ${(e as Error).message}`);
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return fail("El archivo no es JSON válido.");
  }
  try {
    const seed = seedFromDump(data);
    const res = importSeed(db, seed, a.mode ?? "merge");
    audit(db, "import", a.path, { mode: a.mode ?? "merge", ...res });
    return ok(`Importado (${a.mode ?? "merge"}): ${res.memories} recuerdos, ${res.chapters} capítulos, ${res.turningPoints} momentos.`);
  } catch (e) {
    return fail(`Importación fallida: ${(e as Error).message}`);
  }
}

export async function status(ctx: ToolContext): Promise<ToolResult> {
  const { db, cfg, mnemosyne } = ctx;
  const byVeracity = db
    .prepare("SELECT veracity, COUNT(*) AS n FROM memories WHERE status='active' GROUP BY veracity")
    .all() as Array<{ veracity: string; n: number }>;
  const counts = {
    active: countActiveMemories(db),
    archived: (db.prepare("SELECT COUNT(*) AS n FROM memories WHERE status='archived'").get() as { n: number }).n,
    deleted: (db.prepare("SELECT COUNT(*) AS n FROM memories WHERE status='deleted'").get() as { n: number }).n,
    dreams: (db.prepare("SELECT COUNT(*) AS n FROM dreams").get() as { n: number }).n,
    chapters: (db.prepare("SELECT COUNT(*) AS n FROM chapters").get() as { n: number }).n,
    turningPoints: (db.prepare("SELECT COUNT(*) AS n FROM turning_points").get() as { n: number }).n,
    digests: (db.prepare("SELECT COUNT(*) AS n FROM digest").get() as { n: number }).n,
  };
  const trend = db
    .prepare(
      `SELECT substr(created_at,1,7) AS m, ROUND(avg(valence),2) AS v, COUNT(*) AS c
       FROM memories WHERE status='active' GROUP BY m ORDER BY m DESC LIMIT 6`,
    )
    .all() as Array<{ m: string; v: number; c: number }>;
  const engineTail = db
    .prepare("SELECT op, engine, model, ok, latency_ms, created_at FROM engine_log ORDER BY id DESC LIMIT 10")
    .all() as Array<{ op: string; engine: string; model: string | null; ok: number; latency_ms: number | null; created_at: string }>;
  const ping = await mnemosyne.ping();
  const size = fs.existsSync(cfg.dbPath) ? fs.statSync(cfg.dbPath).size : 0;

  return ok(
    [
      `OurBook — estado`,
      `- Libro: ${cfg.dbPath} (${(size / 1024).toFixed(1)} KB)`,
      `- Recuerdos: ${counts.active} activos (${counts.archived} archivados, ${counts.deleted} olvidados) · ${counts.dreams} sueños · ${counts.chapters} capítulos · ${counts.turningPoints} momentos · ${counts.digests} páginas de diario`,
      `- Por veracidad: ${byVeracity.map((r) => `${r.veracity}:${r.n}`).join(" · ")}`,
      `- Tendencia emocional (6 meses): ${trend.map((t) => `${t.m} (${t.c}) v=${t.v}`).join(" · ") || "sin datos"}`,
      `- Motor Mnemosyne: ${cfg.engine} → ${ping.reachable ? "disponible" : "no disponible"} (${ping.note})`,
      `- Consolidación: ${lastConsolidatedAt(db) ? prettyDate(lastConsolidatedAt(db)!) : "nunca"} · Último sueño: ${lastDreamAt(db) ? prettyDate(lastDreamAt(db)!) : "nunca"} · Inicio: ${firstMemoryAt(db) ? prettyDate(firstMemoryAt(db)!) : "—"}`,
      `- Últimas llamadas de motor (engine_log): ${engineTail.length === 0 ? "ninguna (cognición de fondo aún no usada)" : engineTail.map((e) => `[${e.op}/${e.engine} ${e.ok ? "ok" : "fallo"}]`).join(" ")}`,
    ].join("\n"),
  );
}

// Re-export de addAudit para server.ts
export { addAudit };
export type { IdentitySeed };
export { logEngine };
