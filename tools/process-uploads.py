#!/usr/bin/env python3
"""
process-uploads.py - turns the supplied photography into site assets.

Headshots are transparent cutouts, so they are composited onto a branded
plate rather than dropped on grey. Action photography is cropped around a
focal point per slot, not centred, and written as AVIF, WebP and JPEG at
three widths.

    python3 tools/process-uploads.py /path/to/players /path/to/ringside
"""
import io, json, os, sys
import numpy as np
from PIL import Image, ImageFilter, ImageDraw
import pillow_avif  # noqa: F401

SRC_PLAYERS = sys.argv[1] if len(sys.argv) > 1 else "/home/claude/incoming/players_raw/images"
SRC_RING = sys.argv[2] if len(sys.argv) > 2 else "/home/claude/incoming/ringside_raw/ringside images"
OUT = "assets/img"
WIDTHS = [640, 1280, 1920]
Q = {"avif": 52, "webp": 74, "jpg": 84}


def write_set(img, base, widths=WIDTHS, ratio=None):
    """Write every format and width for one slot. Returns total bytes.

    Sources smaller than the smallest breakpoint still get one output at
    their native width. Silently emitting nothing is how a slot ends up
    blank on the page with no error anywhere."""
    usable = [w for w in widths if w <= img.width]
    if not usable:
        usable = [img.width]
    total = 0
    for w in usable:
        h = round(w * img.height / img.width) if not ratio else round(w / ratio)
        sized = img.resize((w, h), Image.LANCZOS)
        for fmt in ("avif", "webp", "jpg"):
            path = "%s-%d.%s" % (base, w, fmt)
            out = sized.convert("RGB")
            out.save(path, quality=Q[fmt], optimize=True)
            total += os.path.getsize(path)
    return total


