---
name: Orbital Glass Telemetry
colors:
  surface: '#0f1321'
  surface-dim: '#0f1321'
  surface-bright: '#353948'
  surface-container-lowest: '#090e1c'
  surface-container-low: '#171b2a'
  surface-container: '#1b1f2e'
  surface-container-high: '#252939'
  surface-container-highest: '#303444'
  on-surface: '#dfe1f6'
  on-surface-variant: '#bcc9cd'
  inverse-surface: '#dfe1f6'
  inverse-on-surface: '#2c303f'
  outline: '#869397'
  outline-variant: '#3d494c'
  surface-tint: '#4cd7f6'
  primary: '#4cd7f6'
  on-primary: '#003640'
  primary-container: '#06b6d4'
  on-primary-container: '#00424f'
  inverse-primary: '#00687a'
  secondary: '#adc6ff'
  on-secondary: '#002e6a'
  secondary-container: '#0566d9'
  on-secondary-container: '#e6ecff'
  tertiary: '#4edea3'
  on-tertiary: '#003824'
  tertiary-container: '#1bbd85'
  on-tertiary-container: '#00452e'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#acedff'
  primary-fixed-dim: '#4cd7f6'
  on-primary-fixed: '#001f26'
  on-primary-fixed-variant: '#004e5c'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#0f1321'
  on-background: '#dfe1f6'
  surface-variant: '#303444'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0.005em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.01em
  telemetry-lg:
    fontFamily: JetBrains Mono
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 22px
    letterSpacing: 0.02em
  telemetry-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.025em
  telemetry-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.08em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system embodies the clinical precision of mission control paired with cinematic aerospace visualization. It targets intelligence analysts, aerospace engineers, satellite operators, and remote-sensing researchers who ingest dense streams of multispectral data under demanding operational parameters. 

The aesthetic is high-tech glassmorphism fused with head-up display (HUD) functionalism. Interfaces are treated as luminous optical layers floating above synthetic aperture radar (SAR), thermal infrared, and optical geospatial feeds. The visual signature relies on deep cosmic depths, calibrated neon illumination, sub-pixel grid lines, and monospaced telemetry telemetry readouts. The interface must evoke complete spatial command, scientific rigor, uncompromising technical precision, and quiet operational authority.

## Colors

The system uses a calibrated spectral palette tuned strictly for dark visual environments to maximize contrast against high-resolution Earth observation imagery without causing eye fatigue.

- **Background & Base Neutrals**: Rooted in deep cosmic voids: `#030712` (Base Canvas), `#070B19` (Elevated Panel Layer), and `#0B1229` (Top-level Control Panels). Borders utilize a translucent slate-cyan matrix (`rgba(6, 182, 212, 0.18)` and `rgba(148, 163, 184, 0.12)`).
- **Electric Cyan (`#06B6D4`, `#22D3EE`)**: The primary vector. Represents active vector overlays, current crosshairs, selected imagery bands, and primary interactive affordances.
- **Orbital Blue (`#3B82F6`, `#60A5FA`)**: The secondary vector. Denotes telemetry trajectories, flight paths, satellite ephemeris tracks, and secondary operations.
- **Sensor Neon Emerald (`#10B981`)**: Dedicated to sensor lock, real-time sync states, operational telemetry health, and target acquisition confirmation.
- **Electric Violet (`#8B5CF6`) & Alert Amber (`#F59E0B`)**: Violet indicates specialized algorithmic operations (multispectral indices, machine-learned vector segmentation), while amber is reserved strictly for anomalies, data degradation, cloud obscuration thresholds, and critical orbital warnings.

## Typography

The typographic hierarchy enforces immediate legibility during high-velocity data reviews. 

- **Display & Headlines (Plus Jakarta Sans)**: Used for layout headers, workspace identification, and modal titles. Geometric and structured with controlled tracking.
- **Narrative & System Interface (Inter)**: Applied across descriptions, logs, parameter definitions, and contextual tooltips. It offers neutral, unembellished readability under variable contrast ratios.
- **Scientific Metrics & Telemetry (JetBrains Mono)**: Applied universally to geographic coordinates (WGS84, MGRS), UTC timestamps, satellite azimuth/elevation, sensor bandwidth values, and numerical adjustment matrices.
- **Labels & Micro-headers (`label-caps`)**: Always uppercase with widened tracking (`0.08em`) to mimic aerospace avionics instrumentation.

## Layout & Spacing

The viewport operates on a unified fluid 12-column layout designed to support dense, floating instrumentation docked over edge-to-edge geospatial canvases.

