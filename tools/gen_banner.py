"""Genera el fondo del banner social (16:9) con qwen-reverse t2i.

Uso (venv con qwen_reverse):
  .venv\\Scripts\\python.exe tools/gen_banner.py
"""
import asyncio
import os
import sys
import urllib.request

from qwen_reverse import Generative

PROMPT = (
    "Cinematic wide banner about shared AI memory and dreams: a large open glowing "
    "book at the center on a deep indigo night sky, a golden crescent moon above it, "
    "sparkles and faint constellation lines, warm amber light rising from the pages, "
    "elegant minimalist flat illustration, deep indigo and gold palette, no text, no "
    "letters, no watermark, 16:9 wide composition with a darker area at the bottom "
    "for text overlay."
)


async def main() -> None:
    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets")
    os.makedirs(out_dir, exist_ok=True)
    gen = Generative(model="qwen3.8-max")
    print("generando banner 16:9…", flush=True)
    urls = await gen.generate_image(PROMPT, aspect_ratio="16:9")
    if not urls:
        raise RuntimeError("sin URLs de imagen")
    url = urls[0]
    print("URL:", url, flush=True)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    data = urllib.request.urlopen(req, timeout=90).read()
    out = os.path.join(out_dir, "banner-bg.png")
    with open(out, "wb") as f:
        f.write(data)
    print(f"guardado: {out} ({len(data)} bytes)", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
