# Carolina Hurricanes — redesign concept

A complete rebuild of the Carolina Hurricanes site, produced from the saved
production HTML of `nhl.com/hurricanes`. Fourteen pages in two languages, no
framework, no build dependencies beyond Python 3 for the page assembler.

**This is an unaffiliated concept.** See `NOTICE.md` before showing it to
anyone.

---

## 1. What was wrong with the original

Measured programmatically against the 4.4 MB saved page, not eyeballed.

| Finding | Original | Rebuild |
| --- | --- | --- |
| `<h1>` elements on the homepage | 0 | 1 per page |
| Images missing `alt` | 17 of 60 | 0 |
| Images with explicit `width`/`height` | 3 of 60 | all |
| Images lazy loaded | 0 | all below the fold |
| Buttons with no accessible name | 11 | 0 |
| Inline `<script>` blocks | 19 | 0 |
| Ad iframes | 12 | 0 |
| Display typeface | Inter / Roboto | Big Shoulders Display |
| `theme-color` | `#ffffff` | `#08090A` |

Re-run the comparison at any time:

```bash
python3 -m http.server 8899      # from the project root
python3 tools/audit.py           # accessibility regressions
python3 tools/contrast.py        # WCAG AA on the palette
```

Beyond the measurable defects, the homepage was a flat stack of equally
weighted carousels. A Stanley Cup win, the season record and the home opener
all competed at the same visual level, so none of them landed.

---

## 2. What changed in the product pass

The first build was a good looking homepage. It was not a product. This pass
reorganised it around the two jobs the site actually has: sell tickets, and
be useful on a gameday.

**Cut, on purpose.** The cursor reticle is gone; it helped nobody and cost a
frame loop. The boot sequence no longer runs by default, because a fan
checking a score at 22:40 should not wait for a film. It is retained as a
campaign asset behind `data-boot-enabled` on `<html>` or `?intro=1`. The
instrument rail survived by becoming section navigation instead of
decoration. The radar was promoted from a one-off hero flourish to the
permanent inbound-opponent widget.

**A data layer.** `data/*.json` is now the single source of truth and
`build.py` renders markup from it. The schedule cannot drift between the
homepage strip, the schedule table and the ticket browser, because there is
only one copy of it.

**Ticketing rebuilt around the fan's decision order.** People choose an
opponent and a date, then a price; the old flow asked for a price tier
first, which is the club's mental model. All-in pricing is on by default and
toggleable. Resale sits beside primary inventory on every game. Seat views
per tier. The membership calculator shows the plan losing when the plan
loses, because a calculator that always recommends the upsell is not a
calculator.

**Gameday.** A service worker keeps the shell and the ticket wallet
available with no connection, which is the realistic state of arena wifi at
18,700 people. Live data is network-first and the score feed is never
cached, because a stale score is worse than no score. A site-wide live bar
carries the score on every page. Goal alerts use a real permission flow that
never prompts on load.

**Data saver.** One class on `<html>` that stops every canvas, drops
decorative imagery and shortens transitions. Nothing meaningful is hidden:
shot maps, charts and crests stay. It is applied inline before first paint
so the page never flashes heavy imagery first.

**Search.** Client side, over an index generated at build time, fetched
lazily on first open. Opens with `/`.

**Spanish.** `hreflang` on every page, a switcher in settings and the
footer, and translated chrome plus the two highest-value pages. The rest is
honestly marked as pending rather than machine translated.

**New surfaces.** Storm Tracker solves the offseason, the problem the
original site did not have an answer for. My Canes holds the wallet, saved
games and followed players. Accessibility is a real page with a known-gaps
section rather than a PDF.

---

## 3. Design direction

The primary mark is a satellite view of a hurricane. So the interface is an
instrument that reads a storm: radar, advisories, coordinates, category
scales. That framing comes from this club specifically and could not be
lifted onto another franchise, which is the whole point.

