# Design Tokens

Define tokens as CSS variables in `apps/web/src/styles/tokens.css` and expose them through Tailwind config.

## Color

Use a neutral productivity palette with restrained accents. Avoid a single dominant hue family.

- `--color-bg`: app background.
- `--color-surface`: panels, menus, dialogs.
- `--color-surface-muted`: sidebar and table headers.
- `--color-border`: borders and dividers.
- `--color-text`: primary text.
- `--color-text-muted`: secondary text.
- `--color-accent`: primary action/focus.
- `--color-accent-muted`: selected row/card background.
- `--color-danger`: destructive actions.
- `--color-warning`: partial failure/indexing.
- `--color-success`: completed/synced.

## Type

- UI font: system sans.
- Base size: `14px`.
- Compact metadata: `12px`.
- Page headings: `20px` to `24px`.
- Do not scale font size with viewport width.
- Letter spacing: `0`.

## Spacing

- Base unit: `4px`.
- Common gaps: `8px`, `12px`, `16px`, `24px`.
- Dense controls use `32px` height.
- Standard buttons/inputs use `36px` or `40px` height.

## Radius

- Cards, menus, dialogs: max `8px`.
- Buttons/inputs: `6px`.
- Thumbnails may use `6px`.

## Elevation

- Prefer borders over heavy shadows.
- Use one subtle shadow token for menus/dialogs only.

## Media Sizes

- `thumb_sm`: `256px` max side.
- `thumb_md`: `512px` max side.
- `preview`: `1600px` max side.
- Grid cells must define stable aspect ratio and dimensions.
