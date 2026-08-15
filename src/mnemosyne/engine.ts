import { spawn, type ChildProcess } from "node:child_process";
import type { DatabaseSync } from "node:sqlite";
import type { Config } from "../config.js";
import { workerScriptPath } from "../config.js";
import { logEngine } from "../db/database.js";

// ---------------------------------------------------------------------------
// Motor de generación de Mnemosyne. Cadena de fallback:
//   qwen-reverse (worker Python, chat.qwen.ai anónimo)
//     → local (endpoint OpenAI-compatible: Ollama/LM Studio/LocalAI)
//       → offline (generadores deterministas: nunca falla)
// Cada intento queda auditado en engine_log: la API principal del cliente
// nunca participa en la cognición de fondo.
// ---------------------------------------------------------------------------

export type EngineKind = Config["engine"];

export interface GenerationResult {
  text: string;
  engine: "qwen-reverse" | "local" | "offline";
  model: string | null;
}

interface WorkerResponse {
  id: number;
  ok: boolean;
  result?: string;
  error?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Worker Python (proceso persistente, JSONL por stdio)
// ---------------------------------------------------------------------------
class QwenWorker {
  private proc: ChildProcess | null = null;
  private pending = new Map<number, (v: WorkerResponse) => void>();
  private seq = 0;
  private buffer = "";
  private lastRequestAt = 0;
  private dead = false;

  constructor(private cfg: Config) {}

  private ensure(): ChildProcess {
    if (this.proc && !this.proc.killed && this.proc.exitCode === null) return this.proc;
    const script = workerScriptPath();
    const child = spawn(this.cfg.python, [script], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        OURBOOK_ENGINE_MODEL: this.cfg.engineModel,
        OURBOOK_ENGINE_PROXY: this.cfg.engineProxy,
        OURBOOK_WAF_COOLDOWN_MS: String(this.cfg.wafCooldownMs),
      },
    });
    this.dead = false;
    child.stdout!.on("data", (chunk: Buffer) => {
      this.buffer += chunk.toString("utf8");
      let nl: number;
      while ((nl = this.buffer.indexOf("\n")) >= 0) {
        const line = this.buffer.slice(0, nl).trim();
        this.buffer = this.buffer.slice(nl + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line) as WorkerResponse;
          const resolve = this.pending.get(msg.id);
          if (resolve) {
            this.pending.delete(msg.id);
            resolve(msg);
          }
        } catch {
          /* línea corrupta: ignorar */
        }
      }
    });
    child.stderr!.on("data", (d: Buffer) => {
      process.stderr.write(`[mnemosyne] ${d.toString()}`);
    });
    child.on("exit", () => {
      this.proc = null;
      this.dead = true;
      for (const resolve of this.pending.values()) {
        resolve({ id: -1, ok: false, error: "worker exit" });
      }
      this.pending.clear();
    });
    child.on("error", () => {
      this.proc = null;
      this.dead = true;
    });
    this.proc = child;
    return child;
  }

  async request(op: string, payload: unknown): Promise<WorkerResponse> {
    const proc = this.ensure();
    // Espaciado entre peticiones: respeta la doc de qwen-reverse (sin ráfagas).
    const wait = this.lastRequestAt + this.cfg.engineSpacingMs - Date.now();
    if (wait > 0) await sleep(wait);
    this.lastRequestAt = Date.now();

    const id = ++this.seq;
    const response = new Promise<WorkerResponse>((resolve) => {
      this.pending.set(id, resolve);
      proc.stdin!.write(JSON.stringify({ id, op, payload }) + "\n", (err) => {
        if (err) {
          this.pending.delete(id);
          resolve({ id, ok: false, error: `stdin: ${err.message}` });
        }
      });
    });
    const timeout = new Promise<WorkerResponse>((resolve) =>
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          resolve({ id, ok: false, error: "timeout" });
        }
      }, this.cfg.engineTimeoutMs),
    );
    const result = await Promise.race([response, timeout]);
    return result;
  }

  async complete(prompt: string): Promise<string> {
    const res = await this.request("complete", { prompt });
    if (!res.ok) throw new Error(res.error ?? "worker error");
    return (res.result ?? "").trim();
  }

  close(): void {
    if (this.proc && this.proc.exitCode === null) {
      this.proc.kill();
    }
  }
}

