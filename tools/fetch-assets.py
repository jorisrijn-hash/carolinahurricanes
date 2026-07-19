#!/usr/bin/env python3
"""
fetch-assets.py - fills the photographic slots.

Run this on a machine with open network access. It reads data/assets.json,
downloads each source, crops to the slot's aspect ratio around its focal
point, and writes AVIF, WebP and JPEG at four widths with a matching
<picture> snippet.

    pip install pillow pillow-avif-plugin requests
    python3 tools/fetch-assets.py           # fetch everything ready to go
    python3 tools/fetch-assets.py --check   # report what is missing, fetch nothing

Provenance is enforced, not suggested: a slot with an empty licence or credit
is refused. That rule exists because the expensive mistake in sports websites
is not a slow image, it is an unlicensed one.
"""
import argparse
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, "data", "assets.json")


def load():
    with open(MANIFEST, encoding="utf-8") as fh:
        return json.load(fh)


def ready(slot):
    return all(slot.get(k) for k in ("source", "credit", "licence"))


def crop_to(img, w, h, focal):
    """Crop to the slot ratio around the focal point rather than the centre.
    Sports photography has the subject off centre far more often than not, and
    a centre crop is how you decapitate a goaltender."""
    from PIL import Image
    target = w / h
    iw, ih = img.size
    if iw / ih > target:
        nw = int(ih * target)
        cx = int(focal[0] * iw)
        left = max(0, min(cx - nw // 2, iw - nw))
        img = img.crop((left, 0, left + nw, ih))
    else:
        nh = int(iw / target)
        cy = int(focal[1] * ih)
        top = max(0, min(cy - nh // 2, ih - nh))
        img = img.crop((0, top, iw, top + nh))
    return img.resize((w, h), Image.LANCZOS)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="report only")
    args = ap.parse_args()

    data = load()
    slots = data["slots"]
    out = data["output"]

    todo = [s for s in slots if ready(s)]
    missing = [s for s in slots if not ready(s)]

    print("%d of %d slots have a source, credit and licence.\n" % (len(todo), len(slots)))
    if missing:
        print("Needs provenance before it can be fetched:")
        for s in missing:
            print("  %-14s %-9s %s" % (s["id"], s["kind"], s["note"]))
        print()

    if args.check or not todo:
        if not todo:
            print("Nothing to fetch. Fill data/assets.json first.")
        return 0

    try:
        import requests
        from PIL import Image
        try:
            import pillow_avif  # noqa: F401
            formats = out["formats"]
        except ImportError:
            formats = [f for f in out["formats"] if f != "avif"]
            print("pillow-avif-plugin not installed: skipping AVIF.\n")
    except ImportError as err:
        sys.exit("Missing dependency: %s\n  pip install pillow pillow-avif-plugin requests" % err)

    credits = []
    for slot in todo:
        dest = os.path.join(ROOT, slot["path"])
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        print("fetching %s" % slot["id"])
        resp = requests.get(slot["source"], timeout=30,
                            headers={"User-Agent": "canes-asset-pipeline/1.0"})
        resp.raise_for_status()

        from io import BytesIO
        img = Image.open(BytesIO(resp.content)).convert("RGB")
        base, _ = os.path.splitext(dest)

        for width in out["widths"]:
            if width > slot["width"]:
                continue
            height = round(width * slot["height"] / slot["width"])
            sized = crop_to(img, width, height, slot.get("focal", [0.5, 0.5]))
            for fmt in formats:
                path = "%s-%d.%s" % (base, width, fmt)
                sized.save(path, quality=out["quality"][fmt], optimize=True)
        credits.append({"id": slot["id"], "credit": slot["credit"], "licence": slot["licence"]})

    with open(os.path.join(ROOT, "assets", "CREDITS.json"), "w", encoding="utf-8") as fh:
        json.dump(credits, fh, indent=2)

    print("\nDone. %d slots written, credits in assets/CREDITS.json." % len(todo))
    print("\nMarkup for a slot:\n")
    print('  <picture>')
    print('    <source type="image/avif" srcset="PATH-1280.avif 1280w, PATH-1920.avif 1920w" sizes="100vw">')
    print('    <source type="image/webp" srcset="PATH-1280.webp 1280w, PATH-1920.webp 1920w" sizes="100vw">')
    print('    <img src="PATH-1280.jpg" alt="" width="W" height="H" loading="lazy" decoding="async">')
    print('  </picture>')
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
