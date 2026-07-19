#!/usr/bin/env python3
"""
build.py - assembles the static site from the data layer and shared partials.

Design rule: JSON in data/ is the single source of truth. Nothing that comes
from a feed is typed into a page body. Pages mark where a block goes with a
token; this file renders it. The schedule therefore cannot drift between the
homepage strip, the schedule table and the ticket browser, and swapping the
sample JSON for a live API response changes exactly one layer.

Output is plain static HTML: no runtime framework, no hydration, no client
routing. JavaScript only enhances what is already in the document.

    python3 build.py

Reads   data/*.json, src/partials/*.html, src/pages/**/*.html
Writes  ./<page>.html, ./es/<page>.html, data/search-index.json
"""

import html
import json
import os
import re
import sys
from datetime import date

ROOT = os.path.dirname(os.path.abspath(__file__))
PARTIALS = os.path.join(ROOT, "src", "partials")
PAGES = os.path.join(ROOT, "src", "pages")
DATA = os.path.join(ROOT, "data")

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def load(name):
    with open(os.path.join(DATA, name), encoding="utf-8") as fh:
        return json.load(fh)


def read(path):
    with open(path, encoding="utf-8") as fh:
        return fh.read()


TEAM = load("team.json")
SCHEDULE = load("schedule.json")
ROSTER = load("roster.json")
GAME = load("game.json")
TICKETS = load("tickets.json")

e = html.escape


def fmt_date(iso, long=False):
    y, m, d = (int(p) for p in iso.split("-"))
    dt = date(y, m, d)
    if long:
        return "%s %d %s %d" % (DAYS[dt.weekday()], d, MONTHS[m - 1], y)
    return "%s %d %s" % (DAYS[dt.weekday()], d, MONTHS[m - 1])


# ==========================================================================
# Renderers
# ==========================================================================

def r_game_strip():
    out = []
    for g in SCHEDULE["list"]:
        first, second = (g["opp"], "CAR") if g["home"] else ("CAR", g["opp"])
        tag = g["tag"] or ("Tickets" if g["home"] else "Away")
        out.append(
            '<a class="gamecell" href="game.html#%s">'
            '<div class="gamecell__teams">'
            '<span class="gamecell__abbr%s">%s</span>'
            '<span class="gamecell__at">at</span>'
            '<span class="gamecell__abbr%s">%s</span></div>'
            '<div class="gamecell__meta"><span class="mono">%s</span>'
            '<span class="mono">%s</span></div>'
            '<span class="badge">%s</span></a>' % (
                e(g["id"]),
                "" if first != "CAR" else " is-car", e(first),
                "" if second != "CAR" else " is-car", e(second),
                e(fmt_date(g["date"])), e(g["time"]), e(tag)))
    return "\n        ".join(out)


def r_schedule_rows():
    out = []
    for g in SCHEDULE["list"]:
        opp = g["oppName"] if g["home"] else "at " + g["oppName"]
        venue = TEAM["arena"]["name"] if g["home"] else "Away"
        tickets = ('<a class="link" href="tickets.html#%s">From $%d</a>'
                   % (e(g["id"]), g["price"])) if g["home"] else \
                  '<span class="mono">Away game</span>'
        out.append(
            '<tr data-venue="%s" data-opp="%s" data-id="%s">'
            '<td class="is-key">%s</td>'
            '<td>%s <span class="mono">%s</span></td>'
            '<td><span class="badge">%s</span></td>'
            '<td class="num">%s</td><td>%s</td><td>%s</td></tr>' % (
                "home" if g["home"] else "away", e(g["opp"]), e(g["id"]),
                e(fmt_date(g["date"])), e(opp), e(g["oppRecord"]),
                e(venue), e(g["time"]), e(g["broadcast"]), tickets))
    return "\n            ".join(out)


def r_ticket_games():
    """Ticket browsing starts from the opponent and the date, because that is
    how people decide. Price tier comes second."""
    out = []
    for g in SCHEDULE["list"]:
        if not g["home"]:
            continue
        demand = g.get("demand", "")
        badge = {"high": "Selling fast", "medium": "Good availability",
                 "low": "Best value"}.get(demand, "")
        promo = ('<p class="gcard__promo mono mono--amber">%s</p>' % e(g["promo"])) \
            if g["promo"] else ""
        out.append(
            '<article class="gcard" data-opp="%s" data-price="%d" data-demand="%s">'
            '<a class="card__hit" href="#seats" aria-label="Tickets for %s on %s"></a>'
            '<div class="gcard__head"><span class="mono">%s</span>'
            '<span class="badge">%s</span></div>'
            '<h3 class="gcard__opp">%s</h3>'
            '<p class="mono">%s &middot; %s</p>'
            '<div class="gcard__foot">'
            '<span><span class="mono">From</span>'
            '<b class="gcard__price num" data-price-base="%d">$%d</b></span>'
            '<span class="gcard__resale mono">Resale from $%d</span></div>%s</article>' % (
                e(g["opp"]), g["price"], e(demand),
                e(g["oppName"]), e(fmt_date(g["date"])),
                e(fmt_date(g["date"], True)), e(badge),
                e(g["oppName"]),
                e(g["time"] + " " + g["tz"]), e(TEAM["arena"]["name"]),
                g["price"], g["price"], g["resale"] or 0, promo))
    return "\n        ".join(out)


