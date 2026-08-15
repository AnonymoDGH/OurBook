import { describe, it, expect } from "vitest";
import { openDatabase } from "../src/db/database.js";
import {
  addMemory,
  getMemory,
  searchMemories,
  softDeleteMemory,
  purgeMemory,
  updateMemory,
  listActiveMemories,
} from "../src/db/repo.js";
import { effectiveDecay, isArchiveCandidate } from "../src/lib/decay.js";

function freshDb() {
  return openDatabase(":memory:");
}

describe("memorias y veracidad", () => {
  it("guarda y recupera una memoria con taxonomía de veracidad", () => {
    const db = freshDb();
    const m = addMemory(db, {
      content: "Aquel día llovió y reímos bajo el toldo del café.",
      veracity: "real",
      valence: 0.8,
      importance: 4,
      tags: ["lluvia", "café"],
    });
    expect(m.id).toBeTruthy();
    const got = getMemory(db, m.id)!;
    expect(got.content).toContain("llovió");
    expect(got.veracity).toBe("real");
    expect(got.flashbulb).toBe(0);
  });

  it("un sueño (imagined) nunca aparece en el recall factual por defecto", () => {
    const db = freshDb();
    addMemory(db, { content: "Soñé que volábamos sobre el mar con casas de cristal.", veracity: "imagined" });
    addMemory(db, { content: "Hicimos una hoguera en la playa.", veracity: "real" });
    const hits = searchMemories(db, { query: "playa" });
    expect(hits.some((m) => m.veracity === "imagined")).toBe(false);
    const all = listActiveMemories(db, {});
    expect(all.length).toBe(2);
  });

  it("las memorias privadas quedan fuera del recall por defecto", () => {
    const db = freshDb();
    addMemory(db, { content: "secreto de la infancia", privacy: "private", veracity: "real" });
    addMemory(db, { content: "paseo por el parque", veracity: "real" });
    const hits = searchMemories(db, { query: "secreto" });
    expect(hits.length).toBe(0);
    const withPriv = searchMemories(db, { query: "secreto", includePrivate: true });
    expect(withPriv.length).toBe(1);
  });

  it("flashbulb es inmune al decaimiento", () => {
    const db = freshDb();
    const m = addMemory(db, { content: "El día que empezó todo.", importance: 5, flashbulb: true });
    const old = { ...m, created_at: new Date(Date.now() - 90 * 86_400_000).toISOString() };
    expect(effectiveDecay(old)).toBe(1);
    const normal = addMemory(db, { content: "un detalle cualquiera", importance: 1 });
    const aged = { ...normal, created_at: new Date(Date.now() - 90 * 86_400_000).toISOString() };
    expect(effectiveDecay(aged)).toBeLessThan(0.05);
  });

  it("el recall refuerza la huella (retrieval practice)", () => {
    const db = freshDb();
    const m = addMemory(db, { content: "la casa del abuelo", veracity: "real", importance: 3 });
    // simulamos una huella ya desgastada
    db.prepare("UPDATE memories SET decay=0.5 WHERE id=?").run(m.id);
    const hits = searchMemories(db, { query: "abuelo" });
    expect(hits.length).toBe(1);
    const after = getMemory(db, m.id)!;
    expect(after.access_count).toBe(1);
    expect(after.decay).toBeGreaterThan(0.5);
  });

  it("candidata a archivo: baja importancia + edad + huella débil", () => {
    const old = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const row = { importance: 1, flashbulb: 0, decay: 0.2, created_at: old };
    expect(isArchiveCandidate(row)).toBe(true);
    const rowFlash = { ...row, flashbulb: 1 };
    expect(isArchiveCandidate(rowFlash)).toBe(false);
  });

  it("olvidar es soft y auditable; purgar elimina", () => {
    const db = freshDb();
    const m = addMemory(db, { content: "algo que quiero olvidar", veracity: "real" });
    const before = getMemory(db, m.id)!;
    softDeleteMemory(db, m.id);
    expect(getMemory(db, m.id)!.status).toBe("deleted");
    purgeMemory(db, m.id);
    expect(getMemory(db, m.id)).toBeNull();
    expect(before.content).toContain("olvidar");
  });

  it("corregir reescribe en el sitio", () => {
    const db = freshDb();
    const m = addMemory(db, { content: "esto pasó así", veracity: "real" });
    updateMemory(db, m.id, { content: "en realidad pasó de otra manera" });
    expect(getMemory(db, m.id)!.content).toBe("en realidad pasó de otra manera");
  });
});

describe("decaimiento numérico", () => {
  it("la huella decae exponencialmente con la edad", () => {
    const now = new Date();
    const row = { importance: 3, flashbulb: 0, decay: 1, created_at: new Date(now.getTime() - 10 * 86_400_000).toISOString() };
    const d = effectiveDecay(row, now);
    expect(d).toBeGreaterThan(0.5);
    expect(d).toBeLessThan(1);
  });
});