// ---------------------------------------------------------------------------
// Endpoint local OpenAI-compatible
// ---------------------------------------------------------------------------
async function localComplete(cfg: Config, prompt: string): Promise<string> {
  if (!cfg.localEndpoint) throw new Error("sin endpoint local configurado");
  const base = cfg.localEndpoint.replace(/\/+$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.engineTimeoutMs);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: cfg.localModel || undefined,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.9,
      }),
    });
    if (!res.ok) throw new Error(`local ${res.status}`);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("local: respuesta vacía");
    return text.trim();
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Fachada Mnemosyne
// ---------------------------------------------------------------------------
export class Mnemosyne {
  private worker: QwenWorker | null = null;

  constructor(
    private cfg: Config,
    private db: DatabaseSync,
  ) {}

  private getWorker(): QwenWorker {
    if (!this.worker) this.worker = new QwenWorker(this.cfg);
    return this.worker;
  }

  /**
   * Genera texto con la cadena de fallback. `fallbackText` produce la versión
   * offline (determinista) — Mnemosyne nunca falla.
   */
  async complete(op: string, prompt: string, fallbackText: () => string): Promise<GenerationResult> {
    const t0 = Date.now();
    if (this.cfg.engine === "offline") {
      const text = fallbackText();
      logEngine(this.db, op, "offline", null, true, Date.now() - t0);
      return { text, engine: "offline", model: null };
    }

    if (this.cfg.engine === "local") {
      try {
        const text = await localComplete(this.cfg, prompt);
        logEngine(this.db, op, "local", this.cfg.localModel || null, true, Date.now() - t0);
        return { text, engine: "local", model: this.cfg.localModel || null };
      } catch (e) {
        logEngine(this.db, op, "local", this.cfg.localModel || null, false, Date.now() - t0);
        const text = fallbackText();
        logEngine(this.db, op, "offline", null, true, Date.now() - t0);
        return { text, engine: "offline", model: null };
      }
    }

    // qwen-reverse por defecto
    try {
      const text = await this.getWorker().complete(prompt);
      logEngine(this.db, op, "qwen-reverse", this.cfg.engineModel || null, true, Date.now() - t0);
      return { text, engine: "qwen-reverse", model: this.cfg.engineModel || null };
    } catch (e) {
      logEngine(this.db, op, "qwen-reverse", this.cfg.engineModel || null, false, Date.now() - t0);
    }
    try {
      const text = await localComplete(this.cfg, prompt);
      logEngine(this.db, op, "local", this.cfg.localModel || null, true, Date.now() - t0);
      return { text, engine: "local", model: this.cfg.localModel || null };
    } catch {
      logEngine(this.db, op, "local", this.cfg.localModel || null, false, Date.now() - t0);
    }
    const text = fallbackText();
    logEngine(this.db, op, "offline", null, true, Date.now() - t0);
    return { text, engine: "offline", model: null };
  }

  /** ¿Está disponible el motor remoto? (diagnóstico, sin bloquear). */
  async ping(): Promise<{ engine: EngineKind; reachable: boolean; note: string }> {
    if (this.cfg.engine === "offline") {
      return { engine: "offline", reachable: true, note: "generadores deterministas (sin red)" };
    }
    if (this.cfg.engine === "local") {
      const ok = this.cfg.localEndpoint.length > 0;
      return { engine: "local", reachable: ok, note: ok ? this.cfg.localEndpoint : "sin endpoint" };
    }
    try {
      const res = await this.getWorker().request("ping", {});
      return { engine: "qwen-reverse", reachable: res.ok, note: res.ok ? "chat.qwen.ai anónimo" : (res.error ?? "no disponible") };
    } catch {
      return { engine: "qwen-reverse", reachable: false, note: "worker no arrancó" };
    }
  }

  close(): void {
    this.worker?.close();
    this.worker = null;
  }
}
