import { randomUUID } from "node:crypto";

export function newId(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Normaliza "YYYY-MM-DD" o ISO a fecha local "YYYY-MM-DD". */
export function dateOnly(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(iso);
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${mo}-${da}`;
  }
  return iso.slice(0, 10);
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export function clamp01(x: number): number {
  return clamp(x, 0, 1);
}

/** Recorta un texto dejando un fragmento centrado en la primera coincidencia. */
export function snippet(text: string, needle: string, maxLen = 240): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLen) return clean;
  const idx = needle ? clean.toLowerCase().indexOf(needle.toLowerCase()) : -1;
  const start = idx > maxLen / 2 ? idx - Math.floor(maxLen / 3) : 0;
  const cut = clean.slice(start, start + maxLen);
  return (start > 0 ? "…" : "") + cut + "…";
}

/** Normaliza un tag: minúsculas, sin acentos, sin símbolos. */
export function normalizeTag(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 40);
}

export function parseTags(raw: string[] | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const t of raw) {
    const n = normalizeTag(t);
    if (n.length >= 2) seen.add(n);
  }
  return [...seen];
}

export function titleCase(s: string): string {
  return s
    .split(" ")
    .map((w) => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function prettyDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" });
}

/** Tokeniza en palabras significativas (stopwords en español fuera). */
const STOPWORDS = new Set(
  `a al algo algunas algunos ante antes como con contra cual cuando de del desde donde dos el
   ella ellas ellos en entre era erais eran es esa esas ese esos esta estado estaba estan estar
   este esto estos fue fueron ha han hasta hay la las le les lo los me mi mis mucho muy nada
   ni no nos nosotros nuestra nuestro o os otra otras otro otros para pero por porque que quien
   se sea sean si sin sobre sois son soy su sus tal tambien te tiene tener ti toda todas todo
   todos tu tus un una uno unos vosotros ya yo su lo al del por mi mi`.split(/\s+/)
);

export function tokenize(text: string, maxTokens = 12): string[] {
  const out: string[] = [];
  for (const raw of text.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    const t = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (t.length >= 2 && !STOPWORDS.has(t) && !/^\d+$/.test(t)) {
      out.push(t);
      if (out.length >= maxTokens) break;
    }
  }
  return out;
}

/** PRNG determinista (mulberry32) para generadores offline reproducibles. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
