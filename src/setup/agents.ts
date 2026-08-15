import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// ---------------------------------------------------------------------------
// Detección de agentes MCP y gestión de su configuración.
// Cada agente guarda los servidores MCP en un archivo JSON con una forma
// distinta (mcpServers / servers / mcp / context_servers / mcp_servers).
// ---------------------------------------------------------------------------

export const SERVER_ENTRY_NAME = "ourbook";

export type ConfigKind = "mcpServers" | "servers" | "mcp" | "context_servers" | "mcp_servers";

export interface AgentInfo {
  id: string;
  name: string;
  kind: ConfigKind;
  configPath: string;
  exists: boolean; // el archivo de configuración existe
  detected: boolean; // el agente está instalado (carpetas/archivos presentes)
  hasOurbook: boolean; // ya tiene nuestra entrada registrada
}

export interface PathProvider {
  home: string;
  appdata: string;
  cwd: string;
}

export function defaultPaths(): PathProvider {
  const home = os.homedir();
  return {
    home,
    appdata: process.env.APPDATA ?? path.join(home, "AppData", "Roaming"),
    cwd: process.cwd(),
  };
}

export function keyOf(kind: ConfigKind): string {
  switch (kind) {
    case "mcpServers":
      return "mcpServers";
    case "servers":
      return "servers";
    case "mcp":
      return "mcp";
    case "context_servers":
      return "context_servers";
    case "mcp_servers":
      return "mcp_servers";
  }
}

function hasEntry(config: unknown, kind: ConfigKind): boolean {
  const obj = config as Record<string, unknown> | null | undefined;
  if (!obj || typeof obj !== "object") return false;
  const section = obj[keyOf(kind)];
  return !!section && typeof section === "object" && SERVER_ENTRY_NAME in (section as object);
}

export function readConfig(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

interface AgentDef {
  id: string;
  name: string;
  kind: ConfigKind;
  candidates: string[];
  detect: string[];
}

function agentDefs(p: PathProvider): AgentDef[] {
  const home = p.home;
  return [
    {
      id: "claude-desktop",
      name: "Claude Desktop",
      kind: "mcpServers",
      candidates: [
        path.join(p.appdata, "Claude", "claude_desktop_config.json"),
        path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json"),
        path.join(home, ".config", "Claude", "claude_desktop_config.json"),
      ],
      detect: [path.join(p.appdata, "Claude"), path.join(home, "Library", "Application Support", "Claude")],
    },
    {
      id: "claude-code",
      name: "Claude Code (CLI)",
      kind: "mcpServers",
      candidates: [path.join(home, ".claude.json")],
      detect: [path.join(home, ".claude.json")],
    },
    {
      id: "cursor",
      name: "Cursor",
      kind: "mcpServers",
      candidates: [path.join(home, ".cursor", "mcp.json")],
      detect: [path.join(home, ".cursor")],
    },
    {
      id: "opencode",
      name: "OpenCode",
      kind: "mcp",
      candidates: [path.join(home, ".config", "opencode", "opencode.json")],
      detect: [path.join(home, ".config", "opencode")],
    },
    {
      id: "windsurf",
      name: "Windsurf",
      kind: "mcpServers",
      candidates: [path.join(home, ".codeium", "windsurf", "mcp_config.json")],
      detect: [path.join(home, ".codeium", "windsurf")],
    },
    {
      id: "vscode",
      name: "VS Code (Copilot)",
      kind: "servers",
      candidates: [
        path.join(p.cwd, ".vscode", "mcp.json"),
        path.join(p.appdata, "Code", "User", "mcp.json"),
      ],
      detect: [path.join(p.appdata, "Code"), path.join(home, "Library", "Application Support", "Code")],
    },
    {
      id: "zed",
      name: "Zed",
      kind: "context_servers",
      candidates: [path.join(home, ".config", "zed", "settings.json")],
      detect: [path.join(home, ".config", "zed")],
    },
    {
      id: "gemini",
      name: "Gemini CLI",
      kind: "mcp_servers",
      candidates: [path.join(home, ".gemini", "settings.json")],
      detect: [path.join(home, ".gemini")],
    },
  ];
}

export function detectAgents(p: PathProvider = defaultPaths()): AgentInfo[] {
  return agentDefs(p).map((d) => {
    const configPath = d.candidates.find((c) => fs.existsSync(c)) ?? d.candidates[0]!;
    const exists = fs.existsSync(configPath);
    const detected = d.detect.some((q) => fs.existsSync(q));
    const config = exists ? readConfig(configPath) : null;
    return {
      id: d.id,
      name: d.name,
      kind: d.kind,
      configPath,
      exists,
      detected,
      hasOurbook: exists && hasEntry(config, d.kind),
    };
  });
}

// ---------------------------------------------------------------------------
// Construcción y escritura de la entrada del servidor
// ---------------------------------------------------------------------------
export interface McpServerEntry {
  command: string;
  args: string[];
  env: Record<string, string>;
}

export function buildEntry(kind: ConfigKind, e: McpServerEntry): unknown {
  switch (kind) {
    case "mcpServers":
      return { command: e.command, args: e.args, env: e.env };
    case "servers":
      return { type: "stdio", command: e.command, args: e.args, env: e.env };
    case "mcp":
      return { type: "local", command: [e.command, ...e.args], enabled: true, environment: e.env };
    case "context_servers":
      return { command: [e.command, ...e.args], environment: e.env };
    case "mcp_servers":
      return { command: [e.command, ...e.args], env: e.env };
  }
}

export function setEntry(
  config: unknown,
  kind: ConfigKind,
  entry: unknown,
): Record<string, unknown> {
  const obj = (config && typeof config === "object" ? config : {}) as Record<string, unknown>;
  const section =
    obj[keyOf(kind)] && typeof obj[keyOf(kind)] === "object"
      ? (obj[keyOf(kind)] as Record<string, unknown>)
      : {};
  return { ...obj, [keyOf(kind)]: { ...section, [SERVER_ENTRY_NAME]: entry } };
}

export function unsetEntry(
  config: unknown,
  kind: ConfigKind,
): { config: Record<string, unknown>; removed: boolean } {
  const obj = (config && typeof config === "object" ? config : {}) as Record<string, unknown>;
  const section =
    obj[keyOf(kind)] && typeof obj[keyOf(kind)] === "object"
      ? (obj[keyOf(kind)] as Record<string, unknown>)
      : {};
  if (!(SERVER_ENTRY_NAME in section)) return { config: obj, removed: false };
  const next = { ...section };
  delete next[SERVER_ENTRY_NAME];
  return { config: { ...obj, [keyOf(kind)]: next }, removed: true };
}

export function backupFile(file: string): string | null {
  if (!fs.existsSync(file)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const bak = `${file}.ourbook-${stamp}.bak`;
  fs.copyFileSync(file, bak);
  return bak;
}

export function writeConfig(file: string, config: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n", "utf8");
}
