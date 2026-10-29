---
name: Orbital Telemetry & Earth Observation Console
colors:
  surface: '#0f131b'
  surface-dim: '#0f131b'
  surface-bright: '#353941'
  surface-container-lowest: '#0a0e15'
  surface-container-low: '#181c23'
  surface-container: '#1c2027'
  surface-container-high: '#262a32'
  surface-container-highest: '#31353d'
  on-surface: '#dfe2ec'
  on-surface-variant: '#c0c7d4'
  inverse-surface: '#dfe2ec'
  inverse-on-surface: '#2d3038'
  outline: '#8a919d'
  outline-variant: '#404752'
  surface-tint: '#a2c9ff'
  primary: '#a2c9ff'
  on-primary: '#00315b'
  primary-container: '#4da3ff'
  on-primary-container: '#003866'
  inverse-primary: '#0060a9'
  secondary: '#bec7d7'
  on-secondary: '#28313d'
  secondary-container: '#3e4754'
  on-secondary-container: '#adb6c5'
  tertiary: '#ffb95c'
  on-tertiary: '#462a00'
  tertiary-container: '#de8f00'
  on-tertiary-container: '#4f3000'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d3e4ff'
  primary-fixed-dim: '#a2c9ff'
  on-primary-fixed: '#001c38'
  on-primary-fixed-variant: '#004881'
  secondary-fixed: '#dae3f3'
  secondary-fixed-dim: '#bec7d7'
  on-secondary-fixed: '#131c28'
  on-secondary-fixed-variant: '#3e4754'
  tertiary-fixed: '#ffddb7'
  tertiary-fixed-dim: '#ffb95c'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#0f131b'
  on-background: '#dfe2ec'
  surface-variant: '#31353d'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 1.75rem
    fontWeight: '500'
    lineHeight: 2.25rem
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 1.25rem
    fontWeight: '500'
    lineHeight: 1.75rem
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: '500'
    lineHeight: 1.5rem
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 0.9375rem
    fontWeight: '400'
    lineHeight: 1.375rem
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 0.8125rem
    fontWeight: '400'
    lineHeight: 1.25rem
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: 1.125rem
    letterSpacing: 0.01em
  label-mono-lg:
    fontFamily: JetBrains Mono
    fontSize: 0.8125rem
    fontWeight: '500'
    lineHeight: 1.125rem
    letterSpacing: 0em
  label-mono-md:
    fontFamily: JetBrains Mono
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: 1rem
    letterSpacing: 0.02em
  label-mono-sm:
    fontFamily: JetBrains Mono
    fontSize: 0.6875rem
    fontWeight: '400'
    lineHeight: 0.875rem
    letterSpacing: 0.03em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 0.5rem
  gutter-compact: 0.25rem
  margin: 0.75rem
  margin-dock: 0rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

The design system establishes a focused, calm, high-precision scientific instrument. It is engineered for geospatial analysts, environmental scientists, and aerospace systems operators who inspect petabytes of multi-spectral imagery under prolonged operational sessions.

### Aesthetic Principles
- **Instrument Precision:** Interfaces are tools, not novelty presentations. Visual noise is aggressively suppressed to elevate geospatial raster layers and radiometric data.
- **Docked Structural Geometry:** Panels anchor firmly to viewport edges, creating a dedicated console viewport rather than floating bubbly surfaces.
- **Restraint Over Spectacle:** Strictly avoid neon glows, ambient purple accents, glassmorphic blurs, and gradient-filled text. Visual hierarchy is achieved via surface-step luminance, structural dividers, and crisp micro-typography.
- **Telemetry Monospace Pairing:** Monospaced data renders all numeric readouts, coordinates, band indices, and timestamps to eliminate layout shift and reinforce optical accuracy.

## Colors

The palette operates entirely in low-reflectance, high-fidelity dark spectrums. This minimizes eye strain during extended night operations and ensures multi-spectral false-color composites retain optical priority.