def _player_card(p, spotlight=False):
    name = "%s %s" % (p["first"], p["last"])
    stats = [("gp", "GP"), ("sv", "SV%"), ("gaa", "GAA")] if p["pos"] == "G" \
        else [("gp", "GP"), ("pts", "PTS"), ("plusMinus", "+/-")]
    meta = "%s &middot; %s" % (p["posLabel"], p.get("height", ""))
    cells = ""
    for key, label in stats:
        v = p.get(key)
        if key == "plusMinus" and isinstance(v, int):
            v = "+%d" % v if v > 0 else str(v)
        cells += ('<span><b class="num">%s</b>'
                  '<span class="mono mono--nano">%s</span></span>' % (e(str(v)), label))
    num = ('<span class="player__num" aria-hidden="true">%d</span>' % p["num"]) if p["num"] else ""
    # No licensed portrait yet: render a designed empty state rather than a
    # stand-in photograph. The initial and number carry the identity.
    if p.get("photo"):
        # AVIF first, WebP next, JPEG last. Three widths, sized so the
        # browser never downloads a 900px plate for a 220px card.
        b64 = e(p["photo"])
        media = ('<picture>'
                 '<source type="image/avif" srcset="%s-450.avif 450w, %s-900.avif 900w" sizes="(min-width:1100px) 22vw, 45vw">'
                 '<source type="image/webp" srcset="%s-450.webp 450w, %s-900.webp 900w" sizes="(min-width:1100px) 22vw, 45vw">'
                 '<img src="%s-900.jpg" alt="%s" width="900" height="1200" '
                 'loading="lazy" decoding="async"></picture>'
                 % (b64, b64, b64, b64, b64, e(name)))
        spec = ''
    else:
        media = ('<span class="player__empty" aria-hidden="true">'
                 '<span class="player__initial">%s</span></span>' % e(p["last"][0]))
        spec = ' data-nophoto'
    return ('<a class="player%s" href="roster.html#%s" data-pos="%s" '
            'data-player="%s" data-reveal%s>'
            '%s%s'
            '<span class="player__meta"><span class="mono">%s</span>'
            '<span class="player__name">%s<br>%s</span>'
            '<span class="player__stats">%s</span></span>'
            '<button class="player__fav" type="button" data-fav="%s" aria-pressed="false" '
            'aria-label="Follow %s"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">'
            '<path d="M8 1.5 10 6l4.5.4-3.4 3 1 4.4L8 11.5 3.9 13.8l1-4.4L1.5 6.4 6 6z"/>'
            '</svg></button></a>' % (
                "" if p.get("photo") else " player--empty",
                e(p["slug"]), e(p["pos"]), e(p["slug"]), spec, media, num,
                meta, e(p["first"]), e(p["last"]), cells,
                e(p["slug"]), e(name)))


def r_roster_cards():
    return "\n        ".join(_player_card(p) for p in ROSTER["players"])


def r_roster_spotlight():
    return "\n        ".join(_player_card(p, True) for p in ROSTER["players"][:4])


def r_shot_map():
    """Radius and opacity both encode expected goals, so a chance from the
    slot is visibly heavier than a point shot."""
    out = []
    for s in GAME["shots"]:
        r = 1.2 + s["xg"] * 7.5
        op = min(0.35 + s["xg"] * 2.2, 0.95)
        cls = "shot--car" if s["t"] == "CAR" else "shot--fla"
        out.append('<circle class="shot %s" cx="%s" cy="%s" r="%.2f" fill-opacity="%.2f" '
                   'data-xg="%.2f"><title>%s. Expected goals %.2f</title></circle>'
                   % (cls, s["x"], s["y"], r, op, s["xg"], e(s["r"]), s["xg"]))
    for g in GAME["goals"]:
        cls = "goal" if g["t"] == "CAR" else "goal goal--away"
        out.append('<g class="%s" transform="translate(%s,%s)">'
                   '<path d="M-3 -3 L3 3 M3 -3 L-3 3"/><title>%s</title></g>'
                   % (cls, g["x"], g["y"], e(g["r"])))
    return "\n            ".join(out)


