# P2-02 JavaScript module boundary cleanup summary

## Decisions
- Keep repository-wide ESM with **named exports by default** for domain modules (services, repos, screens, data).
- Avoid exporting raw data constants unless consumed externally; expose focused accessor/list helpers instead.
- Consolidate repo-root JSON loading behind one helper (`loadRepoJson`) to keep data-layer filesystem behavior consistent.
- Remove ESM path-compat shims (`__dirname`/`fileURLToPath`) where native `new URL(..., import.meta.url)` is sufficient.

## Scope covered
- Data modules (`src/data`) now share a single JSON-loading boundary.
- Service modules removed unused exported conversion leftovers.
- Server static-root path now uses direct ESM URL resolution.
