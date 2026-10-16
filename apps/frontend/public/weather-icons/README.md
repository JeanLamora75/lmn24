# Meteocons Flat (static SVG) — SCRUM-76

These SVG assets are copied from the **Meteocons** static Flat collection,
designed by **Bas Milius** and licensed under the **MIT License**.

- Project: https://github.com/basmilius/meteocons
- Author and artwork: https://meteocons.com/
- Static Flat SVG source files mirrored in:
  https://github.com/tempi-marathon/blade-meteocons/tree/main/resources/svg
  (files named `static-flat-*.svg`)
- Copyright notice and full license: `LICENSE-METEOCONS.txt`.

LMN24 preserves the authors' MIT license notice. SVG files are served as
**local assets** under `/weather-icons/` (no CDN, no animation, no runtime
dependency and no external requests for weather icons).

The fixed WMO / is_day mapping lives in
`apps/frontend/src/components/weather/weather-icons.ts`. Icons are selected
only from an explicit allowlist. There is a local `not-available.svg` fallback.

The public cards show descriptive translated conditions as text; their icons
are decorative (empty alt text), so screen-reader users receive the same
information without duplicated announcements.