def r_win_probability():
    pts = GAME["winProbability"]
    W, H = 600.0, 200.0
    maxm = float(max(p["m"] for p in pts)) or 1.0
    coords = [(p["m"] / maxm * W, H - (p["p"] / 100.0 * H)) for p in pts]
    line = "M" + " L".join("%.1f,%.1f" % c for c in coords)
    area = line + " L%.1f,%.1f L0,%.1f Z" % (W, H, H)
    return ('<path class="wp__area" d="%s"/>\n            '
            '<path class="wp__line" data-wp-line d="%s"/>' % (area, line))


def r_plays():
    out = []
    for p in GAME["plays"]:
        kind = p["type"]
        mark = "goal" if kind == "goal" else "pen"
        if kind == "goal" and p["team"] != TEAM["abbrev"]:
            mark = "away"
        clip = ('<button class="tl__clip" type="button" aria-label="Play clip: %s">Watch'
                '<svg viewBox="0 0 10 10" width="8" height="8" aria-hidden="true">'
                '<path d="M1 0 L9 5 L1 10 Z" fill="currentColor"/></svg></button>'
                % e(p["title"])) if p.get("clip") else ""
        out.append(
            '<li class="tl" data-period="%d" data-type="%s" data-reveal>'
            '<span class="tl__time mono num">%s &middot; %s</span>'
            '<span class="tl__mark tl__mark--%s" aria-hidden="true"></span>'
            '<div class="tl__body"><b>%s</b> <span class="badge">%s</span>'
            '<p class="mono">%s Score %s.</p>%s</div></li>' % (
                p["period"], e(kind),
                ["1st", "2nd", "3rd", "OT"][p["period"] - 1], e(p["time"]), mark,
                e(p["title"]), "Goal" if kind == "goal" else "Penalty",
                e(p["detail"]), e(p["score"]), clip))
    return "\n        ".join(out)


def r_edge_panel():
    ed = GAME["edge"]
    rows = ""
    for key, label in [("topSpeed", "Top skating speed"),
                       ("hardestShot", "Hardest shot"),
                       ("distanceSkated", "Distance skated")]:
        d = ed[key]
        rows += ('<div class="edge__row"><span class="mono">%s</span>'
                 '<b class="edge__val num">%s <small>%s</small></b>'
                 '<span class="mono">%s</span></div>'
                 % (label, d["value"], e(d["unit"]), e(d["player"])))
    z = ed["zoneTime"]
    rows += ('<div class="edge__row"><span class="mono">Offensive zone time</span>'
             '<b class="edge__val num">%s <small>%%</small></b>'
             '<span class="mono">Carolina, against %s%% Florida</span></div>'
             % (z["home"], z["away"]))
    return rows


def r_tier_buttons():
    return "\n            ".join(
        '<button class="chip" type="button" aria-pressed="%s" data-tier="%s">%s</button>'
        % ("true" if i == 0 else "false", e(t["key"]), e(t["label"]))
        for i, t in enumerate(TICKETS["tiers"]))


RENDER = {
    "game_strip": r_game_strip,
    "schedule_rows": r_schedule_rows,
    "ticket_games": r_ticket_games,
    "roster_cards": r_roster_cards,
    "roster_spotlight": r_roster_spotlight,
    "shot_map": r_shot_map,
    "win_probability": r_win_probability,
    "plays": r_plays,
    "edge_panel": r_edge_panel,
    "tier_buttons": r_tier_buttons,
    "record_w": lambda: str(TEAM["record"]["w"]),
    "record_l": lambda: str(TEAM["record"]["l"]),
    "record_otl": lambda: str(TEAM["record"]["otl"]),
    "record_pts": lambda: str(TEAM["record"]["pts"]),
    "home_count": lambda: str(sum(1 for g in SCHEDULE["list"] if g["home"])),
    "arena": lambda: TEAM["arena"]["name"],
    "roster_count": lambda: str(len(ROSTER["players"])),
    "count_f": lambda: str(sum(1 for p in ROSTER["players"] if p["pos"] == "F")),
    "count_d": lambda: str(sum(1 for p in ROSTER["players"] if p["pos"] == "D")),
    "count_g": lambda: str(sum(1 for p in ROSTER["players"] if p["pos"] == "G")),
}


# ==========================================================================
# Localisation
#
# Exact string replacement over the assembled chrome. A stopgap that suits a
# fixed set of navigation labels; move to a key based catalogue before the
# translated copy grows past the chrome.
# ==========================================================================
ES = {
    ">Team<": ">Equipo<", ">News<": ">Noticias<", ">Schedule<": ">Calendario<",
    ">Roster<": ">Plantilla<", ">Game center<": ">Centro de partido<",
    ">Fans<": ">Aficionados<", ">Shop<": ">Tienda<", ">Tickets<": ">Entradas<",
    "Skip to main content": "Saltar al contenido principal",
    "Open menu": "Abrir menu",
    "2026 STANLEY CUP CHAMPIONS": "CAMPEONES DE LA STANLEY CUP 2026",
    "Privacy policy": "Politica de privacidad",
    "Terms of service": "Terminos del servicio",
    "Cookie settings": "Preferencias de cookies",
    ">Accessibility<": ">Accesibilidad<",
    ">Gameday<": ">Dia de partido<",
    "Search the site": "Buscar en el sitio",
    "Settings": "Ajustes",
}


