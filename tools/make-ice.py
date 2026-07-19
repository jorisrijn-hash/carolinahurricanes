#!/usr/bin/env python3
"""
make-ice.py - generates the hockey surface artwork.

These are not photographs and are never presented as such. They are the
material the sport is played on, drawn procedurally: ice scored by skate
edges, dasher boards with a kickplate, rink geometry, arena light rigs.

Photography slots are filled by tools/fetch-assets.py. This file handles the
textures, which are better generated than photographed anyway because they
need to tile, stay dark enough for white type, and carry no licence.

    python3 tools/make-ice.py
"""
import math, os, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops

random.seed(11); np.random.seed(11)
OUT = "assets/img"
SS = 2  # supersample factor: skate marks are 1px lines, they need it

ICE_DARK  = (10, 15, 21)
ICE_MID   = (26, 37, 48)
ICE_LIGHT = (74, 104, 130)
SCORE     = (150, 186, 212)   # skate mark colour
RED       = (204, 0, 0)


def base_ice(w, h, light_x=0.5, light_y=0.3, warmth=0.0):
    """Cold gradient with an overhead rig pooling light on the surface."""
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    nx, ny = xx / w, yy / h
    d = np.sqrt(((nx - light_x) * 1.5) ** 2 + ((ny - light_y) * 1.1) ** 2)
    bloom = np.clip(1 - d / 1.05, 0, 1) ** 2.4
    # a second, weaker rig keeps the surface from looking like one spotlight
    d2 = np.sqrt(((nx - (1 - light_x)) * 1.7) ** 2 + ((ny - 0.75) * 1.3) ** 2)
    bloom += np.clip(1 - d2 / 1.1, 0, 1) ** 3.0 * 0.45
    bloom = np.clip(bloom, 0, 1.3)

    a = np.array(ICE_DARK, float)[None, None, :]
    b = np.array(ICE_MID, float)[None, None, :]
    c = np.array(ICE_LIGHT, float)[None, None, :]
    img = a + (b - a) * ny[..., None] * 0.9
    img = img + (c - a) * bloom[..., None] * 0.85
    if warmth:
        img += np.array(RED, float)[None, None, :] * (bloom[..., None] ** 2) * warmth
    return img


def skate_marks(w, h, count=520, curve=True, heavy=0.18):
    """Skate marks are arcs, not scratches: an edge carves a radius. Long
    shallow arcs from strides, tight ones from turns, plus a few deep gouges
    where someone stopped hard."""
    layer = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(layer)
    for i in range(count):
        cx = random.uniform(-w * 0.3, w * 1.3)
        cy = random.uniform(-h * 0.3, h * 1.3)
        r = random.uniform(w * 0.05, w * 0.9) if curve else w * 4
        start = random.uniform(0, 360)
        span = random.uniform(6, 46)
        wide = random.random() < heavy
        width = random.choice([SS, SS, SS * 2]) if wide else SS
        val = random.randint(70, 150) if wide else random.randint(24, 74)
        box = [cx - r, cy - r, cx + r, cy + r]
        try:
            d.arc(box, start, start + span, fill=val, width=width)
        except Exception:
            pass
    return layer.filter(ImageFilter.GaussianBlur(SS * 0.3))


def snow(w, h, count=260):
    """Shavings are fine and soft. Drawn on their own layer and blurred hard,
    because at full opacity they read as grey lily pads rather than snow."""
    layer = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(layer)
    for i in range(count):
        cx, cy = random.uniform(0, w), random.uniform(0, h)
        rr = random.uniform(w * 0.0015, w * 0.010)
        d.ellipse([cx - rr, cy - rr * 0.38, cx + rr, cy + rr * 0.38],
                  fill=random.randint(30, 90))
    return layer.filter(ImageFilter.GaussianBlur(SS * 3.2))


def compose(w, h, marks_count=520, light=(0.5, 0.3), warmth=0.0, grain=6):
    W, H = w * SS, h * SS
    arr = base_ice(W, H, light[0], light[1], warmth)
    marks = np.array(skate_marks(W, H, marks_count), float)[..., None] / 255.0
    arr = arr + (np.array(SCORE, float)[None, None, :] - arr) * marks * 0.78
    dust = np.array(snow(W, H), float)[..., None] / 255.0
    arr = arr + (np.array((210, 228, 240), float)[None, None, :] - arr) * dust * 0.30
    arr += np.random.normal(0, grain, (H, W, 3))
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    return img.resize((w, h), Image.LANCZOS)


