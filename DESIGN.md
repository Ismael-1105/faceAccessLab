---
name: FaceAccess Lab
description: Facial recognition access control system for university laboratories
colors:
  security-blue-50: "#eff6ff"
  security-blue-100: "#dbeafe"
  security-blue-200: "#bfdbfe"
  security-blue-300: "#93c5fd"
  security-blue-400: "#60a5fa"
  security-blue-500: "#3b82f6"
  security-blue-600: "#2563eb"
  security-blue-700: "#1d4ed8"
  security-blue-800: "#1e40af"
  security-blue-900: "#1e3a8a"
  security-blue-950: "#172554"
  ice-trace: "#fafafa"
  cool-ash: "#f4f4f5"
  void: "#09090b"
  border-light: "#e4e4e7"
  border-strong: "#d4d4d8"
  ink: "#18181b"
  steel: "#52525b"
  stone: "#a1a1aa"
  surface-card: "#ffffff"
  surface-card-dark: "#18181b"
  danger-50: "#fef2f2"
  danger-100: "#fee2e2"
  danger-500: "#ef4444"
  danger-600: "#dc2626"
  success-50: "#f0fdf4"
  success-100: "#dcfce7"
  success-500: "#22c55e"
  warning-50: "#fffbeb"
  warning-100: "#fef3c7"
  warning-500: "#f59e0b"
typography:
  display:
    fontFamily: "Geist, system-ui, -apple-system, sans-serif"
    fontWeight: 900
    lineHeight: 1.05
    letterSpacing: -0.025em
  headline:
    fontFamily: "Geist, system-ui, -apple-system, sans-serif"
    fontSize: "clamp(1.5rem, 4vw, 2.25rem)"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: -0.02em
  title:
    fontFamily: "Geist, system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: -0.01em
  body:
    fontFamily: "Geist, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Geist Monotext, ui-monospace, JetBrains Mono, monospace"
    fontSize: "0.625rem"
    fontWeight: 700
    letterSpacing: 0.05em
    textTransform: uppercase
  mono:
    fontFamily: "Geist Mono, ui-monospace, JetBrains Mono, monospace"
    fontWeight: 600
    fontSize: "0.75rem"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "40px"
  3xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.security-blue-600}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "12px 24px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.security-blue-700}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  button-secondary:
    backgroundColor: "{colors.cool-ash}"
    textColor: "{colors.steel}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
    typography: "{typography.label}"
  button-secondary-dark:
    backgroundColor: "#27272a"
    textColor: "#d4d4d8"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.stone}"
    rounded: "{rounded.md}"
    padding: "8px 8px"
  card-default:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  card-default-dark:
    backgroundColor: "{colors.surface-card-dark}"
    textColor: "#f4f4f5"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  input-search:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "10px 16px"
    border: "1px solid {colors.border-light}"
  nav-link:
    textColor: "{colors.steel}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
    typography: "{typography.body}"
    fontWeight: 600
  nav-link-active:
    backgroundColor: "{colors.security-blue-600}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  badge-success:
    backgroundColor: "{colors.success-50}"
    textColor: "#166534"
    rounded: "{rounded.md}"
    padding: "4px 10px"
  badge-success-dark:
    backgroundColor: "rgba(34,197,94,0.15)"
    textColor: "{colors.success-500}"
    rounded: "{rounded.md}"
    padding: "4px 10px"
  badge-danger:
    backgroundColor: "{colors.danger-50}"
    textColor: "#991b1b"
    rounded: "{rounded.md}"
    padding: "4px 10px"
  badge-danger-dark:
    backgroundColor: "rgba(239,68,68,0.15)"
    textColor: "{colors.danger-500}"
    rounded: "{rounded.md}"
    padding: "4px 10px"
---

# Design System: FaceAccess Lab

## Overview

**Creative North Star: "The Biometric Observatory"**

FaceAccess Lab inhabits a world of precision monitoring. Every screen is an observation station — a calibrated instrument panel where identity is verified, access is decided, and every attempt is logged. The visual language draws from surveillance-grade dashboards and scientific instrumentation: clean, high-contrast information density with deliberate negative space around what matters.

The palette pairs a single authoritative blue — Security Blue — with a zinc-ash neutral system that shifts from cool silver in light mode to deep charcoal in dark mode. Color is applied sparingly and with purpose: blue for action, red for denial, green for clearance, amber for attention. The result is a system that feels simultaneously institutional and modern: trustworthy enough for a university security desk, polished enough for a capstone presentation.