**Palette.** Near-black through charcoal, Hurricanes red `#CC0000`, the
official silver `#A2AAAD`, and a strictly rationed NWS warning amber used
only for live and advisory states. Zero border radius throughout.

**Type.** Big Shoulders Display 700–900 for headlines (American industrial
signage, condensed, built for scale), Archivo for body, Martian Mono for
instrument labels. Self-hosted, latin subset, only the weights used: nine
files, about 140 KB total. No third-party font connection.

**Signature element.** The radar console in the hero computes the real
great-circle bearing and range from Lenovo Center (35.8033°N, 78.7217°W) to
the opponent's arena. The blip sits where Florida actually is, with a track
line and cone of uncertainty running inbound. Change the opponent by editing
three attributes:

```html
<canvas data-radar data-lat="26.1585" data-lon="-80.3255" data-code="FLA">
```

**Structure carries data.** Every section eyebrow is a real figure: a record,
a coordinate, a game count, a filing date. No decorative `01 / 02 / 03`
numbering anywhere.

---

## 4. Structure

```
├── build.py                 page assembler and renderer
├── sw.js                    service worker: offline shell, wallet
├── data/                    the source of truth
│   ├── team.json  schedule.json  roster.json
│   ├── game.json  tickets.json
│   └── search-index.json    generated
├── index.html … es/         generated, do not edit by hand
├── src/
│   ├── partials/            head, chrome (nav + rail + search + settings), foot
│   └── pages/               page bodies with a leading <!--meta--> block
├── css/
│   ├── fonts.css            @font-face, self hosted
│   ├── tokens.css           palette, type scale, spacing, motion
│   ├── base.css             reset, typography, focus, reduced motion
│   ├── layout.css           shell, grid, instrument rail, sections
│   ├── components.css       boot, nav, buttons, cards, tables, forms
│   ├── sections.css         hero, advisory, board, players, footer
│   └── pages.css            game center, tickets, editorial
├── js/                      core, boot, nav, motion, storm, clock, dev
│                            plus roster, schedule, tickets, game
├── assets/                  brand, fonts, icons, img
└── tools/                   audit.py, contrast.py
```

Edit `src/`, then run `python3 build.py`. The navigation, footer, boot
sequence and rail live in one place each.

---

## 5. Engineering notes

**One animation loop.** Every animated subsystem subscribes to a single
`requestAnimationFrame` loop in `js/core.js`. Subscribers are skipped when
the tab is hidden, and both canvases unsubscribe entirely when scrolled out
of view.

**Canvas resolution is capped at 2× DPR.** A 3× phone would otherwise render
nine times the pixels for no visible gain.

**Reduced motion is honoured everywhere.** The boot sequence is skipped
outright, parallax and the cursor reticle never initialise, the radar sweep
and particle field stop. Reveal targets are forced visible so no content is
ever hidden behind an animation that will not run.

**Three bugs worth knowing about**, all fixed, all easy to reintroduce:

1. `clip-path: inset(0 100% 0 0)` as a reveal's hidden state zeroes the
   element's intersection rectangle, so `IntersectionObserver` never reports
   it visible and the reveal that would un-clip it never fires. The element
   hides itself from the thing meant to show it. Wipes now translate an inner
   block inside an `overflow: hidden` parent instead.
2. A second rule targeting an already-used `::after` silently replaces it
   rather than adding to it. The placeholder tag was wiping out the scrim
   gradients on cards and player tiles. Tags are now real elements injected
   by `js/dev.js`.
3. An unscoped attribute selector deleted the entire page. `js/tickets.js`
   queried `[data-base]` for price elements; `data-base` was also on `<html>`
   for the search path. `parseFloat("")` gave `NaN`, and the loop set
   `document.documentElement.textContent = "$NaN"`. Chromium reported a 200
   with no `<body>` and no console error, which is a memorable way to lose an
   afternoon. Query inside the component you own, name hooks specifically,
   and never let a formatter emit `NaN`.

