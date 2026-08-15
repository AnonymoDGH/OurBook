import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import {
  backupFile,
  buildEntry,
  detectAgents,
  readConfig,
  setEntry,
  unsetEntry,
  writeConfig,
  type AgentInfo,
} from "./agents.js";

// ---------------------------------------------------------------------------
// Asistente interactivo: detecta agentes MCP instalados y permite elegir
// en cuáles registrar (o retirar) el servidor OurBook.
// ---------------------------------------------------------------------------

export function ourbookServerCommand(): { command: string; args: string[] } {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, "..", "dist", "index.js"), // desde src/setup o dist/setup
    path.resolve(here, "dist", "index.js"), // desde dist
    path.resolve(process.cwd(), "dist", "index.js"),
  ];
  const distIndex = candidates.find((c) => fs.existsSync(c));
  if (distIndex) return { command: process.execPath, args: [distIndex] };
  return { command: "ourbook", args: [] };
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function agentLabel(a: AgentInfo, i: number): string {
  const status = !a.detected
    ? "no detectado"
    : a.hasOurbook
      ? "configurado con ourbook"
      : a.exists
        ? "config listo (sin ourbook)"
        : "instalado (creará el config)";
  return `  [${i}] ${a.name.padEnd(20)} ${status} — ${a.configPath}`;
}

export function listAgentsText(): string {
  const agents = detectAgents();
  const lines = ["OurBook — agentes MCP detectados:", ""];
  agents.forEach((a, i) => lines.push(agentLabel(a, i + 1)));
  lines.push("", "Detectados: " + agents.filter((a) => a.detected).map((a) => a.name).join(", ") || "ninguno");
  return lines.join("\n");
}

async function pickAgents(agents: AgentInfo[]): Promise<AgentInfo[]> {
  const detected = agents.filter((a) => a.detected);
  if (detected.length === 0) return [];
  console.log("");
  detected.forEach((a, i) => console.log(agentLabel(a, i + 1)));
  console.log("");
  const answer = await ask(
    `¿En qué agentes instalo el MCP? (números separados por coma, "a" = todos, Enter = salir): `,
  );
  if (!answer) return [];
  const trimmed = answer.toLowerCase();
  if (trimmed === "a" || trimmed === "all" || trimmed === "todos") return detected;
  const idxs = trimmed
    .split(/[,\s]+/)
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= detected.length);
  return [...new Set(idxs)].map((n) => detected[n - 1]!);
}

export async function runSetup(opts: {
  yes?: boolean;
  only?: string[];
  engine?: string;
  dryRun?: boolean;
}): Promise<void> {
  const agents = detectAgents();
  console.log("OurBook — instalador de MCP en tus agentes");
  console.log("Detectando agentes...\n");
  const all = agents.filter((a) => a.detected);

  let selected: AgentInfo[];
  if (opts.only && opts.only.length > 0) {
    selected = agents.filter((a) => opts.only!.includes(a.id));
    const missing = opts.only.filter((id) => !agents.some((a) => a.id === id));
    if (missing.length > 0) console.log(`⚠  Agentes desconocidos: ${missing.join(", ")}`);
  } else if (opts.yes) {
    selected = all;
  } else {
    selected = await pickAgents(agents);
  }

  if (selected.length === 0) {
    console.log("\nNada que hacer. Puedes revisar la detección con: ourbook agents");
    return;
  }

  const { command, args } = ourbookServerCommand();
  const env: Record<string, string> = opts.engine ? { OURBOOK_ENGINE: opts.engine } : {};
  console.log(`\nServidor a registrar: ${command} ${args.join(" ")}` + (opts.dryRun ? "\n[modo dry-run: no se escribe nada]" : ""));

  for (const a of selected) {
    const entry = buildEntry(a.kind, { command, args, env });
    const existing = a.exists ? readConfig(a.configPath) : null;
    const next = setEntry(existing, a.kind, entry);
    if (opts.dryRun) {
      console.log(`  · ${a.name}: se escribiría ${a.configPath} (${a.hasOurbook ? "actualizar" : "registrar"})`);
      continue;
    }
    const bak = backupFile(a.configPath);
    writeConfig(a.configPath, next);
    console.log(
      `  ✓ ${a.name}: ${a.hasOurbook ? "actualizado" : "registrado"} en ${a.configPath}` +
        (bak ? ` (backup: ${path.basename(bak)})` : ""),
    );
  }
  console.log("\nListo. Reinicia el agente para que cargue el MCP (o /mcp en Claude Code).");
}

export async function runUninstall(opts: { yes?: boolean; only?: string[]; dryRun?: boolean }): Promise<void> {
  const agents = detectAgents();
  console.log("OurBook — retirar el MCP de tus agentes\n");
  const withOurbook = agents.filter((a) => a.hasOurbook);

  let selected: AgentInfo[];
  if (opts.only && opts.only.length > 0) {
    selected = agents.filter((a) => opts.only!.includes(a.id) && a.hasOurbook);
  } else if (opts.yes) {
    selected = withOurbook;
  } else {
    if (withOurbook.length === 0) {
      console.log("No hay agentes con OurBook registrado.");
      return;
    }
    selected = await pickAgents(withOurbook);
  }

  if (selected.length === 0) {
    console.log("Nada que retirar.");
    return;
  }

  for (const a of selected) {
    const existing = a.exists ? readConfig(a.configPath) : null;
    const { config, removed } = unsetEntry(existing, a.kind);
    if (!removed) continue;
    if (opts.dryRun) {
      console.log(`  · ${a.name}: se retiraría la entrada de ${a.configPath}`);
      continue;
    }
    const bak = backupFile(a.configPath);
    writeConfig(a.configPath, config);
    console.log(`  ✓ ${a.name}: OurBook retirado de ${a.configPath}` + (bak ? ` (backup: ${path.basename(bak)})` : ""));
  }
  console.log("\nListo.");
}
