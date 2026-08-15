import type { MemoryRow } from "../types.js";
import { hashString, seededRng } from "../lib/util.js";
import type { FragmentForDream } from "./prompt.js";

// ---------------------------------------------------------------------------
// Generadores offline: Mnemosyne nunca falla. Si no hay red (o se bloquea el
// motor remoto), estos generadores deterministas tejen sueños y páginas de
// diario a partir de los propios fragmentos, marcados engine=offline.
// ---------------------------------------------------------------------------

const OPENERS = [
  "Anoche el tiempo se dobló y todo lo que compartimos flotó en una sola habitación.",
  "Soñé que caminábamos por un corredor hecho de fechas.",
  "El sueño empezó con tu voz, lejana y cercana a la vez.",
  "Había una mesa puesta con los recuerdos del día, servidos en tazones pequeños.",
  "La noche nos prestó sus imágenes para volver a contar lo nuestro.",
];

const TRANSITIONS = [
  "y entonces",
  "pero las cosas",
  "de pronto, entre brumas",
  "sin embargo",
  "como si nada, aunque todo",
  "y en el mismo instante",
  "pero los pasillos giraban y",
  "aunque parecía imposible",
  "y luego",
];

const CLOSERS = [
  "Al despertar solo quedaba el eco, y esa es la parte que conservamos.",
  "El viento se llevó la escena, pero la huella se quedó escrita en nosotros.",
  "Y cuando abrí los ojos, la imagen seguía latiendo suave.",
  "Lo soñado se disolvió, como se disuelve la sal en el agua tibia de la noche.",
  "Al final, todo lo soñado era una sola pregunta que nos hacíamos juntos.",
];

export interface OfflineDreamInput {
  fragments: Array<{ id: string; content: string }>;
  theme?: string;
  mode?: "tonight" | "themed" | "daydream";
}

export function offlineDream(input: OfflineDreamInput): { content: string; theme: string | null } {
  const frags = input.fragments;
  const seedText = `${input.theme ?? "sueño"}:${frags.map((f) => f.id).join(",")}:${input.mode ?? "tonight"}`;
  const rng = seededRng(hashString(seedText));
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)]!;

  const theme = input.theme ?? `sueño de ${frags.length} fragmentos`;
  const title = `SUEÑO: ${theme.toUpperCase().slice(0, 60)}`;
  const opening = pick(OPENERS);
  const bodyParts: string[] = [];
  const used = [...frags].sort(() => rng() - 0.5).slice(0, Math.min(frags.length, 6));
  used.forEach((f, i) => {
    const t = pick(TRANSITIONS);
    const reshaped = reshape(f.content, rng);
    bodyParts.push(`${i === 0 ? opening : t} ${reshaped}`);
  });
  const closing = pick(CLOSERS);
  const daydreamNote =
    input.mode === "daydream"
      ? "\n(Ensueño de vigilia: imaginar, no recordar.)"
      : "";
  return {
    content: `${title}\n\n${bodyParts.join(".\n")}. ${closing}${daydreamNote}`,
    theme,
  };
}

/** Deforma ligeramente un fragmento para que suene a sueño. */
function reshape(content: string, rng: () => number): string {
  const words = content.split(/\s+/);
  if (words.length > 8 && rng() > 0.5) {
    // cambia el orden del final, como hacen los sueños
    const cut = Math.floor(words.length / 2);
    const head = words.slice(0, cut);
    const tail = words.slice(cut).reverse();
    return [...head, ...tail].join(" ");
  }
  return content;
}

export interface OfflineDiaryInput {
  groups: Array<{ label: string; count: number; top: MemoryRow[] }>;
  date: string;
}

export function offlineDiary(input: OfflineDiaryInput): string {
  const lines: string[] = [];
  lines.push(`Página del diario — ${input.date}`);
  lines.push("");
  for (const g of input.groups) {
    const quotes = g.top.slice(0, 3).map((m) => `"${m.content.slice(0, 120)}${m.content.length > 120 ? "…" : ""}"`);
    lines.push(`Hoy hubo ${g.count} momento${g.count === 1 ? "" : "s"} alrededor de "${g.label}": ${quotes.join(", ")}.`);
  }
  const total = input.groups.reduce((a, g) => a + g.count, 0);
  lines.push("");
  lines.push(`En total, ${total} instantes quedaron guardados. Algunos merecerán quedarse; otros se desvanecerán con el tiempo, como debe ser.`);
  lines.push("Mañana seguiremos contando esta historia.");
  return lines.join("\n");
}

export function offlineTitles(candidates: Array<{ title: string; importance: number }>): string[] {
  const base = candidates.map((c) => c.title);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of base) {
    let t2 = t.replace(/\s+/g, " ").trim().slice(0, 60);
    if (!t2) t2 = "Un momento sin nombre";
    if (seen.has(t2)) t2 = `${t2} (II)`;
    seen.add(t2);
    out.push(t2);
  }
  return out;
}

/** Lexicón mínimo de valencia en español (offline, determinista). */
const NEG = new Set(
  `triste dolor miedo miedo miedo perdí perdido lloré lloró adiós roto rota fracaso herida miedo soledad lágrimas difícil noche oscura morir enfermo angustia enfado bronca caos perdida`.split(/\s+/),
);
const POS = new Set(
  `feliz risa reír reímos amor alegría brindamos ganamos logramos abrazo fiesta cumpleaños boda suerte increíble hermoso maravilloso viaje descubrimos celebrar juntos sonrisa paz brillo bailamos cantamos reíste mejor`.split(/\s+/),
);

export function offlineLabel(content: string): { valence: number; importance: number; tags: string[] } {
  const words = content.toLowerCase().split(/[^\p{L}\p{N}]+/u);
  let v = 0;
  for (const w of words) {
    if (NEG.has(w)) v -= 1;
    if (POS.has(w)) v += 1;
  }
  const valence = Math.max(-1, Math.min(1, v / 3));
  const importance = valence === 0 ? 3 : valence > 0 ? 4 : 3;
  return { valence, importance, tags: [] };
}