### Surface Tiers
- **Canvas / Viewport Base (`#0A0D12`):** Primary background beneath raster canvases, tile engines, and terminal viewports.
- **Surface Default (`#0F131A`):** Docked sidebars, top operational ribbons, and persistent view docks.
- **Surface Container High (`#151A23`):** Inspector panels, collapsible parameter accordions, toolbar clusters, and metric summaries.
- **Surface Elevated / Active (`#1C222D`):** Active tool selections, hovered menu rows, pinned chip filters, and dialog backings.

### Accents & Borders
- **Telemetry Blue (`#4DA3FF`):** Single accent color reserved for focused state indicators, active vector layers, scrubber playheads, and confirmed action triggers.
- **Subtle Surface Border (`rgba(255, 255, 255, 0.08)`): Ubiquitous hairline stroke delineating adjacent surfaces and toolbar clusters.
- **Border Focus (`rgba(77, 163, 255, 0.45)`): High-precision focus outline for input states and crosshairs.

### Typographic Contrast
- **High Emphasis (`#E6E9EF`):** Primary telemetry readouts, layer titles, input values.
- **Muted / Secondary (`#9AA3B2`):** Metadata keys, spectral band labels, deactivated toggles, column headers.
- **Tertiary / Inactive (`#5C6575`):** Disabled states, structural hairline grids, inactive status badges.

## Typography

The typography couples the human-legible clarity of **Inter** with the tabular precision of **JetBrains Mono**.

### Typographic Disciplines
- **Inter:** Restricted to light and medium weights (`400` and `500`). Bold styles (`700+`) are excluded to avoid heavy optical weight. Headline scale is kept intentionally tight; the primary workspace prioritizes continuous data streams over oversized display titles.
- **JetBrains Mono:** Mandatory for all coordinates (WGS84, UTM, MGRS), radiometric metrics (NDVI, EVI, NDWI, surface temperature), sensor capture timestamps (ISO 8601 / UTC), resolution scales (GSD meters/pixel), bounding boxes, and cloud coverage percentages.
- **Tabular Figures:** When rendering dynamic numeric updates in table cells or scrubbers, enable OpenType tabular lining (`font-feature-settings: "tnum" 1`) across both fonts to eliminate character jiggle.

## Layout & Spacing

The interface employs a docked workstation layout governed by a strict **8px base grid** (with a 4px half-step for micro-telemetry tokens).

### Layout Geometry
- **Edge-Docked Canvas:** The primary earth observation map fills 100% of the viewport width and height. Overlays and inspector docks snap flush (`margin-dock: 0rem`) to viewport edges (top ribbon, left layer tree, right parameter console, bottom timeline).
- **Toolbars & HUDs:** Detached floating HUDs use `margin: 0.75rem` off the canvas edge, anchored strictly to corners or bottom-center.
- **Density Control:** Component internals use compact vertical spacing (`space-xs` and `space-sm`) and relaxed horizontal reading space (`space-md`) to ensure high density without visual crowding.

### Screen Adaptability
- **Desktop (1440px+):** Full 3-dock workspace with simultaneous left scene tree (280px), center viewport, right multi-spectral analysis dock (360px), and fixed bottom timeline scrubber (72px).
- **Tablet / Reduced Monitor (1024px - 1439px):** Side panels collapse into off-canvas sliding drawers with toggleable trigger strips.
- **Mobile Handheld (<1023px):** Single-column stacked mode. The map viewport occupies the upper half; telemetry readout and layer selection transform into a bottom sheet with tabbed sub-views.

## Elevation & Depth

Spatial hierarchy is resolved entirely through **tonal layering** and **hairline planar separation**, eschewing deep blur shadows and diffuse drop glows.

### Tonal Hierarchy
- **Canvas Base (`#0A0D12`):** Lowest layer containing the WebGL raster viewer and vector overlays.
- **Docked Surface (`#0F131A`):** Anchored control columns framed with a 1px border `rgba(255, 255, 255, 0.08)`.
- **Card & Tool Tiers (`#151A23`):** Grouped tools and inspector buckets resting on the docked surface.
- **Hover & Popover (`#1C222D`):** Dropdowns, tooltips, and context menus elevate slightly with an ultra-subtle directional shadow: `box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5)`.

### Border Discipline
All panels, status badges, divider splits, and segmented buttons use the hairline structural rule:
- Border width: `1px` (solid).
- Color: `rgba(255, 255, 255, 0.08)`.
- Border lines never overlap; shared edges between adjacent docked panels collapse into a single shared 1px line.

