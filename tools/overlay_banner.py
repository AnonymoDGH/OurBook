"""Superpone el texto de marca sobre el fondo del banner, en ES y EN.

Genera:
- social-preview.png (raiz): tarjeta social de GitHub 1280x640 (EN)
- assets/banner.png: banner en español (para el post de X en ES)
- assets/banner-en.png: banner en inglés (para el post de X en EN)

Uso (python con Pillow):
  python tools/overlay_banner.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1280, 640
FONT_DIR = r"C:\Windows\Fonts"

TEXTS = {
    "es": {
        "sub1": "La vida compartida entre el agente y tú",
        "sub2": "Un MCP de memoria narrativa: recuerdos · sueños · consolidación",
        "url": "github.com/AnonymoDGH/OurBook   ·   npm i ourbook",
    },
    "en": {
        "sub1": "The shared life between the agent and you",
        "sub2": "An MCP of narrative memory: memories · dreams · consolidation",
        "url": "github.com/AnonymoDGH/OurBook   ·   npm i ourbook",
    },
}


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    for c in [os.path.join(FONT_DIR, name), os.path.join(FONT_DIR, name.replace("b", "b."))]:
        if os.path.exists(c):
            try:
                return ImageFont.truetype(c, size)
            except Exception:
                continue
    return ImageFont.load_default()


def render(lang: str) -> Image.Image:
    src = Image.open(os.path.join(ROOT, "assets", "banner-bg.png")).convert("RGB")
    scale = max(W / src.width, H / src.height)
    resized = src.resize((round(src.width * scale), round(src.height * scale)), Image.LANCZOS)
    left = (resized.width - W) // 2
    top = (resized.height - H) // 2
    img = resized.crop((left, top, left + W, top + H)).convert("RGBA")

    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(overlay)
    for y in range(H):
        t = (y - H // 2) / (H / 2)
        if t > 0:
            dr.line([(0, y), (W, y)], fill=(8, 6, 22, int(150 * min(1, t))))
    base = Image.alpha_composite(img, overlay)

    draw = ImageDraw.Draw(base)
    t = TEXTS[lang]
    title = font("georgiab.ttf", 88) or font("georgia.ttf", 88)
    sub = font("arialbd.ttf", 34)
    url = font("arial.ttf", 26)

    def center(y: int, text: str, fnt, fill):
        bbox = draw.textbbox((0, 0), text, font=fnt)
        draw.text(((W - (bbox[2] - bbox[0])) / 2, y), text, font=fnt, fill=fill)

    center(170, "OurBook", title, (253, 232, 200, 255))
    center(300, t["sub1"], sub, (221, 214, 254, 255))
    center(368, t["sub2"], sub, (199, 191, 242, 255))
    center(500, t["url"], url, (143, 134, 201, 255))
    return base.convert("RGB")


def main() -> None:
    en = render("en")
    en.save(os.path.join(ROOT, "social-preview.png"))
    en.save(os.path.join(ROOT, "assets", "banner-en.png"))
    es = render("es")
    es.save(os.path.join(ROOT, "assets", "banner.png"))
    print("OK: social-preview.png (EN) · assets/banner-en.png (EN) · assets/banner.png (ES)")


if __name__ == "__main__":
    main()
