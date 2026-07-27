---
name: Pass GUI
description: Calm, local-first desktop workspace for `pass` password stores.
colors:
  canvas: "oklch(1 0 0)"
  ink: "oklch(0.145 0 0)"
  surface: "oklch(1 0 0)"
  muted-surface: "oklch(0.97 0 0)"
  muted-ink: "oklch(0.556 0 0)"
  secondary-surface: "oklch(0.967 0.001 286.375)"
  secondary-ink: "oklch(0.21 0.006 285.885)"
  accent-surface: "oklch(0.97 0 0)"
  accent-ink: "oklch(0.205 0 0)"
  work-blue: "oklch(0.5 0.134 242.749)"
  work-blue-ink: "oklch(0.977 0.013 236.62)"
  focus-ring: "oklch(0.708 0 0)"
  line: "oklch(0.922 0 0)"
  danger: "oklch(0.577 0.245 27.325)"
  sidebar-surface: "oklch(0.985 0 0)"
  sidebar-blue: "oklch(0.588 0.158 241.966)"
  dark-canvas: "oklch(0.145 0 0)"
  dark-surface: "oklch(0.205 0 0)"
  dark-muted-surface: "oklch(0.269 0 0)"
  dark-muted-ink: "oklch(0.708 0 0)"
  dark-work-blue: "oklch(0.443 0.11 240.79)"
typography:
  body:
    fontFamily: "Inter Variable, sans-serif"
    fontWeight: 400
  title:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: "2rem"
  label:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    letterSpacing: "0.05em"
  technical:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
rounded:
  sm: "0.375rem"
  md: "0.625rem"
  lg: "0.75rem"
spacing:
  compact: "0.5rem"
  control: "0.75rem"
  section: "1.5rem"
  page: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.work-blue}"
    textColor: "{colors.work-blue-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  button-outline:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  button-secondary:
    backgroundColor: "{colors.secondary-surface}"
    textColor: "{colors.secondary-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  button-destructive:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.canvas}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  input-default:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0.25rem 0.75rem"
    height: "2.25rem"
  card-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "1rem"
---

# Design System: Pass GUI

## Overview

**Creative North Star: "Zen Workbench"**

Pass GUI is a quiet local-first desktop workspace. White and near-white surfaces leave room for the password store itself; a cool work-blue marks intent, selection, and primary action without turning every control into an announcement. The visual language should feel dependable to experienced UNIX users and humane to newcomers.

Use low default density, strong grouping, and generous page breathing room. Technical values and paths switch to monospace as a precision cue; everything explanatory stays in Inter. Motion is brief and functional: reveal state, confirm action, or preserve spatial orientation, then disappear.

**Key Characteristics:**
- Calm at rest; tactile under direct interaction.
- One deliberate blue accent against neutral surfaces.
- Monospace signals data, paths, secrets, and technical values.
- Borders and tonal surfaces establish hierarchy; ambient lift is reserved for transient layers.
- Advanced operations remain reachable without crowding primary workflows.

## Colors

A neutral canvas lets encrypted-store content lead; cool blue is scarce, intentional, and functional.

### Primary
- **Workbench Blue:** Primary action, selection, links, and keyboard focus. Keep it associated with intent and active work, not decoration.

### Neutral
- **Open Canvas:** Default application background and clean form surface.
- **Quiet Surface:** Muted groups, protected-value containers, and secondary information areas.
- **Graphite Ink:** Primary reading color for entry names, settings, and actions.
- **Soft Ink:** Secondary labels, placeholders, supporting text, and inactive affordances.
- **Fine Line:** Structural boundaries between panes, rows, and inputs.
- **Sidebar Surface:** Near-white navigation field, distinct from the working canvas only through a slight tonal shift.
- **Focus Ring:** Neutral gray focus halo. It pairs with border change so keyboard focus remains unmistakable in both themes.

### Secondary
- **Cool Secondary Surface:** Quiet grouped action background for secondary buttons and low-emphasis controls.

### Tertiary
- **Destructive Red:** Delete and irreversible action language only.

**The One-Accent Rule.** Workbench Blue is the only expressive accent. Use it for state and action; do not use it as broad decoration or a second background system.

### Dark Mode

Dark mode retains the same semantic hierarchy: near-black canvas, charcoal surfaces, translucent white boundaries, muted gray supporting text, and a deeper Workbench Blue. It is a complete operating theme, not an inverted decorative treatment.

## Typography

**Display Font:** Inter Variable (with system sans-serif fallback)
**Body Font:** Inter Variable (with system sans-serif fallback)
**Label/Mono Font:** System monospace stack for password-store paths, secrets, metadata values, and command-adjacent content.

