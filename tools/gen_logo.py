"""Genera conceptos de logo con qwen-reverse (t2i) y los descarga.

Uso (desde el venv que tenga qwen_reverse):
  .venv\\Scripts\\python.exe tools/gen_logo.py
"""
import asyncio
import os
import sys
import urllib.request

from qwen_reverse import Generative

# Prompt base: fondo blanco SÓLIDO para poder quitarlo después.
BASE = (
    "Minimalist flat vector logo, clean geometric style, centered composition, "
    "large margin, solid pure white background (#FFFFFF), no text, no letters, "
    "no watermark, no signature. "
)

CONCEPTS = [
    (
        "libro-luna",
        BASE
        + "An open book whose pages are warm cream; above it a golden crescent moon rises "
        "with three small stars; deep indigo night and gold palette, elegant and poetic.",
    ),
    (
        "pluma-sueno",
        BASE
        + "A golden quill pen whose ink trail becomes a purple crescent moon with tiny stars; "
        "deep indigo night and amethyst gold palette, dreamy and elegant.",
    ),
]


async def gen_one(name: str, prompt: str, out_dir: str) -> None:
    gen = Generative(model="qwen3.8-max")
    print(f"[{name}] generando…", flush=True)
    urls = await gen.generate_image(prompt, aspect_ratio="1:1")
    if not urls:
        raise RuntimeError("sin URLs de imagen en la respuesta")
    url = urls[0]
    print(f"[{name}] URL: {url}", flush=True)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    data = urllib.request.urlopen(req, timeout=90).read()
    out = os.path.join(out_dir, f"logo-{name}-raw.png")
    with open(out, "wb") as f:
        f.write(data)
    print(f"[{name}] guardado: {out} ({len(data)} bytes)", flush=True)


async def main() -> None:
    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets")
    os.makedirs(out_dir, exist_ok=True)
    ok = 0
    for name, prompt in CONCEPTS:
        try:
            await gen_one(name, prompt, out_dir)
            ok += 1
        except Exception as exc:  # noqa: BLE001
            print(f"[{name}] FALLO: {exc}", file=sys.stderr, flush=True)
    print(f"generados: {ok}/{len(CONCEPTS)}")


if __name__ == "__main__":
    asyncio.run(main())
