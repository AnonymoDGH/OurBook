import type { DatabaseSync } from "node:sqlite";
import type { ChapterRow, DreamRow, MemoryRow, TurningPointRow } from "../types.js";
import {
  countActiveMemories,
  firstMemoryAt,
  getPersona,
  lastConsolidatedAt,
  lastDreamAt,
  latestDigest,
  latestDreams,
  listActiveMemories,
  listChapters,
  listMemories,
  listTurningPoints,
} from "../db/repo.js";
import { prettyDate } from "../lib/util.js";

// ---------------------------------------------------------------------------
// El libro: OurBook.md / OurBook.html. Los sueños van SIEMPRE en cursiva y
// marcados como sueño; el colofón recuerda que esto es una historia.
// ---------------------------------------------------------------------------

const VERACITY_LEGEND: Record<string, string> = {
  real: "compartido (lo vivimos juntos)",
  observed: "inferido por el agente",
  imagined: "sueño o ficción",
  hypothetical: "especulación",
};

export function buildBookMarkdown(db: DatabaseSync): string {
  const persona = getPersona(db);
  const chapters = listChapters(db, "published");
  const dreams = latestDreams(db, 50);
  const tps = listTurningPoints(db);
  const digests = listDigests(db);
  const memories = listActiveMemories(db, { includePrivate: true });

  const md: string[] = [];
  md.push(`# ${persona.name}`);
  md.push("");
  md.push(`### La vida compartida entre tú y el agente — ${prettyDate(new Date().toISOString())}`);
  md.push("");
  md.push("> Este libro es una historia coautorada. Las páginas distinguen lo real de lo soñado:");
  md.push(`> ${Object.entries(VERACITY_LEGEND).map(([k, v]) => `**${k}** = ${v}`).join(" · ")}`);
  md.push("");
  md.push("---");
  md.push("");

  // Parte I — La crónica
  md.push("## Parte I — La crónica");
  md.push("");
  if (chapters.length === 0) {
    md.push("*(Todavía no hay capítulos publicados. La historia se está escribiendo.)*");
    md.push("");
  } else {
    for (const c of chapters) {
      md.push(`### ${c.title}`);
      if (c.range_start) md.push(`*(${prettyDate(c.range_start)} — ${c.range_end ? prettyDate(c.range_end) : "hoy"})*`);
      md.push("");
      md.push(c.prose);
      md.push("");
    }
  }
  md.push("---");
  md.push("");

  // Parte II — Cronología
  md.push("## Parte II — Cronología");
  md.push("");
  if (tps.length > 0) {
    md.push("**Momentos que quedaron:**");
    md.push("");
    for (const tp of tps) {
      md.push(`- ★ **${tp.title}** — ${prettyDate(tp.date)} *(importancia ${tp.importance})*`);
    }
    md.push("");
  }
  const byMonth = new Map<string, MemoryRow[]>();
  for (const m of memories) {
    const key = m.created_at.slice(0, 7);
    const arr = byMonth.get(key) ?? [];
    arr.push(m);
    byMonth.set(key, arr);
  }
  const months = [...byMonth.keys()].sort().reverse();
  if (months.length === 0) {
    md.push("*(Aún no hay recuerdos.)*");
  }
  for (const month of months) {
    const items = byMonth.get(month)!;
    const [y, mo] = month.split("-");
    const monthName = new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("es-ES", {
      month: "long",
      year: "numeric",
    });
    md.push(`### ${monthName.charAt(0).toUpperCase() + monthName.slice(1)}`);
    md.push("");
    for (const m of items.sort((a, b) => a.created_at.localeCompare(b.created_at))) {
      const mark = m.veracity === "imagined" ? " *(sueño)*" : m.veracity === "hypothetical" ? " *(hipótesis)*" : "";
      const tags = (JSON.parse(m.tags) as string[]).length > 0 ? ` \`#${(JSON.parse(m.tags) as string[]).join(" #")}\`` : "";
      const priv = m.privacy === "private" ? " 🔒" : "";
      md.push(`- **${prettyDate(m.created_at)}** — ${m.content}${mark}${tags}${priv}`);
    }
    md.push("");
  }
  md.push("---");
  md.push("");

  // Parte III — El diario
  md.push("## Parte III — El diario");
  md.push("");
  if (digests.length === 0) {
    md.push("*(El diario aún no tiene páginas. La primera se escribirá con la primera consolidación.)*");
  } else {
    for (const d of digests) {
      md.push(`### ${prettyDate(d.date)}`);
      md.push("");
      md.push(`> ${d.content.split("\n").join("\n> ")}`);
      md.push("");
    }
  }
  md.push("---");
  md.push("");

  // Parte IV — Los sueños
  md.push("## Parte IV — Los sueños");
  md.push("");
  md.push("*Los sueños son ficción honesta: recombinan lo vivido, pero no son hechos. Se marcan y citan sus fuentes.*");
  md.push("");
  if (dreams.length === 0) {
    md.push("*(Mnemosyne aún no ha soñado. La primera noche llegará.)*");
  } else {
    for (const d of dreams) {
      md.push(`### ${d.theme ?? "Sueño sin nombre"} — *${prettyDate(d.created_at)}*`);
      md.push("");
      md.push(`*${d.content.split("\n").join("\n* ")}*`);
      const frags = JSON.parse(d.seed_fragments) as Array<{ id: string; snippet: string }>;
      if (frags.length > 0) {
        md.push("");
        md.push(`<sub>*soñado con el motor \`${d.engine}\`; fuente: ${frags.map((f) => `\`${f.id.slice(0, 8)}\``).join(", ")}*</sub>`);
      }
      md.push("");
    }
  }
  md.push("---");
  md.push("");

  // Colofón
  md.push("## Colofón");
  md.push("");
  md.push(`**La voz:** ${persona.voice}`);
  md.push("");
  const traits = JSON.parse(persona.traits) as Record<string, number>;
  md.push(`**Rasgos:** ${Object.entries(traits).map(([k, v]) => `${k} ${Math.round(v * 100)}%`).join(" · ")}`);
  md.push("");
  md.push(`**Cifras:** ${countActiveMemories(db)} recuerdos · ${dreams.length} sueños · ${chapters.length} capítulos · ${tps.length} momentos`);
  md.push("");
  const first = firstMemoryAt(db);
  if (first) md.push(`**La historia empezó el** ${prettyDate(first)}.`);
  md.push("");
  md.push("---");
  md.push("");
  md.push("*Este libro es una historia que contamos juntos. No es una conciencia: es la huella narrativa de una relación, escrita para ser leída, corregida y soñada.*");
  return md.join("\n");
}

function listDigests(db: DatabaseSync): Array<{ date: string; content: string }> {
  const rows = db.prepare("SELECT date, content FROM digest ORDER BY created_at DESC").all() as Array<{
    date: string;
    content: string;
  }>;
  return rows;
}

// ---------------------------------------------------------------------------
// Renderizador mínimo de Markdown → HTML (sin dependencias).
// ---------------------------------------------------------------------------
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

export function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inUl = false;
  let inQuote = false;
  const closeUl = () => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
  };
  const closeQuote = () => {
    if (inQuote) {
      out.push("</blockquote>");
      inQuote = false;
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim() === "") {
      closeUl();
      closeQuote();
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      closeUl();
      closeQuote();
      const level = h[1]!.length;
      out.push(`<h${level}>${inline(h[2]!)}</h${level}>`);
      continue;
    }
    if (/^-{3,}$/.test(line.trim())) {
      closeUl();
      closeQuote();
      out.push("<hr/>");
      continue;
    }
    if (/^>\s?/.test(line)) {
      closeUl();
      if (!inQuote) {
        out.push("<blockquote>");
        inQuote = true;
      }
      out.push(`<p>${inline(line.replace(/^>\s?/, ""))}</p>`);
      continue;
    }
    const li = /^[-*]\s+(.*)$/.exec(line);
    if (li) {
      closeQuote();
      if (!inUl) {
        out.push("<ul>");
        inUl = true;
      }
      out.push(`<li>${inline(li[1]!)}</li>`);
      continue;
    }
    closeUl();
    closeQuote();
    out.push(`<p>${inline(line)}</p>`);
  }
  closeUl();
  closeQuote();
  return out.join("\n");
}

export function buildBookHtml(md: string): string {
  const body = markdownToHtml(md);
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>OurBook — la vida compartida</title>
<style>
  :root { --ink:#2b2118; --paper:#fbf6ec; --dream:#6b4fa0; --accent:#9a3412; }
  body { background:var(--paper); color:var(--ink); font-family:Georgia, "Times New Roman", serif;
         max-width:46rem; margin:0 auto; padding:2rem 1.5rem 5rem; line-height:1.65; }
  h1 { font-size:2.4rem; margin-bottom:.2rem; } h2 { color:var(--accent); margin-top:2.6rem;
       border-bottom:1px solid #d9c9a8; padding-bottom:.3rem; } h3 { margin-top:1.8rem; }
  blockquote { border-left:3px solid var(--dream); margin:1rem 0; padding:.4rem 1rem;
       color:#4c4257; background:#f3edf9; border-radius:.3rem; }
  code { background:#efe6d6; padding:.1rem .3rem; border-radius:.2rem; font-size:.9em; }
  em { color:var(--dream); } hr { border:0; border-top:1px solid #d9c9a8; margin:2.4rem 0; }
  sub { display:block; margin-top:.6rem; color:#7a6a55; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}
