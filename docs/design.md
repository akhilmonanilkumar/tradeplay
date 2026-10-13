# Design

The design concepts live in Claude Design (the "A+ TradePlay redesign" canvas): brand, Today, New trade and Coach boards. The app implements them with the tokens below.

## Brand
- **Mark:** a rounded graphite square holding a peak (the "A", read as a market top or a chart) and a gold plus. It is defined in `public/logo.svg`, with a heavier stroke version for small sizes in `public/icon.svg`.
- **Wordmark:** **A+** in gold, followed by **TradePlay**, set in Geist SemiBold with tight tracking.
- **Assets:**
  - `favicon.ico` (16/32/48)
  - `icon.svg`
  - `apple-touch-icon.png` (180)
  - `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`
  - `og.png` (1200×630, used for link previews)
  - React: `components/Brand.tsx` → `<Logo />`

## Layout language (v2.1 — soft bento)
Inspired by the references you liked: a floating **icon rail** (black pill, tooltips), a big greeting with **Start my day**, borderless rounded cards (22–26 px) on a soft grey canvas, a **gradient score gauge**, smooth **violet spline** for cumulative P&L, green/red daily bars, a **radar** "overall score" (last 30 days vs prior 30, dashed), a right rail with a **black status card**, a **to-do list** with black icon tiles and a black next-event card, and a floating glass **Ask anything** AI bar on every page.

## Tokens (`app/globals.css`)
Colours are stored as `R G B` CSS variables so Tailwind opacity modifiers work (`bg-accent/10`).

| Token | Dark (default) | Light | Use |
|---|---|---|---|
| `bg` | `#0B0C0F` | `#EEF1F5` | Canvas |
| `panel` | `#15161B` | `#FFFFFF` | Cards (no border in light, soft shadow) |
| `raised` | `#1E2026` | `#F1F3F7` | Inputs, icon tiles, chips |
| `line` | `#262830` | `#E5E7EB` | Dividers, grid lines |
| `rail` / `solid` | `#15161B` / `#ECEDF0` | `#0B0B0D` / `#0B0B0D` | Icon rail, status cards / primary buttons, tooltips |
| `chart` | `#A78BFA` | `#8B5CF6` | Curves, radar, AI surfaces |
| `ink` | `#ECEDF0` | `#121316` | Text |
| `mute` | `#8B909A` | `#6B7280` | Secondary text |
| `accent` | `#F2C14E` (gold) | `#9A6F00` | A+ / coach / focus |
| `up` | `#34D399` | `#0F8A5F` | Profit |
| `down` | `#FB7185` | `#C8304D` | Loss, blocks |
| `warn` | `#FF8A4C` | `#C2410C` | Caution |

- **Themes:** set by the `theme` cookie (`dark`, `light` or `system`), which the server reads, so there is no flash of the wrong theme and no inline script. Toggle it in the sidebar or with ⌘K.
- **Type:** Geist Sans for UI and Geist Mono for every number (`.num`: tabular, signed).
- **Components:** the `card`, `coach` (gold-glow surface), `btn-primary`, `btn-accent`, `btn-ghost`, `btn-danger`, `input`, `label` and `chip` utilities.
- **Layout:** a sidebar on desktop; a bottom nav with a centre "New trade" button on mobile.
- **Accessibility:**
  - Real buttons and labels.
  - `aria-pressed` on toggles.
  - A focus ring in the accent colour.
  - Numbers carry +/− signs, so colour is never the only signal.
