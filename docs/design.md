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

## Tokens (`app/globals.css`)
Colours are stored as `R G B` CSS variables so Tailwind opacity modifiers work (`bg-accent/10`).

| Token | Dark (default) | Light | Use |
|---|---|---|---|
| `bg` | `#0A0B0D` | `#F6F6F3` | Page |
| `panel` | `#121317` | `#FFFFFF` | Cards |
| `raised` | `#1A1C21` | `#F0F0EC` | Inputs, hovers, tiles |
| `line` | `#24262C` | `#E2E2DC` | Borders |
| `ink` | `#ECEDF0` | `#141518` | Text |
| `mute` | `#8B909A` | `#5B5F67` | Secondary text |
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
