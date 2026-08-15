#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { listAgentsText, runSetup, runUninstall } from "./setup/wizard.js";
import { SERVER_NAME, SERVER_VERSION } from "./version.js";
import fs from "node:fs";

function usage(): string {
  return `OurBook (Mnemosyne) — MCP de memoria narrativa

Uso:
  ourbook                              Sirve el servidor MCP por stdio (por defecto)
  ourbook setup                        Detecta tus agentes y registra el MCP (interactivo)
  ourbook setup --yes [--engine offline|local|qwen-reverse]
                                       Registra en todos los agentes detectados
  ourbook setup --agents claude-desktop,cursor [--dry-run]
                                       Registra solo en los agentes indicados
  ourbook uninstall [--yes|--agents ...]   Retira OurBook de los agentes
  ourbook agents                       Muestra qué agentes detectó
  ourbook --import <archivo.json> [--mode merge|fresh] [--db <ruta>]
                                       Importa una semilla o volcado y sale
  ourbook --db <ruta>                  Sirve el MCP con otro libro
  ourbook --version | --help

Variables de entorno:
  OURBOOK_DB                      Ruta del libro (SQLite)
  OURBOOK_ENGINE                  qwen-reverse | local | offline (por defecto qwen-reverse)
  OURBOOK_ENGINE_MODEL            Modelo Qwen (p. ej. qwen3.8-max); vacío = catálogo
  OURBOOK_LOCAL_ENDPOINT          Endpoint OpenAI-compatible local (Ollama/LM Studio/LocalAI)
  OURBOOK_LOCAL_MODEL             Modelo del endpoint local
  OURBOOK_ENGINE_PROXY            Proxy estático opcional para chat.qwen.ai
  OURBOOK_PYTHON                  Intérprete Python para el worker (por defecto "python")
  OURBOOK_DREAM_INCLUDE_PRIVATE   "1" para permitir recuerdos privados en sueños
  OURBOOK_AUTO_ARCHIVE            "0" desactiva el archivado automático en consolidación
  OURBOOK_AUTO_LABEL              "1" etiqueta emociones automáticamente con Mnemosyne
  OURBOOK_EXPORT_DIR              Carpeta de exportaciones (por defecto ~/.ourbook/exports)
`;
}

function parseFlags(args: string[]): {
  yes: boolean;
  dryRun: boolean;
  engine?: string;
  only?: string[];
} {
  const flags: { yes: boolean; dryRun: boolean; engine?: string; only?: string[] } = {
    yes: false,
    dryRun: false,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--yes" || a === "-y") flags.yes = true;
    else if (a === "--dry-run") flags.dryRun = true;
    else if (a === "--engine") flags.engine = args[++i];
    else if (a === "--agents") flags.only = (args[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  }
  return flags;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cfg = loadConfig();

  const sub = args[0]?.toLowerCase();
  if (sub === "setup" || sub === "install") {
    await runSetup(parseFlags(args.slice(1)));
    return;
  }
  if (sub === "uninstall") {
    await runUninstall(parseFlags(args.slice(1)));
    return;
  }
  if (sub === "agents") {
    console.log(listAgentsText());
    return;
  }
  if (sub === "--help" || sub === "-h" || sub === "help") {
    console.log(usage());
    return;
  }

  let importPath: string | null = null;
  let importMode: "merge" | "fresh" = "merge";
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--db") cfg.dbPath = args[++i]!;
    else if (a === "--import") importPath = args[++i]!;
    else if (a === "--mode") importMode = (args[++i] as "merge" | "fresh") ?? "merge";
    else if (a === "--version") {
      console.log(`${SERVER_NAME} ${SERVER_VERSION}`);
      return;
    } else if (a === "--help" || a === "-h") {
      console.log(usage());
      return;
    } else {
      console.error(`Argumento desconocido: ${a}`);
      console.error(usage());
      process.exit(2);
    }
  }

  const db = (await import("./db/database.js")).openDatabase(cfg.dbPath);
  const Mnemosyne = (await import("./mnemosyne/engine.js")).Mnemosyne;
  const mnemosyne = new Mnemosyne(cfg, db);

  if (importPath) {
    const { seedFromDump, importSeed } = await import("./export/seed.js");
    const { addAudit } = await import("./db/database.js");
    let raw: string;
    try {
      raw = fs.readFileSync(importPath, "utf8");
    } catch (e) {
      console.error(`No pude leer ${importPath}: ${(e as Error).message}`);
      process.exit(1);
    }
    try {
      const seed = seedFromDump(JSON.parse(raw));
      const res = importSeed(db, seed, importMode);
      addAudit(db, "cli_import", importPath, { mode: importMode, ...res });
      console.log(
        `Importado (${importMode}): ${res.memories} recuerdos, ${res.chapters} capítulos, ${res.turningPoints} momentos en ${cfg.dbPath}`,
      );
      mnemosyne.close();
      db.close();
      return;
    } catch (e) {
      console.error(`Importación fallida: ${(e as Error).message}`);
      process.exit(1);
    }
  }

  const { createServer } = await import("./server.js");
  const server = createServer(db, cfg, mnemosyne);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // eslint-disable-next-line no-console
  console.error(`[ourbook] ${SERVER_NAME} ${SERVER_VERSION} listo — libro: ${cfg.dbPath} — motor Mnemosyne: ${cfg.engine}`);

  const shutdown = () => {
    try {
      mnemosyne.close();
      db.close();
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  console.error(`[ourbook] error fatal: ${(e as Error).stack ?? e}`);
  process.exit(1);
});