- **Canvas-Dominant Layering**: The primary satellite or map visualization is rendered full-screen (`100vw` / `100vh`). UI panels, toolbars, and inspection matrices float over this layer using fixed padding and dynamic dock positions.
- **Breakpoint Framework**:
  - **Mobile (< 768px)**: Floating panels collapse into bottom-anchored modal sheets with `margin: 1rem` and `gutter: 1rem`. Canvas tools collapse into an overlay ribbon.
  - **Tablet (768px - 1199px)**: Side inspection docks become collapsible drawers (`320px` width) with `gutter: 1rem` and `margin: 1.5rem`.
  - **Desktop (>= 1200px)**: Multi-column persistent layout (`margin-desktop: 2rem`, `gutter-desktop: 1.5rem`). Left dock manages temporal feeds and layer hierarchies (`320px`), center displays the canvas HUD, and right dock hosts algorithmic inference matrices (`380px`).
- **Rhythm**: Internal component spacing relies on precise 4px increments (`0.25rem` through `2.5rem`) to maintain compact density appropriate for mission-critical tooling.

## Elevation & Depth

Depth is conveyed through optical glass layers and radiant luminescence rather than heavy dropped drop shadows.

- **Base Layer (Ground)**: Full viewport satellite viewport and spatial mesh.
- **Level 1 (Docked Viewport Overlays)**: Background `rgba(7, 11, 25, 0.72)` with `backdrop-filter: blur(16px)` and a crisp 1px stroke of `rgba(148, 163, 184, 0.14)`.
- **Level 2 (Active Floating Panels & Inspector Modules)**: Background `rgba(11, 18, 41, 0.82)` with `backdrop-filter: blur(24px)`, framed by a 1px border of `rgba(6, 182, 212, 0.28)`. An ultra-diffuse ambient cyan glow is introduced: `0 0 24px -4px rgba(6, 182, 212, 0.12)`.
- **Level 3 (Alerts, Overrides, Context Modals)**: Background `rgba(7, 11, 25, 0.94)` with `backdrop-filter: blur(32px)`, 1px stroke of `rgba(34, 211, 238, 0.45)`, and an alert-driven glow: `0 0 32px 0 rgba(6, 182, 212, 0.22)`.

## Shapes

The design system employs a geometric shape language (level `1` / Soft) characterized by tight, surgical corner radii (`0.25rem` standard, `0.5rem` for structural containers). This retains the disciplined, military-spec feel of aerospace instruments while preventing visual harshness. 

HUD reticles, data crosshairs, and comparison sliders integrate chamfered accents or micro-notches (45-degree corner cutouts) to reinforce sensor telemetry visual cues. Circular forms are reserved exclusively for live sensor status indicators, azimuth compass needles, and target pinpoints.

## Components

- **Buttons & Control Actions**:
  - *Primary Action*: High-contrast cyan fill (`#06B6D4`) with dark cosmic text (`#030712`), semibold weight, 4px border-radius, and a subtle luminous aura (`box-shadow: 0 0 16px rgba(6, 182, 212, 0.35)`). Active state scales to `0.98`.
  - *Secondary / HUD Action*: Ghost panel treatment (`rgba(11, 18, 41, 0.6)`) with 1px border of `rgba(6, 182, 212, 0.3)`. Text in `#22D3EE`. On hover, the border transitions to `#22D3EE` with a back-fill increase to `rgba(6, 182, 212, 0.15)`.
  - *Telemetry Pill Button*: Monospace label-caps typography, ultra-compact padding (`0.25rem 0.5rem`), used for toggling polarimetry or orbital bands.

- **HUD Telemetry Indicators & Metrics**:
  - Composed of an uppercase micro-header (`label-caps`) in muted slate, an emerald or cyan status beacon (4px glowing dot), and primary numeric metric rendered in `JetBrains Mono` (`telemetry-lg`).
  - Anchored with subtle crosshair corner marks (`+`) rendered in `rgba(6, 182, 212, 0.3)`.

- **Interactive Comparison Sliders**:
  - Split-screen visual overlay control with a 1px neon line separator (`#22D3EE`) featuring a central circular handle (`28px` diameter) coated in glassmorphism with an embedded dual-arrow SVG icon.
  - Generates real-time before/after image band comparisons (e.g., Optical vs. Synthetic Aperture Radar) with instantaneous telemetry feedback.

- **Algorithm Control Cards & Filter Matrices**:
  - Floating containers with 1px luminous cyan/slate borders and `space-md` internal padding.
  - Parameter controls feature micro-steppers and custom linear sliders with electric cyan active tracks and numerical telemetry readouts positioned alongside track limits.

- **Input Fields**:
  - Structured data inputs featuring background `rgba(3, 7, 18, 0.65)`, 1px border of `rgba(148, 163, 184, 0.2)`, and monospace text in `#F8FAFC`.
  - On focus: 1px border transitions cleanly to `#06B6D4` with an ambient field glow of `0 0 12px rgba(6, 182, 212, 0.2)`. Labels float above with `label-caps` tracking.

- **Checkboxes & Segmented Toggles**:
  - Checkboxes are `16px` squares with a 1px stroke. Checked state illuminates with `#06B6D4` fill, an inner dark checkmark, and a soft glow.
  - Layer visibility toggles feature eye icons that illuminate neon emerald (`#10B981`) when actively processing sensor data.