**Progressive enhancement.** Filters only ever hide rows that are already in
the HTML. The countdown's target date is in the markup. With JavaScript off
every page is complete and readable.

---

## 6. Before this goes anywhere near a client

**Placeholder artwork.** All 36 images are procedurally generated abstract
plates, not photography. Every one is tagged in the interface with its
required spec. Add `class="assets-final"` to `<html>` to hide the tags, or
drop `js/dev.js` entirely.

**Sample data.** The record (53-22-7), the eight-game schedule and the Cup
result come from the uploaded page. Everything else — per-player stat lines,
box score, shot coordinates, momentum, prices — is invented for layout and
labelled `Sample data pending API` in the interface.

Several jersey numbers are omitted rather than guessed. Aho 20, Jarvis 24,
Svechnikov 37, Staal 11 and Slavin 74 are used; the rest render without a
number until confirmed.

**Wiring real data.** The NHL publishes a public web API at
`api-web.nhle.com`. I have not verified the endpoint paths, so confirm them
yourself before building against them. The markup is structured so a fetch
replaces the contents of `[data-shots]`, `[data-sched-rows]`,
`[data-roster-grid]` and the scorebar without touching the CSS or the
animation code.

**Not built.** Search, authentication, cart and checkout, podcasts, the
photo gallery viewer, and the cookie consent layer.

---

## 7. Imagery

**There is still no photography in this build, and it is not because I did not
try.** Every image host is blocked in the environment this was made in:
`images.unsplash.com`, `assets.nhle.com` and `upload.wikimedia.org` all return
`host_not_allowed`. Only package registries are reachable.

What was done instead, in two parts.

### Surfaces are generated, not photographed

`tools/make-ice.py` draws the material the sport is played on: ice scored by
skate edges, dasher boards with the yellow kickplate, a regulation rink from
above, an arena bowl, the net and crease. These are better generated than
photographed anyway. They tile, they stay dark enough to carry white type, and
they carry no licence.

    python3 tools/make-ice.py

### Photography has a pipeline

`data/assets.json` lists all twelve photographic slots with the shot each one
needs. `tools/fetch-assets.py` fetches, crops to each slot's ratio around its
focal point, and writes AVIF, WebP and JPEG at four widths.

    pip install pillow pillow-avif-plugin requests
    python3 tools/fetch-assets.py --check     # what is still missing
    python3 tools/fetch-assets.py             # fetch what is ready

**A slot with an empty `licence` or `credit` is refused.** That rule is
deliberate. The expensive mistake on a sports website is not a slow image, it
is an unlicensed one.

Where to source each kind is written into the manifest: club communications or
NHL Media for marks, NHLI or Getty editorial for players and action, the club's
own team photographer for editorial (usually cheaper and always better matched
to the brand), and the Unsplash or Pexels licences for generic ice and arena
shots. Never Google Images or a fan site.

### Player portraits are an empty state, not a stand-in

`photo` is `null` for every player in `data/roster.json`. Cards render a
designed state — the initial in outline over scored ice, with the jersey
number — rather than a photograph of somebody else. Set `photo` to a path and
the card renders the image instead. No template change needed.

---

## 8. Supplied assets, transitions, cursor and sound

### Photography and headshots

The client supplied 22 official NHL headshots keyed by player ID, nine
match and arena photographs, and the official 2026-27 roster page.

`tools/process-uploads.py` handles them. Headshots are transparent cutouts,
so they are composited onto a branded plate rather than dropped on grey, and
written at two widths in AVIF, WebP and JPEG. Action photography is cropped
to each slot's ratio **around a focal point chosen per image**, never centred.

`data/roster.json` is now built from the official roster page: 22 real
players with real numbers, positions, shoots, height, weight and birthplace.
Season stat lines remain sample and are still labelled as such.

