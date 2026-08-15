import { describe, it, expect } from "vitest";
import { openDatabase } from "../src/db/database.js";
import { loadConfig } from "../src/config.js";
import { Mnemosyne } from "../src/mnemosyne/engine.js";
import { offlineDream, offlineDiary, offlineLabel } from "../src/mnemosyne/offline.js";
import { dreamPrompt } from "../src/mnemosyne/prompt.js";
import { addMemory, getPersona, listActiveMemories, lastConsolidatedAt, lastDreamAt } from "../src/db/repo.js";

describe("generadores offline (deterministas)", () => {
  it("offlineDream es reproducible con la misma semilla", () => {
    const frags = [
      { id: "a", content: "la playa en invierno" },
      { id: "b", content: "tu risa al cocinar" },
      { id: "c", content: "el tren de las siete" },
    ];
    const d1 = offlineDream({ fragments: frags, theme: "casa", mode: "tonight" });
    const d2 = offlineDream({ fragments: frags, theme: "casa", mode: "tonight" });
    expect(d1.content).toBe(d2.content);
    expect(d1.content).toContain("SUEÑO");
    expect(d1.content.length).toBeGreaterThan(80);
  });

  it("offlineDiary agrupa y nunca inventa hechos nuevos", () => {
    const top = [
      addMemory(openDatabase(":memory:"), { content: "fuimos al río", tags: ["río"] }),
    ];
    const groups = [{ label: "río", count: 1, top }];
    const d = offlineDiary({ groups, date: "2026-01-15" });
    expect(d).toContain("río");
    expect(d).toContain("2026-01-15");
  });

  it("offlineLabel devuelve valencia acotada", () => {
    const l = offlineLabel("feliz reímos y brindamos por el viaje");
    expect(l.valence).toBeGreaterThan(0);
    const n = offlineLabel("perdí el tren y lloré en la estación");
    expect(n.valence).toBeLessThan(0);
  });
});

describe("Mnemosyne: cadena de fallback", () => {
  it("con engine=offline nunca toca red y audita engine_log", async () => {
    const db = openDatabase(":memory:");
    const cfg = loadConfig({ engine: "offline" });
    const mn = new Mnemosyne(cfg, db);
    const res = await mn.complete("dream", "prompt cualquiera", () => "sueño offline de prueba");
    expect(res.engine).toBe("offline");
    const logs = db.prepare("SELECT * FROM engine_log WHERE op='dream'").all() as Array<{ engine: string; ok: number }>;
    expect(logs.length).toBe(1);
    expect(logs[0]!.engine).toBe("offline");
    expect(logs[0]!.ok).toBe(1);
  });

  it("con engine=qwen-reverse y worker ausente cae a local→offline sin romperse", async () => {
    const db = openDatabase(":memory:");
    const cfg = loadConfig({
      engine: "qwen-reverse",
      python: "python-que-no-existe-xyz", // worker no arranca
      localEndpoint: "", // tampoco hay local
      engineSpacingMs: 0,
    });
    const mn = new Mnemosyne(cfg, db);
    const res = await mn.complete("consolidate", "prompt", () => "página offline de prueba");
    expect(res.engine).toBe("offline");
    const logs = db.prepare("SELECT engine, ok FROM engine_log WHERE op='consolidate' ORDER BY id").all() as Array<{ engine: string; ok: number }>;
    expect(logs.length).toBeGreaterThanOrEqual(2); // qwen-reverse fallo + offline ok
    expect(logs[logs.length - 1]).toEqual({ engine: "offline", ok: 1 });
    mn.close();
  });

  it("dreamPrompt exige que el sueño no afirme hechos", () => {
    const db = openDatabase(":memory:");
    const p = getPersona(db);
    const prompt = dreamPrompt(p, [{ id: "x", content: "el gato se perdió" }], { mode: "tonight" });
    expect(prompt).toContain("NUNCA");
    expect(prompt).toContain("sueño");
  });
});

describe("meta de consolidación", () => {
  it("registra fechas de sueño y consolidación", () => {
    const db = openDatabase(":memory:");
    expect(lastConsolidatedAt(db)).toBeNull();
    expect(lastDreamAt(db)).toBeNull();
    expect(listActiveMemories(db, {})).toEqual([]);
  });
});
