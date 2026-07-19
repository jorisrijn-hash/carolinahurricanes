# Notice on assets, marks and data

## Status

This is an **unaffiliated concept redesign**, produced as a portfolio and
evaluation exercise. It is not commissioned by, endorsed by, affiliated with
or produced for the Carolina Hurricanes, the National Hockey League, Lenovo
Center or any party named in the interface.

Do not publish it at a public URL that could be mistaken for an official
club property, and do not present it as commissioned work.

## Team marks

`assets/brand/` contains four SVG files extracted **unaltered** from the
uploaded page (`nhl.com/hurricanes`):

| File | Contents |
| --- | --- |
| `canes-primary.svg` | Primary mark, full colour |
| `canes-primary-alt.svg` | Primary mark, light outline for dark plates |
| `canes-wordmark.svg` | Wordmark |
| `nhl-shield.svg` | League shield |

These are registered trademarks of their respective owners. They were not
redrawn, recoloured, distorted or reconstructed, and no substitute or
"inspired by" mark was fabricated anywhere in this build. They are present so
the layout can be evaluated with the real marks in place. Any production use
requires permission from the rights holders.

## Icons

Every file in `assets/icons/` is derived from the official primary mark:

- `favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, `favicon-48x48.png`
- `apple-touch-icon.png` (180×180, opaque)
- `android-chrome-192x192.png`, `android-chrome-512x512.png`
- `maskable-512x512.png` (40% safe zone)
- `safari-pinned-tab.svg`

The pinned-tab icon is a **machine-traced monochrome silhouette** of the
primary mark. It is a derivative work and the only asset here that alters the
official artwork in any way. Replace it with the club's own one-colour mark,
or obtain sign-off, before any production use.

## Photography

**There is no photography in this build.** All 36 images in `assets/img/` are
procedurally generated abstract plates: layered sine fields, a simulated
lighting bloom and grain. They are not photographs, not AI-generated imagery,
and do not depict any real person, place or event.

Each is tagged in the interface with the specification of the asset that
belongs in that slot. Licensed press photography, arena imagery and player
portraits must be supplied and cleared separately.

## Fonts

Self-hosted in `assets/fonts/`, obtained from the Fontsource npm packages:

- Big Shoulders Display — SIL Open Font License 1.1
- Archivo — SIL Open Font License 1.1
- Martian Mono — SIL Open Font License 1.1

All three permit self-hosting and commercial use. Retain the licence files
if you redistribute the font binaries.

## Data

The following come from the uploaded page and are treated as given: the 2026
Stanley Cup result, the 2025-26 record of 53-22-7, the first eight games of
the 2026-27 schedule, the 84-game season length, arena and staff names.

**Everything else is invented for layout purposes**: per-player statistics,
the box score, shot coordinates, momentum data, standings beyond Carolina,
ticket prices and partner names. These are labelled `Sample data pending API`
in the interface. Replace before publication.

Sponsor and partner logos are deliberately absent. Named placeholders are
used instead, since partner marks carry their own licensing terms.

## Third party data and services referenced

This build contains the client side of several features whose data or
infrastructure is not included and must be licensed or contracted separately:

- **NHL Edge puck and player tracking** (`data/game.json`, Edge panel on the
  game centre). Skating speed, shot velocity and zone time are league data.
  Confirm rights before display.
- **Win probability**. The curve is sample data. A published model needs its
  own methodology note and should not be presented as official without one.
- **Expected goals** on the shot map. Same: the values are invented, and any
  real xG figure needs its model named.
- **Ticketing**. Prices, fees, resale inventory and the membership calculator
  all read `data/tickets.json`. Nothing here connects to a ticketing provider.
  The fee rate of 18.4 per cent plus $4.95 is illustrative.
- **Seat view photography** (`assets/img/seat-*.jpg`) is generated abstract
  artwork, not photographs of the arena.
- **Push notifications**. The permission flow is real; delivery is not. Web
  push requires a push service, VAPID keys and a server.
- **Arena operations** (parking, queue times, concession pre-order) are sample
  values that would come from venue systems.
- **Barcode** in the ticket wallet is a drawn placeholder. A real credential
  rotates and must never be written to disk or cached by the service worker.
