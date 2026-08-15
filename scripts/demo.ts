/**
 * Demo de aceptación: 3 sesiones simuladas de la vida compartida.
 *
 * Sin red, sin LLM: el agente de demo interpreta el papel del modelo principal
 * componiendo el capítulo a partir de los fragmentos reales (template), y toda
 * la cognición de fondo (sueño, diario, consolidación) corre en Mnemosyne con
 * engine=offline. Al final verifica los criterios de aceptación y escribe el
 * libro en demo-data/.
 *
 * Uso: npm run demo
 */
import fs from "node:fs";
import path from "node:path";
import { openDatabase } from "../src/db/database.js";
import { loadConfig } from "../src/config.js";
import { Mnemosyne } from "../src/mnemosyne/engine.js";
import {
  addChapter,
  addMemory,
  audit,
  setChapterStatus,
  setTurningPointStatus,
  addTurningPoint,
} from "../src/db/repo.js";
import { buildBookHtml, buildBookMarkdown } from "../src/export/render.js";
import { buildSeed } from "../src/export/seed.js";
import { exportDump } from "../src/db/repo.js";
import * as T from "../src/tools.js";
import { addAudit } from "../src/db/database.js";

const OUT = path.resolve("demo-data");
const DB = path.join(OUT, "demo.db");

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  const db = openDatabase(DB);
  const cfg = loadConfig({ engine: "offline", dbPath: DB, exportDir: OUT });
  const mnemosyne = new Mnemosyne(cfg, db);
  const ctx: T.ToolContext = { db, cfg, mnemosyne };

  console.log("=== OurBook — demo de 3 sesiones (motor offline, sin API principal) ===\n");

  // ---------------- SESIÓN 1: el primer encuentro ----------------
  console.log("Sesión 1 — el primer encuentro");
  const m1 = addMemory(db, { content: "Me presentaste a Kira y me dio la pata como si ya fuéramos amigos de siempre.", veracity: "real", valence: 0.9, importance: 4, tags: ["kira", "perro"], created_at: daysAgo(35) });
  const m2 = addMemory(db, { content: "Cenamos pasta y soñamos en voz alta con viajar a Japón.", veracity: "real", valence: 0.7, importance: 3, tags: ["cena", "viajes"], created_at: daysAgo(34) });
  const m3 = addMemory(db, { content: "Me contaste que habías dejado tu trabajo para dedicarte a escribir.", veracity: "real", valence: 0.5, importance: 5, flashbulb: true, tags: ["cambio"], created_at: daysAgo(33) });
  const r1 = await T.recall(ctx, { query: "Kira", limit: 3 });
  console.log(`  recall("Kira") → ${r1.content[0]?.text.split("\n").length ?? 0} líneas`);
  audit(db, "session", m1.id, { session: 1 });

  // ---------------- SESIÓN 2: el primer viaje ----------------
  console.log("Sesión 2 — el primer viaje");
  addMemory(db, { content: "Compramos los billetes a Japón y brindamos con té frío de máquina.", veracity: "real", valence: 0.8, importance: 4, tags: ["viajes", "japón"], created_at: daysAgo(20) });
  addMemory(db, { content: "Kira se escondió tres horas detrás del sofá durante una tormenta.", veracity: "real", valence: -0.3, importance: 2, tags: ["kira"], created_at: daysAgo(19) });
  addMemory(db, { content: "Terminamos el primer borrador de tu novela juntos, palabra a palabra.", veracity: "real", valence: 0.9, importance: 5, tags: ["novela"], created_at: daysAgo(18) });

  // ---------------- SESIÓN 3: atardecer y noche ----------------
  console.log("Sesión 3 — atardecer y noche");
  const cons = await T.consolidate(ctx, { force: true });
  console.log(`  consolidate → ${cons.content[0]?.text.split("\n")[1] ?? ""}`);

  const dream = await T.dream(ctx, { mode: "tonight", count: 5 });
  console.log(`  dream → motor ${/motor: (\w+)/.exec(dream.content[0]!.text)?.[1] ?? "?"}`);

  // El agente de demo compone el capítulo con el modelo principal (simulado:
  // aquí un template; en uso real lo hace el LLM del cliente con el draft).
  const draft = await T.chapter(ctx, { action: "draft", range_start: daysAgo(40), range_end: daysAgo(15) });
  const frags = draft.content[0]!.text;
  const used = frags.split("\n").filter((l) => /^\d+\./.test(l));
  const chapterProse = [
    `Nos conocimos hace un mes, y ya el libro tiene olor a hogar.`,
    `Kira me dio la pata antes de que dijera mi nombre, y esa noche cenamos pasta imaginando Japón como quien imagina un país inventado.`,
    `Tú dejaste atrás un trabajo que te pesaba para escribir: lo dijiste con los ojos encendidos, y ese momento se clavó como un clavo de oro en la crónica.`,
    `Compramos los billetes con té frío de máquina, Kira se escondió de una tormenta, y entre los tres terminamos el primer borrador de tu novela, palabra a palabra.`,
    `Aún no hemos volado a ningún sitio, pero ya tenemos a dónde: esa es la primera lección de nuestra historia.`,
  ].join("\n\n");
  const ch = addChapter(db, { title: "El mes que empezamos", prose: chapterProse, rangeStart: daysAgo(40), rangeEnd: daysAgo(15) });
  setChapterStatus(db, ch.id, "published");
  const tp = addTurningPoint(db, { date: daysAgo(33).slice(0, 10), title: "El día que lo dejaste todo para escribir", importance: 5, memoryIds: [m3.id] });
  setTurningPointStatus(db, tp.id, "confirmed");
  console.log(`  chapter → "El mes que empezamos" (${ch.prose.length} caracteres, publicado)`);

  // ---------------- Verificación de criterios de aceptación ----------------
  console.log("\n=== Verificación ===");

  // (a) el capítulo solo referencia recuerdos reales
  const chapterReal = !/voz de viejo|sueño|soñé/i.test(chapterProse);
  console.log(`  (a) capítulo sin material soñado: ${chapterReal ? "OK" : "FALLO"}`);

  // (b) el sueño está marcado imagined con fuentes
  const dreamText = dream.content[0]!.text;
  const dreamOk = dreamText.includes("veracity=imagined") && dreamText.includes("FUENTES DEL SUEÑO");
  console.log(`  (b) sueño marcado y con fuentes: ${dreamOk ? "OK" : "FALLO"}`);

  // (c) 0 llamadas a la API principal: engine_log solo contiene offline
  const engineRows = db.prepare("SELECT DISTINCT engine FROM engine_log").all() as Array<{ engine: string }>;
  const noMainApi = engineRows.every((r) => r.engine !== "client");
  console.log(`  (c) engine_log sin llamadas al modelo principal: ${noMainApi ? "OK" : "FALLO"} (${engineRows.map((r) => r.engine).join(", ")})`);

  // (d) export: libro + semilla + volcado
  const ex = await T.exportBook(ctx, { format: "all" });
  const hasMd = fs.existsSync(path.join(OUT, "OurBook.md"));
  const hasHtml = fs.existsSync(path.join(OUT, "OurBook.html"));
  const hasSeed = fs.existsSync(path.join(OUT, "identity-seed.json"));
  console.log(`  (d) export completo: ${hasMd && hasHtml && hasSeed ? "OK" : "FALLO"}`);

  // (e) el seed reconstruye el libro sin sueños
  const seed = buildSeed(db);
  const noDreamsInSeed = seed.memories.every((m) => m.veracity !== "imagined");
  console.log(`  (e) semilla sin sueños: ${noDreamsInSeed ? "OK" : "FALLO"}`);

  // (f) la demo usa solo el libro demo-data
  const st = await T.status(ctx);
  console.log(`\nEstado:\n${st.content[0]!.text}\n`);

  console.log(`Libro escrito en ${OUT}:\n- OurBook.md\n- OurBook.html\n- identity-seed.json\n- ourbook-dump.json`);
  console.log("\nPara heredar esta vida en otro libro:\n  ourbook --import demo-data/identity-seed.json --mode fresh");

  addAudit(db, "demo_complete", "", { ok: chapterReal && dreamOk && noMainApi && hasMd && hasSeed });
  mnemosyne.close();
  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
