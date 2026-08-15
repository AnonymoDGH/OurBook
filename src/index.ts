#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { openDatabase } from "./db/database.js";
import { Mnemosyne } from "./mnemosyne/engine.js";
import { createServer, SERVER_NAME, SERVER_VERSION } from "./server.js";
import { importSeed, seedFromDump } from "./export/seed.js";
import { addAudit } from "./db/database.js";
import fs from "node:fs";

function usage(): string {
  return `OurBook (Mnemosyne) — MCP de memoria narrativa

Uso:
  ourbook [--db <ruta>]            Sirve el servidor MCP por stdio (por defecto)
  ourbook --import <archivo.json> [--mode merge|fresh] [--db <ruta>]
                                   Importa una semilla o volcado y sale
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

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cfg = loadConfig();

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

  const db = openDatabase(cfg.dbPath);
  const mnemosyne = new Mnemosyne(cfg, db);

  if (importPath) {
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
