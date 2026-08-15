import { z } from "zod";

// ---------------------------------------------------------------------------
// Taxonomía de veracidad: la capa de honestidad de OurBook.
//  - real:        vivida juntos (la contó el usuario o pasó en sesión)
//  - observed:    inferida por el agente a partir de la conversación
//  - imagined:    sueño, ficción o ensueño (NUNCA se trata como hecho)
//  - hypothetical: especulación ("¿y si...?")
// ---------------------------------------------------------------------------
export const VERACITIES = ["real", "observed", "imagined", "hypothetical"] as const;
export type Veracity = (typeof VERACITIES)[number];

export const KINDS = ["real", "observed"] as const;
export type Kind = (typeof KINDS)[number];

export const PRIVACIES = ["shared", "private"] as const;
export type Privacy = (typeof PRIVACIES)[number];

export const STATUSES = ["active", "archived", "deleted"] as const;
export type Status = (typeof STATUSES)[number];

export const CHAPTER_STATUSES = ["draft", "published"] as const;
export type ChapterStatus = (typeof CHAPTER_STATUSES)[number];

export const TURNING_POINT_STATUSES = ["proposed", "confirmed"] as const;
export type TurningPointStatus = (typeof TURNING_POINT_STATUSES)[number];

export interface MemoryRow {
  id: string;
  content: string;
  kind: Kind;
  veracity: Veracity;
  privacy: Privacy;
  valence: number; // -1..1
  importance: number; // 1..5
  flashbulb: number; // 0|1 — memoria "flash" inmune al decaimiento
  tags: string; // JSON string[]
  decay: number; // 0..1 fuerza de la huella
  access_count: number;
  last_accessed: string | null;
  status: Status;
  created_at: string;
  updated_at: string;
}

export interface DreamRow {
  id: string;
  content: string;
  theme: string | null;
  seed_fragments: string; // JSON [{id, snippet}]
  engine: string; // qwen-reverse | local | offline
  created_at: string;
}

export interface ChapterRow {
  id: string;
  title: string;
  range_start: string | null;
  range_end: string | null;
  prose: string;
  status: ChapterStatus;
  created_at: string;
  updated_at: string;
}

export interface TurningPointRow {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  importance: number;
  memory_ids: string; // JSON string[]
  status: TurningPointStatus;
  created_at: string;
}

export interface DigestRow {
  id: string;
  date: string; // YYYY-MM-DD
  content: string;
  dream_id: string | null;
  created_at: string;
}

export interface PersonaRow {
  id: string;
  name: string;
  traits: string; // JSON Record<string, number>
  voice: string;
  evolution_log: string; // JSON [{date, changes}]
}

export interface EngineLogRow {
  id: number;
  op: string;
  engine: string;
  model: string | null;
  ok: number; // 0|1
  latency_ms: number | null;
  created_at: string;
}

export interface AuditRow {
  id: number;
  action: string;
  target_id: string;
  detail: string; // JSON
  created_at: string;
}

export interface MemorySeedFragment {
  id: string;
  snippet: string;
}

// ---------------------------------------------------------------------------
// Esquemas zod de los argumentos de las tools
// ---------------------------------------------------------------------------
export const RememberArgs = z.object({
  content: z.string().min(1).max(8000).describe("El recuerdo tal como se vivió"),
  kind: z.enum(KINDS).default("real"),
  veracity: z.enum(VERACITIES).default("real"),
  privacy: z.enum(PRIVACIES).default("shared"),
  valence: z.number().min(-1).max(1).optional().describe("-1 triste … +1 feliz"),
  importance: z.number().int().min(1).max(5).default(3),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
  flashbulb: z.boolean().default(false).describe("Memoria imborrable (Brown & Kulik)"),
});

export const RecallArgs = z.object({
  query: z.string().max(500).optional(),
  veracity: z.array(z.enum(VERACITIES)).default(["real", "observed"]),
  include_private: z.boolean().default(false),
  from: z.string().optional().describe("ISO o YYYY-MM-DD"),
  to: z.string().optional().describe("ISO o YYYY-MM-DD"),
  valence_min: z.number().min(-1).max(1).optional(),
  valence_max: z.number().min(-1).max(1).optional(),
  tag: z.string().max(40).optional(),
  limit: z.number().int().min(1).max(20).default(5),
  max_chars: z.number().int().min(80).max(2000).default(500),
});

export const DreamArgs = z.object({
  mode: z.enum(["tonight", "themed", "daydream"]).default("tonight"),
  theme: z.string().max(200).optional(),
  seed_tags: z.array(z.string().max(40)).max(10).default([]),
  count: z.number().int().min(3).max(10).default(6),
  include_private: z.boolean().optional(),
});

export const ConsolidateArgs = z.object({
  force: z.boolean().default(false),
  auto_archive: z.boolean().optional(),
});

export const ChapterArgs = z.object({
  action: z.enum(["draft", "commit", "publish", "list"]).default("draft"),
  title: z.string().max(200).optional(),
  prose: z.string().max(30000).optional(),
  range_start: z.string().optional(),
  range_end: z.string().optional(),
  chapter_id: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(10),
});

export const TimelineArgs = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const AnniversariesArgs = z.object({
  date: z.string().optional().describe("YYYY-MM-DD; por defecto hoy"),
  days_window: z.number().int().min(0).max(7).default(1),
  limit: z.number().int().min(1).max(20).default(10),
});

export const PersonaArgs = z.object({
  action: z.enum(["get", "update"]).default("get"),
  name: z.string().max(80).optional(),
  traits: z.record(z.string(), z.number()).optional(),
  voice: z.string().max(2000).optional(),
});

export const CorrectArgs = z.object({
  memory_id: z.string(),
  corrected_content: z.string().min(1).max(8000),
  note: z.string().max(1000).optional(),
});

export const ForgetArgs = z.object({
  memory_id: z.string(),
  purge: z.boolean().default(false),
});

export const RedactArgs = z.object({
  terms: z.array(z.string().min(1).max(200)).min(1).max(50),
});

export const TurningPointArgs = z.object({
  action: z.enum(["list", "add", "remove", "confirm"]).default("list"),
  id: z.string().optional(),
  date: z.string().optional(),
  title: z.string().max(200).optional(),
  importance: z.number().int().min(1).max(5).optional(),
  memory_ids: z.array(z.string()).max(50).optional(),
});

export const ExportArgs = z.object({
  format: z.enum(["markdown", "html", "json", "seed", "all"]).default("all"),
  out_dir: z.string().optional(),
});

export const ImportArgs = z.object({
  path: z.string().min(1).describe("Ruta al identity-seed.json o volcado JSON"),
  mode: z.enum(["merge", "fresh"]).default("merge"),
});

export const StatusArgs = z.object({});