**Character:** Inter keeps navigation and beginner-facing copy calm and legible. Monospace appears as a semantic tool, never as a replacement for general interface reading.

### Hierarchy
- **Title:** Bold, 1.5rem / 2rem line-height. Settings and page-level context.
- **Body:** Regular, 0.875rem in component usage. Main interface text and explanations.
- **Label:** Medium, 0.75rem with tracked uppercase where labels identify structured data groups.
- **Technical:** Monospace, 0.875rem. Paths, passwords, metadata values, and other `pass`-native data.

**The Technical-Only Mono Rule.** Use monospace for information users may copy, inspect, or recognize from a terminal. Keep prose and navigation in Inter.

## Layout

The main workspace is a horizontal, resizable two-pane layout: password-store navigation begins near 22% width with a 12% minimum; details fill remaining space. The sidebar has its own header, search, action row, and tree, separated from details by a resizable divider.

Settings center in a readable 48rem container with 1.5rem horizontal padding and 2rem vertical padding. Interface rhythm uses compact 0.5rem gaps inside controls, 0.75rem control padding, 1.5rem section spacing, and 2rem page spacing. Desktop is primary; preserve usable minimum window dimensions rather than collapsing mature desktop flows into mobile patterns.

The application enforces an 800px minimum desktop window width. Do not imitate mobile navigation patterns inside the desktop shell.

## Elevation & Depth

Depth is mostly tonal and structural: fine borders, muted panels, and pane separation do the continuous work. Use subtle ambient lift only for temporary layers such as dialogs, menus, and popovers. Base cards remain flat, outlined, and quiet.

**The Lift-on-Arrival Rule.** Ambient shadow signals a layer that has arrived above current work. Do not add shadows to ordinary rows, cards, or page sections.

## Shapes

Controls are gently rounded and compact: 0.375rem corners for buttons and fields, 0.625rem for grouped entry-value areas, and 0.75rem for cards. Forms stay rectilinear, with thin borders and no ornamental geometry. Icon buttons follow same compact rounded language.

## Components

### Buttons
- **Shape:** Compact gentle corners (0.375rem).
- **Primary:** Workbench Blue with light foreground; 2.25rem height and 1rem horizontal padding.
- **Outline:** Canvas background, thin boundary, and quiet hover surface; default for secondary entry operations.
- **Secondary:** Cool secondary surface and dark ink; use when an action belongs beside, but does not compete with, primary action.
- **Ghost:** Background-free until hover; use for local utility actions and icon-only controls.
- **Destructive:** Destructive red with white text; reserve for confirmed irreversible operations.
- **Hover / Focus:** Hover shifts surface or primary intensity. Focus remains unmistakable through blue ring treatment.

### Cards / Containers
- **Corner Style:** Rounded containers (0.75rem).
- **Background:** Surface background with a restrained foreground ring.
- **Shadow Strategy:** Flat by default; transient layers alone receive ambient lift.
- **Internal Padding:** 1rem vertical base padding, tightened for small cards.

### Inputs / Fields
- **Style:** Transparent or canvas field surface, thin line, compact 2.25rem height, 0.375rem corners.
- **Focus:** Visible blue border and ring; never rely on color shift alone.
- **Error / Disabled:** Destructive border/ring for invalid values; reduced opacity and blocked pointer interaction when disabled.

### Navigation
- **Sidebar:** Light neutral pane with a bottom boundary at its header and dense but breathable tree controls.
- **Active Work:** Primary blue identifies active navigation and operational state; muted surface supports hover.
- **Resizing:** Two-pane workspace preserves user-selected proportions through direct resizable divider interaction.

### Password Value Groups
- **Style:** Muted, outlined group with monospace value treatment and compact reveal/copy controls.
- **Purpose:** Keeps sensitive or technical data visually distinct from explanatory copy without adding visual drama.

## Do's and Don'ts

### Do:
- **Do** keep primary blue limited to explicit action, active state, links, and focus.
- **Do** use monospace for `pass` entry paths, values, secrets, and metadata.
- **Do** group related actions with thin borders and muted surfaces before reaching for cards or shadows.
- **Do** keep settings content within readable desktop measure instead of spreading controls edge to edge.
- **Do** keep destructive actions visually distinct and named plainly.

### Don't:
- **Don't** introduce a second decorative accent color.
- **Don't** put prose, navigation, or beginner-oriented help in monospace.
- **Don't** add persistent shadows to cards, list rows, or ordinary form groups.
- **Don't** make every advanced operation visible at equal weight to create, search, edit, and copy.
- **Don't** use color as sole state or focus indicator.
