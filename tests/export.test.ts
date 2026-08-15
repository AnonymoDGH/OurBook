import { describe, it, expect } from "vitest";
import { openDatabase } from "../src/db/database.js";
import {
  addMemory,
  addDream,
  addDigest,
  addChapter,
  addTurningPoint,
  setChapterStatus,
  setTurningPointStatus,
  getPersona,
} from "../src/db/repo.js";
import { buildBookMarkdown, markdownToHtml, buildBookHtml } from "../src/export/render.js";
import { buildSeed, importSeed, seedFromDump } from "../src/export/seed.js";
import { exportDump } from "../src/db/repo.js";

function bookDb() {
  const db = openDatabase(":memory:");
  addMemory(db, { content: "La primera noche de la casa, con velas.", veracity: "real", importance: 5, flashbulb: true, valence: 0.9, tags: ["casa"] });
  addMemory(db, { content: "Comimos pizza viendo una tormenta.", veracity: "real", valence: 0.6, tags: ["pizza"] });
  addMemory(db, { content: "Soñé que la casa crecía un piso cada noche.", veracity: "imagined" });
  addDream(db, { content: "SUEÑO: LA CASA QUE CRECE\n\nla casa tenía un piso nuevo.", theme: "casa", seedFragments: [{ id: "m1", snippet: "La primera noche de la casa" }], engine: "offline" });
  addDigest(db, { date: "2026-01-10", content: "Hoy la casa empezó a sentirse nuestra." });
  const ch = addChapter(db, { title: "El comienzo", prose: "Nos mudamos un sábado. Las velas lo iluminaron todo.", rangeStart: "2026-01-01", rangeEnd: "2026-01-31" });
  setChapterStatus(db, ch.id, "published");
  const tp = addTurningPoint(db, { date: "2026-01-01", title: "La primera noche", importance: 5 });
  setTurningPointStatus(db, tp.id, "confirmed");
  return db;
}

describe("el libro (export)", () => {
  it("el markdown distingue lo real de lo soñado", () => {
    const md = buildBookMarkdown(bookDb());
    expect(md).toContain("# OurBook");
    expect(md).toContain("Parte I — La crónica");
    expect(md).toContain("El comienzo");
    expect(md).toContain("Parte IV — Los sueños");
    // El sueño va en cursiva y marcado; el recuerdo real no.
    const dreamLine = md.split("\n").find((l) => l.includes("un piso cada noche"));
    expect(dreamLine).toBeTruthy();
    expect(md).toContain("(sueño)");
    expect(md).toContain("No es una conciencia");
  });

  it("el HTML se renderiza sin romper", () => {
    const html = buildBookHtml(buildBookMarkdown(bookDb()));
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<h1>OurBook</h1>");
    expect(html).toContain("<blockquote>");
  });

  it("markdownToHtml maneja encabezados, listas y citas", () => {
    const html = markdownToHtml("# Título\n\n- uno\n- dos\n\n> cita\n\n---\n\npárrafo **negrita**");
    expect(html).toContain("<h1>Título</h1>");
    expect(html).toContain("<li>uno</li>");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("<hr/>");
    expect(html).toContain("<strong>negrita</strong>");
  });
});

describe("semilla de identidad (portabilidad)", () => {
  it("el seed solo lleva lo real y permite reconstruir el libro", () => {
    const db = bookDb();
    const seed = buildSeed(db);
    expect(seed.format).toBe("ourbook-seed");
    // sin sueños ni borradores
    expect(seed.memories.every((m) => m.veracity === "real" || m.veracity === "observed")).toBe(true);
    expect(seed.memories.some((m) => m.veracity === "imagined")).toBe(false);
    expect(seed.chapters.length).toBe(1);
    expect(seed.turning_points.length).toBe(1);

    // libro nuevo en modo fresh
    const db2 = openDatabase(":memory:");
    const res = importSeed(db2, seed, "fresh");
    expect(res.memories).toBe(2);
    const md2 = buildBookMarkdown(db2);
    expect(md2).toContain("La primera noche de la casa");
    expect(md2).not.toContain("un piso cada noche"); // el sueño no viaja en el seed
  });

  it("seedFromDump acepta un volcado completo", () => {
    const db = bookDb();
    const dump = exportDump(db);
    const seed = seedFromDump(dump);
    expect(seed.format).toBe("ourbook-seed");
    expect(seed.memories.length).toBe(2);
    expect(seed.persona.name).toBe(getPersona(db).name);
  });
});