**Provenance is unresolved and it matters.** Two of the supplied files carry
agency prefixes: `USATSI_25913189` is USA TODAY Sports Images and
`imagn-27161333` is Imagn. Both are licensed editorial stock. Four more
arrived as `images (1).jpeg` through `images (3).jpeg`, which is what a
Google Images download looks like. Every entry in `assets/CREDITS.json` is
marked `UNVERIFIED`. Clear them before this is published anywhere.

### Zone entry transitions

Concept 2, as chosen. Navigation reads as crossing a blue line into the next
zone: the line sweeps, the red centre line trails it, the fill carries the
old page out. 280ms out, 320ms in.

Two implementations, one behaviour. Chrome gets native cross document view
transitions through `@view-transition { navigation: auto }`, which run off
the main thread with no JavaScript at all. Everything else gets a JS sweep.

What it deliberately does not break: modifier clicks, middle clicks,
downloads, targets, external links and hash links all pass straight through.
Navigation is scheduled on a timer independent of the animation, so if the
animation stalls the page still goes. Reduced motion navigates instantly.

### Puck cursor

The earlier reticle was cut for being decoration. This one has a job: it
names the action under it. Profile, Buy, Read, Play, Follow, Filter. That is
worth a frame loop.

Fine pointers only, off under reduced motion, toggleable in settings, and
the system caret is never hidden over inputs or text.

### Sound

Synthesised with the Web Audio API. No audio files, so the feature costs zero
bytes of payload.

**Off by default, and that is not negotiable.** Sound a visitor did not ask
for is how you get muted at work and never come back. The audio context is
only created after a real gesture, so nothing trips autoplay policy. Sounds
are bound to deliberate actions only, never to scroll or load, and everything
mutes when the tab is hidden.

Five sounds: puck off a blade for clicks, a skate edge for hover, a whoosh
for navigation, a whistle for form errors, and a goal horn reserved for an
actual goal in the live feed. The horn fires through a `canes:goal` event so
the audio module stays decoupled from the score feed.

---

## 9. Hero film, cursor and sound revisions

### Hero film

The supplied `CH_hero.mp4` is the official Cause Chaos brand film: 60 seconds,
1080p, 33.8 MB with an audio track. A 33 MB autoplaying hero is not a hero,
it is an outage.

`ffmpeg` cuts a 12 second segment from 14s, where the footage is dark on the
left and free of competing typography, fades both ends so the loop seam is
invisible, and strips the audio entirely. Output:

| File | Size |
| --- | --- |
| `hero-1080.mp4` | 3.4 MB |
| `hero-720.mp4` | 1.6 MB |
| `hero-720.webm` (VP9) | 1.3 MB |
| poster set, 3 widths, AVIF/WebP/JPEG | 6 KB to 107 KB |

**Nothing downloads until the client has been checked.** The `<source>`
elements are attached by JavaScript, not written in the markup, because a
source in the HTML begins fetching before any condition can be evaluated.
Data saver, reduced motion, `navigator.connection.saveData` and a 2G link all
mean zero video bytes and the poster instead.

The poster is Staal pulling his helmet on against the Chaos wall. It is dark
where the headline sits, so the hero holds up identically whether the film
plays or not.

WCAG 2.2.2 requires anything moving for more than five seconds to be
pausable, so there is a labelled control. It sits after the two calls to
action, in the DOM and therefore in the tab order, because pausing a video is
not what a visitor came to do.

### Cursor

The puck is gone, replaced by a 6px dot with a ring that opens over anything
interactive and fills on press. It still earns its frame loop by signalling
affordance before the click; it no longer spells the action out in words,
which was louder than the rest of the interface deserved.

### Sound

Master gain dropped from 0.22 to 0.085 and every sound was rewritten. The
puck thock became a soft muted tick, the skate carve became a breath of air
near the edge of hearing, and the referee's whistle became a two note fall.
These are interface sounds that happen to be cold, not sports foley. If a
sound is noticeable on its own it is too loud.

Still off by default.