## Shapes

The design system uses a controlled roundedness balance between industrial sharpness and ergonomics.

### Radii Guidelines
- **Outer Modals & Inspector Pods:** `10px` to `12px` border radius (`rounded-lg` to `rounded-xl`).
- **Docked Panels:** `0px` radius on edges touching viewport walls; `8px` on free interior edges.
- **Inputs, Buttons, and Chips:** Uniform `6px` to `8px` (`roundedness: 2`), delivering clean alignment with the 8px spatial grid.
- **Micro Badges & Sensor Pills:** Strict `4px` corner radius. Full pill roundedness (`rounded-full` / >999px) is strictly prohibited across all data instruments.

## Components

Components follow functional ergonomics with zero ornamental clutter. Icons are sourced strictly from Lucide Line Icons using `stroke-width={1.5}` at standard sizes of 14px or 16px. No emojis or solid filled iconography.

### Buttons & Trigger Actions
- **Primary:** Surface `#4DA3FF`, text `#0A0D12`, font weight `500`. On hover, background shifts to `#3B8FEB`. Never use blue outer glow or drop shadows.
- **Secondary / Surface:** Surface `#151A23`, text `#E6E9EF`, border `1px solid rgba(255, 255, 255, 0.08)`. Hover state adopts `#1C222D`.
- **Ghost / Tool Strip:** Transparent background, text `#9AA3B2`, padding `6px`. On hover, text shifts to `#E6E9EF` with surface `#151A23`.
- **Dimensions:** Compact height `28px` for timeline/toolbar actions; standard height `34px` for modal workflows.

### Chips & Filter Badges
- **Form:** JetBrains Mono font (`label-mono-sm`), `4px` radius, height `22px`, internal padding `0 8px`.
- **States:** Inactive chips use surface `#151A23` with secondary text (`#9AA3B2`). Active spectral band chips (e.g., `B04 - Red`, `B08 - NIR`) use `#1C222D`, border `1px solid rgba(77, 163, 255, 0.45)`, and text `#4DA3FF`.

### Input Fields & Scrubbers
- **Text & Numeric Inputs:** Surface `#0F131A`, border `1px solid rgba(255, 255, 255, 0.08)`, text `#E6E9EF`. Font matches input type: Inter for labels/queries; JetBrains Mono for coordinates, dates, and radiometric constants. Focus state applies border `#4DA3FF` with zero spread glow.
- **Timeline Slider / Scrubber:** Background track `2px` solid `#151A23`. Loaded tile segments highlighted in `#1C222D`. Scrubber head is a `12px` by `12px` square rotated 45° or an acute vertical marker rendered in `#4DA3FF`.

### Checkboxes, Radios, & Switches
- **Checkboxes:** Size `14px` by `14px`, `3px` corner radius, border `1px solid rgba(255, 255, 255, 0.2)`. Selected state fills with `#4DA3FF` with a dark `#0A0D12` checkmark icon.
- **Switches (Layer Visibilities):** Width `28px`, height `16px`. Inactive track `#151A23` with border. Active track `#4DA3FF`. Thumb diameter `12px`, solid `#E6E9EF`.

### Lists & Tree Views (Catalog & Bands)
- **Hierarchy:** Tree items render with 14px icons, 8px gap, and hierarchical line guides (`1px solid rgba(255, 255, 255, 0.04)`).
- **Row Heights:** Tight `28px` row item height for data efficiency. Pinned metadata rows use mono styling right-aligned.

### Domain-Specific Components
- **Coordinate Crosshair HUD:** Docked bottom-left overlay rendering cursor position (`Lat`, `Lon`, `Zoom`, `EPSG`) in `label-mono-sm` over surface `#0F131A` with a 1px border.
- **Band Matrix Inspector:** Multi-spectral combination matrix allowing drag-and-drop band assignments (RGB mapped to B12, B8A, B04) styled with high-contrast indicator tags.
- **Histogram & Radiometric Threshold Bar:** Embedded SVG frequency distribution curves with dual draggable range handles in `#4DA3FF`.