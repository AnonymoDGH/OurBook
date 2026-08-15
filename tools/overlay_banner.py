"""Superpone el texto de marca sobre el fondo del banner y genera:
- social-preview.png en la raíz del repo (tarjeta social de GitHub, 1280x640)
- assets/banner.png (para adjuntar en posts de X/LinkedIn)

Uso (python con Pillow):
  python tools/overlay_banner.py
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1280, 640

FONT_DIR = r"C:\Windows\Fonts"


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    candidates = [os.path.join(FONT_DIR, name), os.path.join(FONT_DIR, name.replace("b", "b."))]
    for c in candidates:
        if os.path.exists(c):
            try:
                return ImageFont.truetype(c, size)
            except Exception:
                continue
    return ImageFont.load_default()


def main() -> None:
    src = Image.open(os.path.join(ROOT, "assets", "banner-bg.png")).convert("RGB")
    # recorte cover a 1280x640
    scale = max(W / src.width, H / src.height)
    resized = src.resize((round(src.width * scale), round(src.height * scale)), Image.LANCZOS)
    left = (resized.width - W) // 2
    top = (resized.height - H) // 2
    img = resized.crop((left, top, left + W, top + H))

    # velo oscuro en la franja inferior para legibilidad
    overlay = Image.new("RGBA", (W, H), (10, 8, 25, 0))
    dr = ImageDraw.Draw(overlay)
    for y in range(H):
        t = (y - H // 2) / (H / 2)
        if t > 0:
            dr.line([(0, y), (W, y)], fill=(8, 6, 22, int(150 * min(1, t))))
    img = Image.composite(overlay, Image.new("RGBA", (W, H)), overlay).convert("RGB")
    # en su lugar: paste directo
    base = Image.new("RGBA", (W, H))
    base.paste(img, (0, 0))
    base = Image.alpha_composite(base, overlay)

    draw = ImageDraw.Draw(base)
    title = font("georgiab.ttf", 88) or font("georgia.ttf", 88)
    sub = font("arialbd.ttf", 34)
    url = font("arial.ttf", 26)

    def center_text(y: int, text: str, fnt, fill):
        bbox = draw.textbbox((0, 0), text, font=fnt)
        w = bbox[2] - bbox[0]
        draw.text(((W - w) / 2, y), text, font=fnt, fill=fill)

    center_text(170, "OurBook", title, (253, 232, 200, 255))
    center_text(300, "La vida compartida entre el agente y tú", sub, (221, 214, 254, 255))
    center_text(368, "Un MCP de memoria narrativa: recuerdos · sueños · consolidación", sub, (199, 191, 242, 255))
    center_text(500, "github.com/AnonymoDGH/OurBook   ·   npm i ourbook", url, (143, 134, 201, 255))

    base.convert("RGB").save(os.path.join(ROOT, "social-preview.png"))
    base.convert("RGB").save(os.path.join(ROOT, "assets", "banner.png"))
    print("social-preview.png y assets/banner.png generados (1280x640)")


if __name__ == "__main__":
    main()
