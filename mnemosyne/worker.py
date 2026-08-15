"""Mnemosyne worker — motor de generación de fondo de OurBook.

Proceso hijo persistente de OurBook (TypeScript). Protocolo JSONL por stdio:

  in:  {"id": 1, "op": "ping" | "complete", "payload": {...}}
  out: {"id": 1, "ok": true, "result": "..."}  o  {"id":1,"ok":false,"error":"..."}

Usa qwen-reverse (cliente anónimo de chat.qwen.ai) como cliente normal:
cola secuencial, sin ráfagas, sin bypass de WAF ni rotación de proxies.
Los logs van a stderr para no contaminar el protocolo de stdout.
"""

import json
import os
import sys
import time


def log(msg: str) -> None:
    sys.stderr.write(f"[mnemosyne] {msg}\n")
    sys.stderr.flush()


def load_engine():
    """Importa qwen-reverse si está disponible; devuelve (Generative|None, error)."""
    try:
        from qwen_reverse import Generative  # type: ignore

        return Generative, None
    except Exception as exc:  # noqa: BLE001
        return None, str(exc)


def main() -> None:
    Generative, import_error = load_engine()
    waf_cooldown = int(os.environ.get("OURBOOK_WAF_COOLDOWN_MS", "60000"))
    model = os.environ.get("OURBOOK_ENGINE_MODEL", "") or None
    proxy = os.environ.get("OURBOOK_ENGINE_PROXY", "") or None
    log(
        f"worker listo | qwen_reverse={'sí' if Generative else 'NO (' + str(import_error) + ')'}"
        f" | modelo={model or 'catálogo por defecto'} | proxy={proxy or 'ninguno'}"
    )

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError:
            continue
        rid = req.get("id", -1)
        op = req.get("op", "")
        payload = req.get("payload") or {}

        if op == "ping":
            sys.stdout.write(
                json.dumps({"id": rid, "ok": True, "result": "ok", "engine": "qwen-reverse"}) + "\n"
            )
            sys.stdout.flush()
            continue

        if op == "complete":
            prompt = payload.get("prompt", "")
            if not Generative:
                sys.stdout.write(
                    json.dumps(
                        {"id": rid, "ok": False, "error": "qwen_reverse no instalado"}
                    )
                    + "\n"
                )
                sys.stdout.flush()
                continue
            try:
                gen = Generative(proxy=proxy)
                text = gen.generate(prompt, model=model)
                sys.stdout.write(json.dumps({"id": rid, "ok": True, "result": text}) + "\n")
                sys.stdout.flush()
            except Exception as exc:  # noqa: BLE001
                err = str(exc)
                log(f"complete falló: {err[:200]}")
                if "WAF" in err or "blocked" in err.lower():
                    log(f"WAF detectado: esperando {waf_cooldown} ms")
                    time.sleep(waf_cooldown / 1000.0)
                sys.stdout.write(
                    json.dumps({"id": rid, "ok": False, "error": err[:400]}) + "\n"
                )
                sys.stdout.flush()
            continue

        sys.stdout.write(
            json.dumps({"id": rid, "ok": False, "error": f"op desconocida: {op}"}) + "\n"
        )
        sys.stdout.flush()


if __name__ == "__main__":
    main()