def save(img, name, quality=84):
    path = os.path.join(OUT, name)
    if name.endswith(".png"):
        img.save(path, optimize=True)
    else:
        img.convert("RGB").save(path, quality=quality, optimize=True, progressive=True)
    return os.path.getsize(path)


# ---------------------------------------------------------------- hero ice
hero = compose(1920, 1080, 1150, (0.62, 0.24), warmth=0.18, grain=5)
save(hero, "ice-hero.jpg")

# ------------------------------------------------- tileable scoring overlay
# Used as a background layer on sections. Transparent PNG so it sits over
# any panel colour without a second image request per section.
W = 512 * SS
tile = skate_marks(W, W, 260, heavy=0.1)
tile = ImageChops.offset(tile, W // 2, W // 2)          # wrap the seam
tile2 = skate_marks(W, W, 120, heavy=0.06)
tile = ImageChops.lighter(tile, tile2)
rgba = Image.new("RGBA", (W, W), (150, 186, 212, 0))
rgba.putalpha(tile.point(lambda v: int(v * 0.5)))
save(rgba.resize((512, 512), Image.LANCZOS), "ice-tile.png")

# ------------------------------------------------------------ rink overhead
def rink(w=1600, h=900):
    ice = compose(w, h, 900, (0.5, 0.42), grain=4)
    d = ImageDraw.Draw(ice, "RGBA")
    # rink is 200x85ft; fit it with margin
    pad = int(w * 0.04)
    rw = w - pad * 2
    rh = int(rw * 85 / 200)
    top = (h - rh) // 2
    sx = lambda ft: pad + ft / 200 * rw
    sy = lambda ft: top + ft / 85 * rh
    lw = max(2, int(rw / 400))
    blue = (47, 93, 140, 235)
    red = (150, 30, 38, 235)
    d.rounded_rectangle([pad, top, pad + rw, top + rh], radius=int(rh * 0.33),
                        outline=(210, 224, 232, 200), width=lw)
    for ft, col, width in [(75, blue, lw * 4), (125, blue, lw * 4), (100, red, lw * 2)]:
        d.line([sx(ft), sy(0.5), sx(ft), sy(84.5)], fill=col, width=width)
    for ft in (11, 189):
        d.line([sx(ft), sy(5), sx(ft), sy(80)], fill=red, width=lw)
    r = (15 / 85) * rh
    for cx, cy in [(100, 42.5), (31, 20.5), (31, 64.5), (169, 20.5), (169, 64.5)]:
        d.ellipse([sx(cx) - r, sy(cy) - r, sx(cx) + r, sy(cy) + r],
                  outline=red if cx == 100 else blue, width=lw)
        d.ellipse([sx(cx) - lw * 2, sy(cy) - lw * 2, sx(cx) + lw * 2, sy(cy) + lw * 2], fill=red)
    cr = (6 / 85) * rh
    for ft, a0, a1 in ((11, 270, 90), (189, 90, 270)):
        d.pieslice([sx(ft) - cr, sy(42.5) - cr, sx(ft) + cr, sy(42.5) + cr],
                   a0, a1, fill=(47, 93, 140, 95), outline=blue, width=lw)
    return ice
save(rink(), "rink-overhead.jpg")

# ------------------------------------------------------------- dasher boards
def boards(w=1600, h=900):
    img = Image.new("RGB", (w, h), (16, 20, 24))
    d = ImageDraw.Draw(img, "RGBA")
    glass_h = int(h * 0.52)
    kick_y = int(h * 0.80)
    # white boards
    d.rectangle([0, glass_h, w, kick_y], fill=(206, 212, 216))
    # yellow kickplate: the single most recognisable line in the sport
    d.rectangle([0, kick_y, w, h], fill=(214, 176, 32))
    # glass: dark, with vertical stanchions and a cold sheen
    for i in range(0, w, w // 7):
        d.rectangle([i - 3, 0, i + 3, glass_h], fill=(30, 38, 46))
    for i in range(60):
        x = random.uniform(0, w)
        d.line([x, 0, x + random.uniform(-40, 40), glass_h],
               fill=(90, 120, 145, random.randint(6, 22)), width=random.randint(1, 3))
    # puck scuffs on the boards and kickplate
    for i in range(150):
        x = random.uniform(0, w); y = random.uniform(glass_h + 6, h - 6)
        rr = random.uniform(2, 13); sq = random.uniform(0.25, 0.75)
        d.ellipse([x - rr, y - rr * sq, x + rr, y + rr * sq],
                  fill=(24, 24, 26, random.randint(30, 130)))
    # ice strip at the foot
    ice = compose(w, h - kick_y + 2, 120, (0.5, 0.2), grain=3)
    img.paste(ice.crop((0, 0, w, h - kick_y)), (0, kick_y))
    d2 = ImageDraw.Draw(img, "RGBA")
    d2.rectangle([0, kick_y - int(h * 0.06), w, kick_y], fill=(214, 176, 32))
    d2.line([0, glass_h, w, glass_h], fill=(120, 132, 140), width=3)
    return img.filter(ImageFilter.GaussianBlur(0.4))
save(boards(), "boards.jpg")

# --------------------------------------------------------------- arena bowl
def bowl(w=1920, h=1080):
    arr = base_ice(w, h, 0.5, 0.86, warmth=0.05) * 0.45
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(img, "RGBA")
    # rig trusses
    for i in range(7):
        x = w * (i + 0.5) / 7
        d.ellipse([x - 130, -90, x + 130, 120], fill=(120, 150, 175, 26))
        d.ellipse([x - 46, -30, x + 46, 60], fill=(200, 222, 238, 60))
    # crowd: dark mass with sparse phone lights and red glow
    for i in range(2600):
        x = random.uniform(0, w); y = random.uniform(h * 0.30, h * 0.72)
        rr = random.uniform(1.2, 4.0)
        v = random.randint(18, 54)
        col = (v, v + 4, v + 10, random.randint(40, 120))
        if random.random() < 0.03:
            col = (255, 236, 190, random.randint(90, 190))
        elif random.random() < 0.05:
            col = (204, 20, 30, random.randint(60, 140))
        d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=col)
    ice = compose(w, int(h * 0.30), 340, (0.5, 0.1), grain=4)
    img.paste(ice, (0, int(h * 0.72)))
    return img.filter(ImageFilter.GaussianBlur(0.5))
save(bowl(), "arena-bowl.jpg")

# ------------------------------------------------------------------ the net
def net(w=1200, h=800):
    img = compose(w, h, 380, (0.5, 0.34), warmth=0.1)
    d = ImageDraw.Draw(img, "RGBA")
    # crease
    d.pieslice([w * 0.18, h * 0.30, w * 0.82, h * 1.04], 180, 360,
               fill=(47, 93, 140, 70), outline=(90, 140, 190, 200), width=4)
    # posts
    px1, px2, py, ph = w * 0.30, w * 0.70, h * 0.62, h * 0.30
    d.rectangle([px1 - 7, py - ph, px1 + 7, py], fill=(190, 30, 34))
    d.rectangle([px2 - 7, py - ph, px2 + 7, py], fill=(190, 30, 34))
    d.rectangle([px1 - 7, py - ph - 7, px2 + 7, py - ph + 7], fill=(190, 30, 34))
    # mesh
    for x in range(int(px1), int(px2), 16):
        d.line([x, py - ph, x + 12, py], fill=(228, 232, 236, 70), width=1)
    for y in range(int(py - ph), int(py), 14):
        d.line([px1, y, px2, y], fill=(228, 232, 236, 55), width=1)
    return img.filter(ImageFilter.GaussianBlur(0.4))
save(net(), "net.jpg")

print("surface artwork:")
for f in sorted(os.listdir(OUT)):
    if f.startswith(("ice-", "rink-", "boards", "arena-bowl", "net")):
        print("  %-22s %6.0f KB" % (f, os.path.getsize(os.path.join(OUT, f)) / 1024))