def focal_crop(img, ratio, fx=0.5, fy=0.42):
    """Crop to ratio around a focal point. Sports subjects are rarely centred
    and a centre crop is how you decapitate a goaltender."""
    iw, ih = img.size
    if iw / ih > ratio:
        nw = int(ih * ratio)
        left = max(0, min(int(fx * iw) - nw // 2, iw - nw))
        return img.crop((left, 0, left + nw, ih))
    nh = int(iw / ratio)
    top = max(0, min(int(fy * ih) - nh // 2, ih - nh))
    return img.crop((0, top, iw, top + nh))


# ==========================================================================
# 1. Player headshots
#    336px transparent cutouts on a 3:4 branded plate. The plate is drawn
#    here rather than in CSS so the card needs one request, not two.
# ==========================================================================
def plate(size=(900, 1200), accent=(204, 0, 0)):
    w, h = size
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    nx, ny = xx / w, yy / h
    d = np.sqrt(((nx - 0.5) * 1.15) ** 2 + ((ny - 0.30) * 0.95) ** 2)
    bloom = np.clip(1 - d / 0.92, 0, 1) ** 2.1
    base = np.array([16, 20, 24], float)[None, None, :]
    img = base + np.array([46, 62, 78], float)[None, None, :] * bloom[..., None] * 0.85
    img += np.array(accent, float)[None, None, :] * (bloom[..., None] ** 2.4) * 0.30
    img += np.random.normal(0, 3.5, (h, w, 3))
    p = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    # ice scoring under the subject
    ice = Image.open(os.path.join(OUT, "ice-tile.png")).convert("RGBA").resize((w, w))
    p.paste(ice, (0, h - w), ice)
    return p


roster_photos = {}
if os.path.isdir(SRC_PLAYERS):
    os.makedirs(os.path.join(OUT, "players"), exist_ok=True)
    ids = [f for f in sorted(os.listdir(SRC_PLAYERS)) if f.endswith(".png") and f[0].isdigit()]
    for name in ids:
        pid = name[:-4]
        cut = Image.open(os.path.join(SRC_PLAYERS, name)).convert("RGBA")
        card = plate()
        # Headshots are shoulders-up: seat them low so the crop reads as a
        # portrait rather than a floating head.
        target_w = int(card.width * 1.02)
        scaled = cut.resize((target_w, target_w), Image.LANCZOS)
        card.paste(scaled, ((card.width - target_w) // 2, card.height - target_w + 40), scaled)
        # bottom scrim so the name always clears contrast
        scrim = Image.new("RGBA", card.size, (0, 0, 0, 0))
        ImageDraw.Draw(scrim).rectangle([0, int(card.height * 0.62), card.width, card.height],
                                        fill=(8, 9, 10, 0))
        grad = np.linspace(0, 235, int(card.height * 0.38)).astype(np.uint8)
        gradimg = Image.fromarray(np.tile(grad[:, None], (1, card.width)), "L")
        black = Image.new("RGB", (card.width, gradimg.height), (8, 9, 10))
        card.paste(black, (0, card.height - gradimg.height), gradimg)
        base = os.path.join(OUT, "players", pid)
        write_set(card, base, widths=[450, 900])
        roster_photos[pid] = "assets/img/players/%s" % pid
    print("headshots processed: %d" % len(roster_photos))

# ==========================================================================
# 2. Action and arena photography
#    ratio and focal point chosen per image from what is actually in frame.
# ==========================================================================
SLOTS = [
    # file, output, ratio, fx, fy, credit
    ("6a2c06f5063c41.36488197.webp", "photo/hero-celebration", 16 / 9, 0.46, 0.44,
     "Carolina Hurricanes celebration, supplied"),
    ("USATSI_25913189.webp", "photo/celebration-team", 16 / 9, 0.48, 0.40,
     "USA TODAY Sports Images (USATSI_25913189)"),
    ("imagn-27161333.webp", "photo/player-action", 3 / 2, 0.50, 0.38,
     "Imagn Images (imagn-27161333)"),
    ("images (2).jpeg", "photo/net-scramble", 16 / 9, 0.52, 0.48,
     "Supplied, provenance unknown"),
    ("images (3).jpeg", "photo/arena-bowl", 4 / 3, 0.50, 0.50,
     "Supplied, provenance unknown"),
    ("images (1).jpeg", "photo/celebration-glass", 16 / 10, 0.50, 0.46,
     "Supplied, provenance unknown"),
    ("images.jpeg", "photo/portrait-smile", 4 / 3, 0.46, 0.40,
     "Supplied, provenance unknown"),
    ("Hurricanes-768x432.jpg", "photo/boards-celebration", 16 / 9, 0.55, 0.45,
     "Supplied, provenance unknown"),
    ("66984acd57b094.00492242.webp", "photo/dejection", 16 / 9, 0.34, 0.42,
     "Supplied, provenance unknown"),
]

credits = []
if os.path.isdir(SRC_RING):
    os.makedirs(os.path.join(OUT, "photo"), exist_ok=True)
    total = 0
    for fname, out_name, ratio, fx, fy, credit in SLOTS:
        path = os.path.join(SRC_RING, fname)
        if not os.path.exists(path):
            print("  missing: %s" % fname)
            continue
        img = Image.open(path).convert("RGB")
        cropped = focal_crop(img, ratio, fx, fy)
        base = os.path.join(OUT, out_name)
        total += write_set(cropped, base)
        credits.append({"asset": out_name, "source_file": fname, "credit": credit,
                        "licence": "UNVERIFIED - confirm before publication"})
    print("photography processed: %d slots, %.0f KB" % (len(credits), total / 1024))

os.makedirs("assets", exist_ok=True)
with open("assets/CREDITS.json", "w", encoding="utf-8") as fh:
    json.dump({"_warning": "Every entry below needs its licence confirmed before publication.",
               "photography": credits,
               "headshots": {"source": "Official NHL player headshots supplied by the client",
                             "licence": "UNVERIFIED - NHL/NHLI rights required"}}, fh, indent=2)

with open("/tmp/roster_photos.json", "w") as fh:
    json.dump(roster_photos, fh)
print("credits written to assets/CREDITS.json")
