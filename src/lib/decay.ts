import type { MemoryRow } from "../types.js";
import { clamp01 } from "./util.js";

// ---------------------------------------------------------------------------
// Modelo de decaimiento inspirado en la curva de olvido de Ebbinghaus y en la
// interferencia: la huella decae exponencialmente con la edad, pero más lento
// cuanto mayor es la importancia; evocar (recall) refuerza la huella
// (retrieval practice / spacing effect); las memorias "flashbulb" no decaen.
// ---------------------------------------------------------------------------

export const DECAY_BASE = 0.08; // tasa diaria para importancia 1
export const DECAY_GAMMA = 1.3; // cómo la importancia aplanaba la curva
export const ACCESS_REFRESH = 0.15; // refuerzo por cada evocación
export const ARCHIVE_THRESHOLD = 0.15; // por debajo de esto, candidata a resumen
export const MIN_ARCHIVE_AGE_DAYS = 14;

export function ageDays(createdAt: string, now: Date = new Date()): number {
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, (now.getTime() - t) / 86_400_000);
}

/** Huella efectiva en el momento actual (0..1). */
export function effectiveDecay(row: {
  importance: number;
  flashbulb: number;
  decay: number;
  created_at: string;
}, now: Date = new Date()): number {
  if (row.flashbulb) return 1;
  const days = ageDays(row.created_at, now);
  const lambda = DECAY_BASE / Math.pow(row.importance, DECAY_GAMMA);
  return clamp01(row.decay * Math.exp(-lambda * days));
}

/** Huella tras un acto de evocación. */
export function refreshedDecay(row: {
  flashbulb: number;
  decay: number;
}): number {
  if (row.flashbulb) return 1;
  return clamp01(row.decay + ACCESS_REFRESH);
}

export function isArchiveCandidate(
  row: { importance: number; flashbulb: number; decay: number; created_at: string },
  now: Date = new Date(),
): boolean {
  if (row.importance > 2 || row.flashbulb) return false;
  if (ageDays(row.created_at, now) < MIN_ARCHIVE_AGE_DAYS) return false;
  return effectiveDecay(row, now) < ARCHIVE_THRESHOLD;
}

/** Peso de muestreo onírico: la emoción y la importancia mandan (saliencia). */
export function dreamSalience(row: {
  importance: number;
  valence: number;
  decay: number;
  created_at: string;
}, now: Date = new Date()): number {
  const decay = effectiveDecay(
    { importance: row.importance, flashbulb: 0, decay: row.decay, created_at: row.created_at },
    now,
  );
  const emotion = Math.abs(row.valence) * 0.6 + 0.4;
  return decay * emotion * (row.importance / 5);
}

/** Factor de frescura para ranking (recencia suave). */
export function recencyBoost(createdAt: string, now: Date = new Date()): number {
  const days = ageDays(createdAt, now);
  return 1 + 0.5 * Math.exp(-days / 30);
}
