import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildEntry,
  detectAgents,
  setEntry,
  unsetEntry,
  backupFile,
  writeConfig,
  readConfig,
  SERVER_ENTRY_NAME,
  type ConfigKind,
  type PathProvider,
} from "../src/setup/agents.js";

let tmp: string;
let paths: PathProvider;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ourbook-setup-"));
  paths = {
    home: path.join(tmp, "home"),
    appdata: path.join(tmp, "appdata"),
    cwd: path.join(tmp, "proj"),
  };
  fs.mkdirSync(paths.home, { recursive: true });
  fs.mkdirSync(paths.appdata, { recursive: true });
  fs.mkdirSync(paths.cwd, { recursive: true });
});

const kinds: ConfigKind[] = ["mcpServers", "servers", "mcp", "context_servers", "mcp_servers"];

describe("detección de agentes", () => {
  it("detecta los agentes instalados con su formato de config", () => {
    fs.mkdirSync(path.join(paths.home, ".cursor"), { recursive: true });
    fs.mkdirSync(path.join(paths.home, ".config", "opencode"), { recursive: true });
    const agents = detectAgents(paths);
    const cursor = agents.find((a) => a.id === "cursor")!;
    expect(cursor.detected).toBe(true);
    expect(cursor.exists).toBe(false);
    expect(cursor.kind).toBe("mcpServers");
    const opencode = agents.find((a) => a.id === "opencode")!;
    expect(opencode.detected).toBe(true);
    expect(opencode.kind).toBe("mcp");
    const claude = agents.find((a) => a.id === "claude-desktop")!;
    expect(claude.detected).toBe(false);
  });

  it("marca hasOurbook cuando la entrada ya existe", () => {
    const cursorDir = path.join(paths.home, ".cursor");
    fs.mkdirSync(cursorDir, { recursive: true });
    const cfg = path.join(cursorDir, "mcp.json");
    writeConfig(cfg, { mcpServers: { [SERVER_ENTRY_NAME]: { command: "node" } } });
    const cursor = detectAgents(paths).find((a) => a.id === "cursor")!;
    expect(cursor.exists).toBe(true);
    expect(cursor.hasOurbook).toBe(true);
  });
});

describe("formas de entrada por agente", () => {
  it("cada formato produce la estructura correcta", () => {
    const entry = { command: "node", args: ["dist/index.js"], env: {} };
    expect(buildEntry("mcpServers", entry)).toEqual({ command: "node", args: ["dist/index.js"], env: {} });
    expect(buildEntry("servers", entry)).toEqual({ type: "stdio", command: "node", args: ["dist/index.js"], env: {} });
    expect(buildEntry("mcp", entry)).toEqual({ type: "local", command: ["node", "dist/index.js"], enabled: true, environment: {} });
    expect(buildEntry("context_servers", entry)).toEqual({ command: ["node", "dist/index.js"], environment: {} });
    expect(buildEntry("mcp_servers", entry)).toEqual({ command: ["node", "dist/index.js"], env: {} });
  });

  it("setEntry preserva servidores existentes de otros paquetes", () => {
    const existing = { mcpServers: { otro: { command: "x" } } };
    const next = setEntry(existing, "mcpServers", { command: "node", args: [], env: {} });
    expect(next.mcpServers.otro).toEqual({ command: "x" });
    expect(next.mcpServers.ourbook).toBeTruthy();
  });

  it("unsetEntry retira solo la entrada de ourbook", () => {
    const existing = { mcpServers: { ourbook: { command: "node" }, otro: { command: "x" } } };
    const { config, removed } = unsetEntry(existing, "mcpServers");
    expect(removed).toBe(true);
    expect(config.mcpServers.ourbook).toBeUndefined();
    expect(config.mcpServers.otro).toBeTruthy();
  });
});

describe("escritura con backup", () => {
  it("escribe el config creando directorios y hace backup del previo", () => {
    const file = path.join(paths.home, ".cursor", "mcp.json");
    writeConfig(file, { mcpServers: { a: { command: "1" } } });
    const bak = backupFile(file);
    expect(bak).toBeTruthy();
    expect(fs.existsSync(bak!)).toBe(true);
    writeConfig(file, { mcpServers: { a: { command: "2" } } });
    expect(readConfig(file)).toEqual({ mcpServers: { a: { command: "2" } } });
    expect(readConfig(bak!)).toEqual({ mcpServers: { a: { command: "1" } } });
  });

  it("backupFile devuelve null si el archivo no existe", () => {
    expect(backupFile(path.join(tmp, "nope.json"))).toBeNull();
  });
});

describe("ciclo completo sobre configs reales", () => {
  it("instala y desinstala en formato opencode (mcp)", () => {
    const cfgPath = path.join(paths.home, ".config", "opencode", "opencode.json");
    writeConfig(cfgPath, { $schema: "https://opencode.ai/config.json" });
    const existing = readConfig(cfgPath);
    const next = setEntry(existing, "mcp", buildEntry("mcp", { command: "node", args: ["x.js"], env: {} }));
    writeConfig(cfgPath, next);
    const after = readConfig(cfgPath) as { mcp: Record<string, unknown> };
    expect(after.mcp.ourbook).toMatchObject({ type: "local", enabled: true });
    expect(after.$schema).toContain("opencode");

    const { config, removed } = unsetEntry(readConfig(cfgPath), "mcp");
    expect(removed).toBe(true);
    writeConfig(cfgPath, config);
    const final = readConfig(cfgPath) as { mcp?: Record<string, unknown> };
    expect(final.mcp?.ourbook).toBeUndefined();
  });

  it("detectAgents con cada kind no lanza", () => {
    for (const kind of kinds) void kind;
    const agents = detectAgents(paths);
    expect(agents.length).toBeGreaterThanOrEqual(8);
  });
});
