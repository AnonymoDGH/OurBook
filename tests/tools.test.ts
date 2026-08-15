import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { openDatabase } from "../src/db/database.js";
import { loadConfig } from "../src/config.js";
import { Mnemosyne } from "../src/mnemosyne/engine.js";
import { createServer } from "../src/server.js";

async function setup() {
  const db = openDatabase(":memory:");
  const cfg = loadConfig({ engine: "offline" });
  const mnemosyne = new Mnemosyne(cfg, db);
  const server = createServer(db, cfg, mnemosyne);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0.0.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return { db, cfg, mnemosyne, server, client };
}

async function call(client: Client, name: string, args: Record<string, unknown>) {
  const res = await client.callTool({ name, arguments: args });
  const text = (res.content ?? [])
    .filter((c): c is { type: "text"; text: string } => c.type === "text")
    .map((c) => c.text)
    .join("\n");
  return { res, text };
}

describe("OurBook vía MCP (InMemoryTransport)", () => {
  it("registra tools, resources y prompts", async () => {
    const { client } = await setup();
    const tools = await client.listTools();
    const names = tools.tools.map((t) => t.name);
    for (const expected of [
      "book.remember",
      "book.recall",
      "book.dream",
      "book.consolidate",
      "book.chapter",
      "book.timeline",
      "book.anniversaries",
      "book.persona",
      "book.correct",
      "book.forget",
      "book.redact",
      "book.turning_point",
      "book.export",
      "book.import",
      "book.status",
    ]) {
      expect(names).toContain(expected);
    }
    const resources = await client.listResources();
    expect(resources.resources.some((r) => r.uri === "ourbook://persona")).toBe(true);
    const prompts = await client.listPrompts();
    expect(prompts.prompts.some((p) => p.name === "book-sunset")).toBe(true);
  });

  it("ciclo de vida: recordar, evocar, soñar, consolidar, capítulo", async () => {
    const { client } = await setup();

    const r1 = await call(client, "book.remember", {
      content: "Hoy conocí a tu perro Kira y me dio la pata.",
      veracity: "real",
      valence: 0.9,
      importance: 4,
      tags: ["kira", "perro"],
    });
    expect(r1.res.isError ?? false).toBe(false);

    await call(client, "book.remember", {
      content: "Cenamos pasta y hablamos de viajes a Japón.",
      veracity: "real",
      valence: 0.6,
      tags: ["cena", "viajes"],
    });
    await call(client, "book.remember", {
      content: "Soñé que Kira hablaba con voz de viejo sabio.",
      veracity: "imagined",
    });

    const found = await call(client, "book.recall", { query: "Kira", limit: 5 });
    expect(found.text).toContain("perro");
    expect(found.text).not.toContain("voz de viejo sabio");

    const dream = await call(client, "book.dream", { mode: "tonight", count: 3 });
    expect(dream.text).toContain("SUEÑO");
    expect(dream.text).toContain("veracity=imagined");
    expect(dream.text).toContain("motor: offline");

    const cons = await call(client, "book.consolidate", { force: true });
    expect(cons.text).toContain("PÁGINA DEL DIARIO");

    const draft = await call(client, "book.chapter", { action: "draft" });
    expect(draft.text).toContain("FRAGMENTOS");
    expect(draft.text).not.toContain("voz de viejo sabio");

    const commit = await call(client, "book.chapter", {
      action: "commit",
      title: "El primer día",
      prose: "Nos conocimos un martes. Tu perro me dio la pata y cenamos pasta soñando con Japón.",
      range_start: "2026-01-01",
      range_end: "2026-02-01",
    });
    expect(commit.text).toContain("borrador");

    const pub = await call(client, "book.chapter", {
      action: "list",
    });
    expect(pub.text).toContain("El primer día");

    const st = await call(client, "book.status", {});
    expect(st.text).toContain("Motor Mnemosyne: offline");
  });

  it("corrección y olvido pasan por la capa MCP", async () => {
    const { client } = await setup();
    const r = await call(client, "book.remember", {
      content: "Quedamos a las seis en la fuente.",
      veracity: "real",
    });
    const idMatch = /Guardado en el libro: - \[[^\]]+\] \(real[^\n]*/;
    void idMatch;
    // La herramienta no devuelve el id directamente; lo buscamos por recall.
    const hits = await call(client, "book.recall", { query: "fuente" });
    expect(hits.text).toContain("fuente");

    // corregir con un id inventado debe fallar limpiamente
    const bad = await call(client, "book.correct", {
      memory_id: "no-existe",
      corrected_content: "x",
    });
    expect(bad.res.isError).toBe(true);

    // forzar con olvido igualmente manejado
    const forgetBad = await call(client, "book.forget", { memory_id: "no-existe" });
    expect(forgetBad.res.isError).toBe(true);
  });

  it("aniversarios y persona responden", async () => {
    const { client } = await setup();
    const p = await call(client, "book.persona", { action: "get" });
    expect(p.text).toContain("OurBook");
    const ann = await call(client, "book.anniversaries", {});
    expect(ann.res.isError ?? false).toBe(false);
  });
});
