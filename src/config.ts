import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type EngineKind = "qwen-reverse" | "local" | "offline";

export interface Config {
  dbPath: string;
  exportDir: string;
  /** Motor de Mnemosyne (generación de fondo: sueños, diario, etiquetado) */
  engine: EngineKind;
  engineModel: string;
  localEndpoint: string; // OpenAI-compatible base, p. ej. http://127.0.0.1:9000/v1
  localModel: string;
  engineProxy: string;
  python: string;
  engineTimeoutMs: number;
  engineSpacingMs: number;
  wafCooldownMs: number;
  includePrivateInDreams: boolean;
  autoArchive: boolean;
  autoLabel: boolean;
}

function boolEnv(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  return v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "yes";
}

function intEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function loadConfig(overrides: Partial<Config> = {}): Config {
  const home = os.homedir();
  const dot = path.join(home, ".ourbook");
  const engineRaw = (process.env.OURBOOK_ENGINE ?? "qwen-reverse").toLowerCase();
  const engine: EngineKind =
    engineRaw === "local" || engineRaw === "offline" || engineRaw === "qwen-reverse"
      ? engineRaw
      : "qwen-reverse";
  return {
    dbPath: process.env.OURBOOK_DB ?? path.join(dot, "ourbook.db"),
    exportDir: process.env.OURBOOK_EXPORT_DIR ?? path.join(dot, "exports"),
    engine,
    engineModel: process.env.OURBOOK_ENGINE_MODEL ?? "",
    localEndpoint: process.env.OURBOOK_LOCAL_ENDPOINT ?? "",
    localModel: process.env.OURBOOK_LOCAL_MODEL ?? "",
    engineProxy: process.env.OURBOOK_ENGINE_PROXY ?? "",
    python: process.env.OURBOOK_PYTHON ?? "python",
    engineTimeoutMs: intEnv("OURBOOK_ENGINE_TIMEOUT_MS", 120_000),
    engineSpacingMs: intEnv("OURBOOK_ENGINE_SPACING_MS", 2_500),
    wafCooldownMs: intEnv("OURBOOK_WAF_COOLDOWN_MS", 60_000),
    includePrivateInDreams: boolEnv("OURBOOK_DREAM_INCLUDE_PRIVATE", false),
    autoArchive: boolEnv("OURBOOK_AUTO_ARCHIVE", true),
    autoLabel: boolEnv("OURBOOK_AUTO_LABEL", false),
    ...overrides,
  };
}

/**
 * Ruta absoluta al worker Python de Mnemosyne.
 * En dev: <repo>/mnemosyne/worker.py ; instalado: junto a dist/ (carpeta mnemosyne/).
 */
export function workerScriptPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, "..", "mnemosyne", "worker.py"), // dist/config.js -> <root>/mnemosyne
    path.resolve(process.cwd(), "mnemosyne", "worker.py"), // dev desde la raíz
    path.resolve(path.join(os.homedir(), ".ourbook", "mnemosyne", "worker.py")),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0]!;
}