Surfaces are tactile and responsive. Cards sit with a consistent subtle shadow — like observation reports stacked on a desk — and elements subtly shift on interaction: buttons depress, rows highlight, bars rise. Every micro-motion communicates that the system is alive and watching.

**Key Characteristics:**
- Single-authority blue accent, applied on ≤15% of any screen
- Zinc-neutral base with high text/background contrast for readability
- Flat cards with consistent layering (paper-stack model) rather than floating elevation
- Typographic hierarchy driven by weight and tracking rather than size alone
- Monospace for data, metrics, timing — reinforcing the instrumentation metaphor
- Responsive tactile feedback on all interactive surfaces
- Dark mode as a first-class citizen, not an afterthought

## Colors

The palette is zinc-based with a single blue accent. Color carries semantic meaning: action, status, and severity are read at a glance.

### Primary
- **Security Blue 600** (#2563eb): The sole accent. Used for primary CTAs, active navigation, progress indicators, and key interactive highlights. Never decorative.
- **Security Blue 50** (#eff6ff): Tinted backgrounds for blue-accented containers — feature cards, hero glow, pill badges.
- **Security Blue 700** (#1d4ed8): Hover state for primary actions.

### Neutral
- **Ice Trace** (#fafafa): Main surface background in light mode. Near-white with a cool cast.
- **Cool Ash** (#f4f4f5): Secondary surface — sidebar backgrounds, table headers, subtle dividers.
- **Ink** (#18181b): Primary text in light mode. Near-black with warm-zinc undertone.
- **Steel** (#52525b): Secondary text — captions, metadata, supporting information.
- **Stone** (#a1a1aa): Tertiary text — placeholders, disabled states.

### Dark Mode
- **Void** (#09090b): Main surface background in dark mode. True near-black.
- **Zinc 900** (#18181b): Card/surface containers.
- **Zinc 100** (#f4f4f5): Primary text on dark. Warm off-white.

### Semantic
- **Danger 600** (#dc2626): Denied access, error states, logout, destructive actions.
- **Success 500** (#22c55e): Granted access, active status, operational indicators.
- **Warning 500** (#f59e0b): Caution, alerts, calibration warnings.

### Named Rules
**The Observer's Palette Rule.** Security Blue appears on ≤15% of any screen. Its rarity gives it authority. Blue is for the system's voice — buttons, badges, active indicators. Content lives in neutral.

**The Status-As-Color Rule.** Red, green, and amber are reserved exclusively for status. A red element means denied, danger, or destructive. Green means cleared, allowed, or operational. No decorative use of status colors.

## Typography

**Display Font:** Geist (with system-ui, -apple-system, sans-serif fallback)
**Body Font:** Geist (same stack)
**Label/Mono Font:** Geist Mono (with ui-monospace, JetBrains Mono, monospace fallback)

**Character:** The pairing is a single-family system — Geist for everything, with its mono sibling for data. This creates a coherent, engineered feel where the shift to monospace signals "this is a measurement, not prose." The weight range (300–900) allows hierarchy through boldness rather than size alone, keeping the interface dense but legible.

### Hierarchy
- **Display** (900 weight, clamp(1.5rem, 5vw, 3.75rem), 1.05 line-height, -0.025em tracking): Hero headings only. Used on the landing page and large section titles. Never inside cards.
- **Headline** (800 weight, clamp(1.25rem, 3vw, 2.25rem), 1.1 line-height, -0.02em tracking): Section headers. Used for "Tecnología que protege cada acceso" and similar.
- **Title** (700 weight, 1rem / 14px, 1.25 line-height, -0.01em tracking): Card titles, sidebar labels, table row names.
- **Body** (400/500 weight, 0.875rem / 13px, 1.6 line-height): Paragraphs, descriptions, table cells. Max line length 65ch.
- **Label** (700 weight, 0.625rem–0.75rem / 10–12px, 0.05em tracking, uppercase): Buttons, badges, metric labels, table headers, status indicators. The smallest text that carries meaning.
- **Mono** (600 weight, 0.75rem / 12px): IDs, percentages, timestamps, code, hardware telemetry.

### Named Rules
**The Weight-Over-Size Rule.** Hierarchy is achieved primarily through font-weight and tracking, not size. A 12px label at 700 weight reads as more important than 14px body at 400 weight. Resist the urge to enlarge; increase weight and tracking first.

**The Mono Signal Rule.** Monospace signals measurement, identity, and machine output. Student IDs, match percentages, timestamps, log IDs, hardware status — all in Geist Mono. If it's a number the user needs to verify or compare, it's mono.

## Layout

The layout uses a single-column responsive grid with fixed header (64px). Content is centered within max-w-7xl containers using px-6/10 padding.

- **Admin panel:** Two-column (sidebar + main) on md+ screens. Sidebar collapses to icon-only at 64px or full at 240px. Togglable by the user.
- **Kiosk:** Single full-viewport column, no sidebar.
- **Landing:** Centered single column, max-w-3xl for hero copy, max-w-4xl for feature grid.
- **Density:** Information-dense on admin screens (stats grid 2×2 → 4×1, table rows at ~48px), spacious on public surfaces.
- **Card grid:** 1→2→3 columns depending on viewport (features, flow steps).
- **Breakpoints:** sm (640px), md (768px), lg (1024px). No custom breakpoints beyond Tailwind defaults.

The spacing rhythm follows a ~8px unit: margins and paddings step through 4, 8, 16, 24, 32, 40, 48px. Card internal padding is consistently 20–24px.

## Elevation & Depth

Depth is conveyed through tonal layering and consistent surface relationships, not dramatic shadow elevation. The system follows a paper-stack model: cards sit on the surface with a single subtle shadow (shadow-sm) that defines them as distinct records.

- **Surface:** The base layer. bg-surface (Ice Trace / Void).
- **Cards and panels:** One layer up. bg-white / bg-zinc-900, border, shadow-sm. These are "observation reports" on the desk.
- **Modal/dialog:** Two layers up. shadow-xl, backdrop overlay.
- **Header:** Floating above content. bg-white/80 backdrop-blur-xl, border-b. The semi-transparent backdrop ensures content is always visible behind it.
- **Interactive elevation:** Hover states gently lift — buttons use translateY(-1px) or active:scale(0.98), rows get a background tint.

### Shadow Vocabulary
- **Card shadow** (`0 1px 2px 0 rgb(0 0 0 / 0.05)`): Default for all card and panel containers. Equivalent to Tailwind shadow-sm.
- **Modal shadow** (`0 20px 25px -5px rgb(0 0 0 / 0.1)`): For dialogs and overlays.
- **CTA glow** (`0 4px 14px 0 rgb(37 99 235 / 0.2)` dark: /0.1): The primary call-to-action button. A colored glow that signals "this is the main action."
- **No shadows on:** Sidebar, table rows, badges, inputs at rest.

### Named Rules
**The Flat-At-Rest Rule.** Surfaces are flat at rest. Shadows appear only as a response to state — hover, active, or elevation tier. A card at rest has its quiet shadow; a card being hovered gets a subtle lift.

## Shapes

The form language is consistently rounded-rectangular with three radius tiers:

- **8px (rounded-lg):** Buttons, navigation items, badges, inputs, small containers, scrollbar thumb. The workhorse radius.
- **12px (rounded-xl):** Cards, panels, stat blocks, modals. The primary container radius.
- **16px (rounded-2xl):** Large feature cards, hero accent boxes. Rare — one or two per screen.
- **4px (rounded):** Scrollbar thumb, mini indicators, decorative bars in charts.
- **Full (rounded-full):** Status dots, avatar fallbacks, pulse indicators.

Borders are 1px solid using border-light (#e4e4e7 light / #27272a dark). No double borders, no dashed lines, no decorative ornate geometry. The silhouette communicates utility, not ornament.

### Named Rules
**The Single-Silhouette Rule.** Every interactive surface uses the same radius language (8px). A button, a nav link, a badge, an input — they all share the same corner shape. Consistency of silhouette reinforces that these are all part of the same instrument panel. Only containers elevate to 12px or 16px.

## Components

### Buttons
- **Shape:** 8px radius (rounded-lg). Solid background. No rounded-full or pill shapes.
- **Primary:** Security Blue 600 background, white text, 12px 24px padding. 700-weight uppercase label. `active:scale(0.98)` press effect. Hover shifts to Security Blue 700.
- **Secondary:** Cool Ash background (zinc-100), Steel text, border. Same shape and padding. For less prominent actions.
- **Ghost:** Transparent background, Stone text, 8px padding. For icon buttons and dismissible actions. Hover background tint (zinc-100).
- **Danger:** Red-50 background, red-700 text, border. For destructive actions (logout, clear data).
- **Disabled:** Stone background, opaque at 50%.

### Cards / Containers
- **Corner style:** 12px radius (rounded-xl).
- **Background:** White (light) / Zinc 900 (dark).
- **Border:** 1px solid border-light / border-dark equivalent.
- **Shadow:** shadow-sm at rest.
- **Internal padding:** 20–24px consistently (p-5/p-6).
- **Nested spacing:** Content inside cards uses the standard 8px unit grid.

### Inputs / Fields
- **Style:** 1px solid border-light, white background (dark: zinc-800 bg, zinc-700 border). 12px radius.
- **Focus:** Border shifts to Security Blue 500. Outer ring ring-1 Security Blue 500. Subtle, no heavy glow.
- **Placeholder:** Stone color (zinc-400).
- **Error:** Red border, red-50 background tint if needed.
- **Disabled:** 50% opacity, Cool Ash background.

### Navigation (Sidebar)
- **Style:** Vertical list of pill-shaped items. 8px radius. Default: Steel text, transparent bg.
- **Active:** Security Blue 600 background, white text, fill-weight icon.
- **Hover:** Subtle zinc-50 / zinc-800 background tint. No shadow.
- **Mobile sidebar:** Collapsible to icon-only (64px width). Expand button toggles.

### Navigation (Header)
- **Style:** Fixed top (64px), full-width, white/80 backdrop-blur-xl. Border-bottom 1px.
- **Brand:** 32px icon block (Security Blue 600 bg → white icon) + "FaceAccess" bold + "Lab" label.
- **Actions:** Theme toggle, contextual buttons (Kiosco, Login/Logout).

### Badges / Status Tags
- **Shape:** 8px radius. Compact: 4px 10px padding, 10px uppercase font.
- **Success:** Green-50 bg (dark: green-900/30), green-800/400 text.
- **Danger:** Red-50 bg (dark: red-900/30), red-800/400 text.
- **Warning:** Amber-50 bg (dark: amber-900/30), amber-800/400 text.
- **Info/Zinc:** Zinc-100 bg, zinc-600 text. For neutral tags.

### The Signature Component: Pipeline Progress
The scanning pipeline (DemoView) is the project's signature interactive component. A multi-step horizontal progress bar with:
- Active step highlighted in Security Blue 600 with animated fill
- Inactive steps in border-light / zinc-800 with mono step labels
- Each step is a 24px circle (number) + label below
- Card container showing current step details (icon, title, description)
- The full bar sits inside a card with the layered-paper shadow

### The Signature Component: Stat Block
Dashboard stat blocks appear in a 2×2 or 4×1 grid:
- Compact card with label (mono uppercase), value (large black weight), and icon in color-tinted container
- Color tint matches semantics: blue for total students, green for accesses, red for denials, amber for alerts
- Value text shifts to semantic color only for alert counts > 0

## Do's and Don'ts

### Do:
- **Do** use Security Blue for exactly one action per view — the primary call to action. More than one dilutes its authority.
- **Do** use the full weight range of Geist (300–900) to create hierarchy before reaching for larger sizes.
- **Do** keep card shadows consistent (shadow-sm). A panel of cards should feel like a stack of identically weighted pages.
- **Do** use mono font for any user-facing number that represents a measurement, ID, or duration.
- **Do** transition interactive elements with 200ms ease — fast enough to feel responsive, slow enough to be perceived.
- **Do** reduce motion when prefers-reduced-motion is active — all animations become instant.

### Don't:
- **Don't** use Security Blue as a background for any full-width section or decorative block. It is an accent, not a surface.
- **Don't** invent a third accent color. The system has one accent (Security Blue) and neutrals. Secondary and tertiary roles do not exist.
- **Don't** apply shadows to sidebar items, badges, or table rows — they already have shape and color to define them.
- **Don't** use rounded-full on buttons, cards, or inputs. Reserve full rounding for status dots and pulse indicators.
- **Don't** place body text over Security Blue backgrounds — contrast fails. Security Blue is for text on white, or white text on Security Blue.
- **Don't** use colored text (green/red/amber) except for status indicators. Content copy is always Ink or Steel.
- **Don't** split accent colors between light and dark mode. Security Blue 600 is the accent in both modes.