def localise(markup, lang):
    if lang != "es":
        return markup
    for src, dst in ES.items():
        markup = markup.replace(src, dst)
    return markup


# ==========================================================================
# Assembly
# ==========================================================================

def parse_meta(body):
    meta = {}
    match = re.match(r"\s*<!--meta(.*?)-->", body, re.S)
    if match:
        for line in match.group(1).strip().splitlines():
            if ":" in line:
                key, value = line.split(":", 1)
                meta[key.strip()] = value.strip()
        body = body[match.end():]
    return meta, body.strip()


def expand(markup):
    """Unknown tokens are left in place and reported, so a typo is loud."""
    missing = []

    def sub(match):
        key = match.group(1)
        if key in RENDER:
            return RENDER[key]()
        missing.append(key)
        return match.group(0)

    return re.sub(r"\{\{(\w+)\}\}", sub, markup), missing


def mark_current(nav_html, key, prefix):
    if not key:
        return nav_html
    target = 'href="%s.html"' % key
    return nav_html.replace('class="nav__link" ' + target,
                            'class="nav__link" ' + target + ' aria-current="page"')


def strip_tags(markup):
    markup = re.sub(r"<(script|style|svg)[^>]*>.*?</\1>", " ", markup, flags=re.S)
    markup = re.sub(r"<[^>]+>", " ", markup)
    return re.sub(r"\s+", " ", html.unescape(markup)).strip()


def build():
    head = read(os.path.join(PARTIALS, "head.html"))
    chrome = read(os.path.join(PARTIALS, "chrome.html"))
    foot = read(os.path.join(PARTIALS, "foot.html"))

    sources = []
    for dirpath, _, names in os.walk(PAGES):
        for name in sorted(names):
            if name.endswith(".html"):
                sources.append(os.path.join(dirpath, name))

    index, built, problems = [], [], []

    for path in sorted(sources):
        rel = os.path.relpath(path, PAGES)
        meta, body = parse_meta(read(path))
        lang = meta.get("lang", "en")
        depth = rel.count(os.sep)
        prefix = "../" * depth

        body, missing = expand(body)
        if missing:
            problems.append((rel, missing))

        page_head = (head
                     .replace("{{title}}", meta.get("title", TEAM["name"]))
                     .replace("{{description}}", meta.get("description", ""))
                     .replace("{{lang}}", lang)
                     .replace("{{base}}", prefix)
                     .replace("{{canonical}}", rel.replace(os.sep, "/"))
                     .replace("{{jsonld}}", meta.get("jsonld", "")))

        extra = "".join('\n<script src="%s" defer></script>' % s.strip()
                        for s in filter(None, (x.strip() for x in meta.get("scripts", "").split(","))))

        page_chrome = localise(mark_current(chrome, meta.get("nav", ""), prefix), lang)
        page_foot = localise(foot, lang).replace(
            '<script src="js/dev.js" defer></script>',
            '<script src="js/dev.js" defer></script>' + extra)

        markup = (page_head + "<body>\n" + page_chrome +
                  '<div class="page">\n' + body + "\n\n" + page_foot)

        # Rewrite relative asset paths for pages that sit in a subdirectory.
        if prefix:
            markup = re.sub(r'((?:href|src)=")(?!https?:|#|mailto:|/|\.\./)',
                            r"\1" + prefix, markup)

        out_path = os.path.join(ROOT, rel)
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as fh:
            fh.write(markup)

        built.append((rel, len(markup)))
        index.append({
            "url": rel.replace(os.sep, "/"),
            "title": meta.get("title", "").split(" | ")[0],
            "lang": lang,
            "section": meta.get("section", "Page"),
            "text": strip_tags(body)[:1400],
        })

    with open(os.path.join(DATA, "search-index.json"), "w", encoding="utf-8") as fh:
        json.dump(index, fh, separators=(",", ":"))

    width = max(len(n) for n, _ in built)
    for name, size in built:
        print("  %-*s  %6.1f KB" % (width, name, size / 1024))
    print("\n%d pages, search index %d entries." % (len(built), len(index)))
    for rel, missing in problems:
        print("  UNRESOLVED in %s: %s" % (rel, ", ".join(sorted(set(missing)))))
    return 1 if problems else 0


if __name__ == "__main__":
    if not os.path.isdir(PAGES):
        sys.exit("src/pages not found. Run from the project root.")
    raise SystemExit(build())
