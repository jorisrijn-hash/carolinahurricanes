#!/usr/bin/env python3
"""
contrast.py - WCAG 2.1 contrast audit of the token palette.

Checks every text/background pair the design actually uses. A pair that
fails is a bug, not a judgement call: run this before shipping a palette
change.

    python3 tools/contrast.py
"""

TOKENS = {
    "void": "#08090A", "pitch": "#0C0E10", "iron": "#141719",
    "graphite": "#1C2024", "steel": "#2B3037", "gunmetal": "#3A4149",
    "bone": "#E9E7E4", "nickel": "#A2AAAD", "ash": "#8A9198", "pure": "#FFFFFF",
    "red": "#CC0000", "red-hot": "#FF2233", "advisory": "#FFB000",
}

# (foreground, background, role, large_text)
PAIRS = [
    ("bone", "void", "body text", False),
    ("bone", "iron", "body text on panel", False),
    ("bone", "graphite", "body text on inset", False),
    ("nickel", "void", "lede and secondary copy", False),
    ("nickel", "iron", "secondary copy on panel", False),
    ("ash", "void", "mono labels", False),
    ("ash", "iron", "mono labels on panel", False),
    ("pure", "void", "display headlines", True),
    ("pure", "red", "button label on red", False),
    ("red-hot", "void", "live state and accents", False),
    ("red-hot", "iron", "accents on panel", False),
    ("advisory", "void", "advisory badges", False),
    ("advisory", "iron", "advisory on panel", False),
    ("pure", "iron", "table key cells", False),
]


def luminance(hex_colour):
    r, g, b = (int(hex_colour[i:i + 2], 16) / 255 for i in (1, 3, 5))
    def channel(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = channel(r), channel(g), channel(b)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(fg, bg):
    a, b = luminance(fg), luminance(bg)
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)


def main():
    failures = 0
    print("%-34s %-8s %-6s %s" % ("PAIR", "RATIO", "NEEDS", "RESULT"))
    print("-" * 62)
    for fg, bg, role, large in PAIRS:
        r = ratio(TOKENS[fg], TOKENS[bg])
        need = 3.0 if large else 4.5
        ok = r >= need
        failures += 0 if ok else 1
        print("%-34s %-8.2f %-6.1f %s" % (
            "%s on %s" % (fg, bg), r, need, "PASS" if ok else "FAIL  <- %s" % role))
    print("-" * 62)
    print("%d pair(s) failing WCAG AA." % failures)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
