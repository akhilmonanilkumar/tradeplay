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

## Mobile
- **Navigation:** a floating bottom nav (Today · Plan · **+** · Coach · More), with 60 px tap targets and an active pill. "More" opens a sheet with the other pages, the theme and sign out.
- **AI button:** a round purple button above the nav opens an "Ask the coach" sheet with quick prompts. It tucks away while you scroll down and comes back when you scroll up. It's hidden on form pages, where the action bar sits.
- **Sheets:**
  - Every dialog becomes a bottom sheet with a drag handle; swipe down to close.
  - Action footers stay pinned to the bottom of the sheet (trade sheet: Save / Close trade).
  - The Coach's chats, memory, knowledge and lessons open from ☰ as a sheet, so the chat gets the full width.
- **Action bars:** sticky bars sit above the nav on New trade (R:R, risk, size, gate, issues, coach check, Log or "Why blocked?"), on Plan (checklist, Dictate, Save) and on Accounts (when you have unsaved edits).
- **Today on phones:** the status card, to-do list and next news event come first, then scores and charts. The economic calendar becomes a day-by-day agenda, and chip rows scroll sideways.
- **Trades:** cards grouped by day with sticky day headers and day totals, plus "Show more".
- **Inputs:** text is 16 px on touch screens, so iOS doesn't zoom in. There's no double-tap delay or tap flash, and the layout respects safe areas (notch and home bar).
- **Gestures:** pull down at the top of a page to refresh. Data also reloads when you return to the app after more than a minute.
- **Motion:** reduced motion is respected.
