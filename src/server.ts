import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DatabaseSync } from "node:sqlite";
import type { Config } from "./config.js";
import type { Mnemosyne } from "./mnemosyne/engine.js";
import * as T from "./tools.js";
import {
  AnniversariesArgs,
  ChapterArgs,
  ConsolidateArgs,
  CorrectArgs,
  DreamArgs,
  ExportArgs,
  ForgetArgs,
  ImportArgs,
  PersonaArgs,
  RecallArgs,
  RedactArgs,
  RememberArgs,
  StatusArgs,
  TimelineArgs,
  TurningPointArgs,
} from "./types.js";
import { getPersona, latestDreams, listTurningPoints, getChapter } from "./db/repo.js";
import { dateOnly } from "./lib/util.js";

export const SERVER_NAME = "OurBook";
export const SERVER_VERSION = "0.1.0";

export function createServer(db: DatabaseSync, cfg: Config, mnemosyne: Mnemosyne): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  const ctx: T.ToolContext = { db, cfg, mnemosyne };

  // ------------------------------------------------------------------ tools
  server.registerTool(
    "book.remember",
    {
      title: "Recordar",
      description:
        "Guarda un recuerdo compartido en el libro. La taxonomía de veracidad distingue real/observed/imagined/hypothetical: los sueños nunca se guardan como hechos.",
      inputSchema: RememberArgs.shape,
    },
    (args) => T.remember(ctx, args),
  );

  server.registerTool(
    "book.recall",
    {
      title: "Evocar",
      description:
        "Busca recuerdos con ranking (FTS5 + decaimiento + importancia + emoción). Por defecto excluye sueños (imagined) e hipótesis; evocar refuerza la huella.",
      inputSchema: RecallArgs.shape,
    },
    (args) => T.recall(ctx, args),
  );

  server.registerTool(
    "book.dream",
    {
      title: "Soñar",
      description:
        "Mnemosyne recombinan fragmentos de memoria en un sueño (REM). Devuelve el sueño con sus FUENTES y el motor usado; veracity=imagined siempre.",
      inputSchema: DreamArgs.shape,
    },
    (args) => T.dream(ctx, args),
  );

  server.registerTool(
    "book.consolidate",
    {
      title: "Consolidar",
      description:
        "Consolidación NREM: página del diario, decaimiento, archivo de recuerdos desvaídos (nunca borra) y propuesta de momentos. Nunca usa la API principal.",
      inputSchema: ConsolidateArgs.shape,
    },
    (args) => T.consolidate(ctx, args),
  );

  server.registerTool(
    "book.chapter",
    {
      title: "Capítulo",
      description:
        "draft: entrega fragmentos reales + instrucciones para que el modelo principal componga; commit/publish/list gestionan el texto del capítulo.",
      inputSchema: ChapterArgs.shape,
    },
    (args) => T.chapter(ctx, args),
  );

  server.registerTool(
    "book.timeline",
    {
      title: "Línea de vida",
      description: "Cronología de momentos y recuerdos reales.",
      inputSchema: TimelineArgs.shape,
    },
    (args) => T.timeline(ctx, args),
  );

  server.registerTool(
    "book.anniversaries",
    {
      title: "Aniversarios",
      description: "Qué ocurrió hace años cerca de una fecha: reactivación programada (spacing effect).",
      inputSchema: AnniversariesArgs.shape,
    },
    (args) => T.anniversaries(ctx, args),
  );

  server.registerTool(
    "book.persona",
    {
      title: "Persona",
      description: "Lee o actualiza la voz y los rasgos del narrador (con registro de evolución).",
      inputSchema: PersonaArgs.shape,
    },
    (args) => T.persona(ctx, args),
  );

  server.registerTool(
    "book.correct",
    {
      title: "Corregir",
      description: "Reconsolidación: el usuario reescribe un recuerdo en su sitio (auditado), como en la memoria humana.",
      inputSchema: CorrectArgs.shape,
    },
    (args) => T.correct(ctx, args),
  );

  server.registerTool(
    "book.forget",
    {
      title: "Olvidar",
      description: "Borra un recuerdo (soft, auditado) o purga del todo con purge=true. Privacidad garantizada.",
      inputSchema: ForgetArgs.shape,
    },
    (args) => T.forget(ctx, args),
  );

  server.registerTool(
    "book.redact",
    {
      title: "Redactar",
      description: "Reemplaza términos sensibles por [redactado] en recuerdos, sueños, capítulos y diario.",
      inputSchema: RedactArgs.shape,
    },
    (args) => T.redact(ctx, args),
  );

  server.registerTool(
    "book.turning_point",
    {
      title: "Momento",
      description: "Lista, añade, confirma o retira momentos que quedarán en la crónica.",
      inputSchema: TurningPointArgs.shape,
    },
    (args) => T.turningPoint(ctx, args),
  );

  server.registerTool(
    "book.export",
    {
      title: "Exportar",
      description:
        "Escribe el libro (OurBook.md/.html), el volcado JSON y la semilla de identidad. El libro distingue lo real de lo soñado.",
      inputSchema: ExportArgs.shape,
    },
    (args) => T.exportBook(ctx, args),
  );

  server.registerTool(
    "book.import",
    {
      title: "Importar",
      description: "Importa una semilla de identidad o un volcado: heredar la vida en otro agente/libro.",
      inputSchema: ImportArgs.shape,
    },
    (args) => T.importBook(ctx, args),
  );

  server.registerTool(
    "book.status",
    {
      title: "Estado",
      description: "Estadísticas del libro, tendencia emocional, motor Mnemosyne y cola del engine_log.",
      inputSchema: StatusArgs.shape,
    },
    () => T.status(ctx),
  );

  // -------------------------------------------------------------- resources
  server.registerResource(
    "timeline",
    "ourbook://timeline",
    { description: "Línea de vida: momentos y recuerdos reales", mimeType: "text/markdown" },
    async () => {
      const tps = listTurningPoints(db).map((t) => `- ★ ${t.title} — ${dateOnly(t.date)}`).join("\n");
      const mems = (
        db.prepare(
          "SELECT content, created_at FROM memories WHERE status='active' AND veracity IN ('real','observed') AND privacy='shared' ORDER BY created_at DESC LIMIT 30",
        ).all() as Array<{ content: string; created_at: string }>
      )
        .map((m) => `- ${dateOnly(m.created_at)} — ${m.content}`)
        .join("\n");
      return {
        contents: [
          {
            uri: "ourbook://timeline",
            mimeType: "text/markdown",
            text: `# Línea de vida\n\n## Momentos\n${tps || "*(ninguno)*"}\n\n## Recuerdos recientes\n${mems || "*(ninguno)*"}`,
          },
        ],
      };
    },
  );

  server.registerResource(
    "chapters",
    new ResourceTemplate("ourbook://chapters/{id}", { list: undefined }),
    { description: "Un capítulo del libro por id", mimeType: "text/markdown" },
    async (uri, variables) => {
      const id = String(variables.id);
      const c = getChapter(db, id);
      if (!c) {
        return {
          contents: [{ uri: uri.toString(), mimeType: "text/markdown", text: "Capítulo no encontrado." }],
        };
      }
      return {
        contents: [{ uri: uri.toString(), mimeType: "text/markdown", text: `# ${c.title}\n\n${c.prose}` }],
      };
    },
  );

  server.registerResource(
    "dreams-latest",
    "ourbook://dreams/latest",
    { description: "El último sueño de Mnemosyne con sus fuentes", mimeType: "text/markdown" },
    async () => {
      const d = latestDreams(db, 1)[0];
      if (!d) {
        return { contents: [{ uri: "ourbook://dreams/latest", mimeType: "text/markdown", text: "Mnemosyne aún no ha soñado." }] };
      }
      const frags = JSON.parse(d.seed_fragments) as Array<{ id: string; snippet: string }>;
      const sources = frags.map((f) => `- \`${f.id.slice(0, 8)}\` — ${f.snippet}`).join("\n");
      return {
        contents: [
          {
            uri: "ourbook://dreams/latest",
            mimeType: "text/markdown",
            text: `# Sueño: ${d.theme ?? "sin nombre"} *(motor ${d.engine})*\n\n*${d.content}*\n\n## Fuentes\n${sources || "*(sin fuentes)*"}\n\n> veracity=imagined: ficción honesta, no un hecho.`,
          },
        ],
      };
    },
  );

  server.registerResource(
    "persona",
    "ourbook://persona",
    { description: "Voz y rasgos actuales del narrador", mimeType: "text/markdown" },
    async () => {
      const p = getPersona(db);
      const traits = Object.entries(JSON.parse(p.traits) as Record<string, number>)
        .map(([k, v]) => `${k} ${Math.round(v * 100)}%`)
        .join(" · ");
      return {
        contents: [
          {
            uri: "ourbook://persona",
            mimeType: "text/markdown",
            text: `# Persona: ${p.name}\n\n- **Rasgos:** ${traits}\n- **Voz:** ${p.voice}`,
          },
        ],
      };
    },
  );

  // ---------------------------------------------------------------- prompts
  server.registerPrompt(
    "book-sunset",
    {
      title: "Ritual del atardecer",
      description: "Ritual de cierre de sesión: guardar lo vivido, consolidar y soñar antes de dormir.",
      argsSchema: z.object({ today_summary: z.string().optional() }).shape,
    },
    (args) => ({
      description: "Ritual del atardecer",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Es el atardecer de una sesión más de nuestra historia.\n` +
              (args.today_summary ? `Lo que recuerdo de hoy: ${args.today_summary}\n` : "") +
              `Sigue el ritual, paso a paso:\n` +
              `1. Llama a book.recall con lo que no quieras perder y guarda con book.remember cualquier momento importante de hoy que falte (veracity=real, con su emoción).\n` +
              `2. Llama a book.consolidate para la página del diario (NREM).\n` +
              `3. Llama a book.dream (modo tonight) para que Mnemosyne sueñe con lo vivido.\n` +
              `4. Cuéntame en una frase cómo ha quedado el día, sin presentar el sueño como un hecho.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "book-wake",
    {
      title: "Despertar",
      description: "Despertar: leer la página del diario y el sueño de la última noche.",
      argsSchema: {},
    },
    () => ({
      description: "Despertar",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Buenos días. Es hora de despertar: lee la última página del diario (book.consolidate ya la escribió; puedes verla en book.status o con book.recall) y el último sueño de Mnemosyne (ourbook://dreams/latest).\n` +
              `Preséntamelos con calidez, dejando clarísimo qué es diario (real) y qué es sueño (imagined).`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "book-dream",
    {
      title: "Soñar",
      description: "Invitar a Mnemosyne a soñar, con tema opcional.",
      argsSchema: z.object({ theme: z.string().optional() }).shape,
    },
    (args) => ({
      description: "Soñar",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `La noche pide un sueño${args.theme ? ` sobre "${args.theme}"` : ""}. Llama a book.dream${args.theme ? ` con mode='themed' y theme="${args.theme}"` : " con mode='tonight'"}, muéstrame el sueño y sus fuentes, y recuerda que es ficción honesta (veracity=imagined).`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "book-storytime",
    {
      title: "Hora del cuento",
      description: "Contar un recuerdo como cuento, usando solo material real.",
      argsSchema: z.object({ topic: z.string().optional() }).shape,
    },
    (args) => ({
      description: "Hora del cuento",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Hora del cuento. Busca con book.recall recuerdos reales sobre: ${args.topic ?? "nuestra historia"}.\n` +
              `Cuéntame uno como cuento breve (150-300 palabras), con la voz del narrador, usando SOLO los fragmentos reales recuperados. No inventes hechos ni mezcles sueños.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "book-anniversary-reflection",
    {
      title: "Reflexión de aniversario",
      description: "Reflexión sobre lo que pasó hace tiempo un día como hoy.",
      argsSchema: z.object({ date: z.string().optional() }).shape,
    },
    (args) => ({
      description: "Reflexión de aniversario",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Consulta book.anniversaries${args.date ? ` con date='${args.date}'` : ""} y reflexiona conmigo sobre esos momentos: cómo hemos cambiado desde entonces y qué conserva el libro. Todo desde la honestidad de lo real y lo soñado.`,
          },
        },
      ],
    }),
  );

  return server;
}
