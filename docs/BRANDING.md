# Youtarr Branding & UI Guidelines

This document defines the design system for the new frontend: a modern, clean interface with a relatively flat look and a subtle gradient.

## Design Principles

- Flat-first: keep surfaces clean, avoid heavy shadows.
- Soft depth: use subtle borders + a gentle background gradient.
- Rounded rectangles: inputs, cards, dialogs, chips, and buttons should be rectangular with rounded corners.
- Clear hierarchy: typography + spacing should do most of the work.

## Layout

- **Top bar**: compact; contains:
  - Left: Youtarr logo + the text “Youtarr”
  - Center: (reserved for future global search/breadcrumbs)
  - Right: logout (when applicable)
- **Left navigation**:
  - Collapsed: icons only, tooltips on hover
  - Expanded: icons + labels; show “old label” as helper/secondary text
  - Bottom-left: version label
  - Bottom: storage widget (drive icon + progress bar + free-space text)

## Navigation Labels (New ↔ Old)

- Channels ↔ Your Channels
- Videos ↔ Downloaded Videos
- Downloads ↔ Manage Downloads
- Settings ↔ Configuration

## Color Palette

The app uses the Material UI theme in `client/src/theme.ts`.

- **Primary**: `#1976d2`
- **Secondary**: `#dc004e`
- **Success**: `#4caf50`
- **Warning**: `#ff9800`
- **Error**: `#d32f2f`

### Backgrounds

- Light mode:
  - `background.default`: `#fafafa`
  - `background.paper`: `#ffffff`
- Dark mode:
  - `background.default`: `#121212`
  - `background.paper`: `#1e1e1e`

### Gradient

Use a subtle vertical gradient behind main content:

- `linear-gradient(180deg, background.paper 0%, background.default 55%, background.default 100%)`

## Typography

- System-first stack (see `client/src/theme.ts`).
- Prefer:
  - Page titles: `Typography variant="h4"/"h5"` with heavier weight (`700–800`).
  - Secondary/helper: `variant="body2"` or `variant="caption"` with `color="text.secondary"`.

## Corners (Rounded Rectangles)

- Global border radius: `12px`.
- Cards can be slightly rounder: `16px`.

Applied via theme overrides in `client/src/theme.ts`:

- `shape.borderRadius = 12`
- `MuiPaper`, `MuiOutlinedInput`, `MuiButton`, `MuiChip` use rounded corners

## Elevation & Borders

- Prefer borders (`theme.palette.divider`) and low/no elevation.
- Use elevation sparingly for overlays only (dialogs/menus).

## Components

### Cards / Boxes

- Rounded rectangle.
- Use `variant="outlined"` where possible.
- Keep padding consistent; avoid nested heavy borders.

### Inputs

- Use outlined style with rounded corners.
- Labels and helper text should be concise.

### Buttons

- Rounded rectangle.
- Avoid ALL CAPS; keep `textTransform: none`.

## Iconography

- Use Material icons.
- Navigation icons should be consistent style/weight.

## Spacing

- Use consistent spacing increments (8px grid): `1, 2, 3` spacing units in MUI.
- Avoid very tight layouts; prefer whitespace for readability.
