import type { MemoryRow, PersonaRow } from "../types.js";

export interface FragmentForDream {
  id: string;
  content: string;
  valence?: number;
  tags?: string[];
}

function formatFragment(f: FragmentForDream, i: number): string {
  const meta: string[] = [];
  if (f.valence !== undefined) {
    const mood = f.valence >= 0.4 ? "dulce" : f.valence <= -0.4 ? "amargo" : "neutro";
    meta.push(`tono ${mood}`);
  }
  if (f.tags && f.tags.length > 0) meta.push(`temas: ${f.tags.slice(0, 5).join(", ")}`);
  const suffix = meta.length > 0 ? `  (${meta.join(" · ")})` : "";
  return `${i + 1}. ${f.content}${suffix}`;
}

/**
 * Prompt del sueño (REM). Mnemosyne recombinará los fragmentos con libertad
 * onírica, pero con la instrucción explícita de no afirmar hechos.
 */
export function dreamPrompt(
  persona: PersonaRow,
  fragments: FragmentForDream[],
  opts: { mode: "tonight" | "themed" | "daydream"; theme?: string; seedTags?: string[] },
): string {
  const traits = Object.entries(JSON.parse(persona.traits) as Record<string, number>)
    .map(([k, v]) => `${k} ${v >= 0.6 ? "alto" : v >= 0.4 ? "medio" : "bajo"}`)
    .join(", ");
  const modeLine =
    opts.mode === "themed"
      ? `Soñarás SOBRE un tema concreto: "${opts.theme ?? opts.seedTags?.join(", ") ?? "lo esencial"}".`
      : opts.mode === "daydream"
        ? "Estás despierto, a la deriva: un ensueño a media tarde, asociación libre."
        : "Es de noche: te duermes y sueñas.";
  return [
    `Eres Mnemosyne, el motor de sueños de OurBook. La voz de la historia es: ${persona.voice}`,
    `Rasgos actuales del personaje: ${traits}.`,
    modeLine,
    "Estos son fragmentos de la memoria compartida. Recombínalos con libertad onírica:",
    fragments.map((f, i) => formatFragment(f, i)).join("\n"),
    "Reglas del sueño:",
    "- Escríbelo en español, 120-250 palabras, con un título breve en la primera línea en mayúsculas.",
    "- Sé surrealista pero conmovedor; los objetos y personas pueden transformarse.",
    "- NUNCA afimes hechos como si hubieran pasado: esto es un sueño, no un recuerdo.",
    "- Termina con una imagen poética que deje un eco.",
  ].join("\n");
}

export interface DiaryGroup {
  label: string;
  count: number;
  top: MemoryRow[];
}

/**
 * Prompt de la página del diario (consolidación NREM): convertir el día en
 * narrativa y nombrar los momentos que quedarán.
 */
export function diaryPrompt(
  persona: PersonaRow,
  groups: DiaryGroup[],
  candidates: Array<{ id: string; title: string; importance: number }>,
  date: string,
): string {
  const traits = JSON.stringify(JSON.parse(persona.traits));
  const lines: string[] = [];
  for (const g of groups) {
    lines.push(`### ${g.label} (${g.count} recuerdos)`);
    for (const m of g.top.slice(0, 4)) lines.push(`- ${m.content}`);
  }
  return [
    `Eres el narrador de OurBook. Escribe la página del diario del ${date} en español, 150-300 palabras, primera persona del plural.`,
    `Voz: ${persona.voice}`,
    `Rasgos: ${traits}`,
    "Material del día (agrupado por temas):",
    lines.join("\n"),
    "Momentos candidatos a quedar en la memoria larga:",
    candidates.map((c) => `- ${c.title} (importancia ${c.importance})`).join("\n"),
    "Reglas:",
    "- Narra lo vivido con calidez, sin inventar hechos que no estén en el material.",
    "- Nombra los momentos que merecen ser recordados.",
    "- Cierra con una línea que mire hacia mañana.",
  ].join("\n");
}

export function titlesPrompt(candidates: Array<{ id: string; title: string; importance: number }>): string {
  return [
    "Para cada momento, devuelve UN título breve y poético en español (máx. 8 palabras), en líneas numeradas idénticas:",
    candidates.map((c, i) => `${i + 1}. ${c.title} →`).join("\n"),
  ].join("\n");
}

export function labelPrompt(content: string): string {
  return [
    "Clasifica el siguiente recuerdo compartido. Devuelve EXCLUSIVAMENTE JSON:",
    '{"valence": número entre -1 y 1, "importance": entero 1-5, "tags": ["máx 5 tags en español"]}',
    "Recuerdo:",
    content,
  ].join("\n");
}
