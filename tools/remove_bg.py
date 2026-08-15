"""Quita el fondo blanco de los logos generados (flood-fill desde los bordes).

Conserva blancos INTERIORES (p.ej. páginas del libro), recorta al contenido
y genera también una versión pequeña (256px) para el README.

Uso (python con Pillow):
  python tools/remove_bg.py [--tolerance 28] [--size 256]
"""
import argparse
import os
from collections import Counter, deque

from PIL import Image

ASSETS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets")


def color_dist(a, b) -> int:
    return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])


def remove_white_bg(img: Image.Image, tolerance: int) -> Image.Image:
    """Vuelve transparente el fondo que toca los bordes (flood fill).

    El color de referencia se estima como la moda de los píxeles del borde,
    así funciona con fondos blancos, crema o gris claro uniformes.
    """
    rgb = img.convert("RGB")
    w, h = rgb.size
    px = rgb.load()
    rgba = img.convert("RGBA")
    apx = rgba.load()

    border = Counter()
    for x in range(w):
        border[px[x, 0]] += 1
        border[px[x, h - 1]] += 1
    for y in range(h):
        border[px[0, y]] += 1
        border[px[w - 1, y]] += 1
    bg = border.most_common(1)[0][0]

    visited = [[False] * w for _ in range(h)]
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if not visited[y][x] and color_dist(px[x, y], bg) <= tolerance:
                visited[y][x] = True
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not visited[y][x] and color_dist(px[x, y], bg) <= tolerance:
                visited[y][x] = True
                q.append((x, y))

    while q:
        x, y = q.popleft()
        r, g, b, a = apx[x, y]
        apx[x, y] = (r, g, b, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx]:
                if color_dist(px[nx, ny], bg) <= tolerance:
                    visited[ny][nx] = True
                    q.append((nx, ny))
    return rgba


def trim(img: Image.Image, margin_ratio: float = 0.04) -> Image.Image:
    alpha = img.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        return img
    left, top, right, bottom = bbox
    mw = int((right - left) * margin_ratio)
    mh = int((bottom - top) * margin_ratio)
    left = max(0, left - mw)
    top = max(0, top - mh)
    right = min(img.width, right + mw)
    bottom = min(img.height, bottom + mh)
    return img.crop((left, top, right, bottom))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tolerance", type=int, default=28)
    ap.add_argument("--size", type=int, default=256)
    args = ap.parse_args()

    for fname in sorted(os.listdir(ASSETS)):
        if not fname.endswith("-raw.png"):
            continue
        src = os.path.join(ASSETS, fname)
        stem = fname[: -len("-raw.png")]
        img = Image.open(src)
        print(f"{fname}: {img.size}")
        transparent = trim(remove_white_bg(img, args.tolerance))
        out = os.path.join(ASSETS, f"{stem}.png")
        transparent.save(out)
        small = transparent.copy()
        small.thumbnail((args.size, args.size), Image.LANCZOS)
        small.save(os.path.join(ASSETS, f"{stem}-{args.size}.png"))
        print(f"  -> {stem}.png ({transparent.size}) + -{args.size}.png ({small.size})")


if __name__ == "__main__":
    main()
