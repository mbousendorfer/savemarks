# Design QA — tag navigation

- source visual truth path: `/private/tmp/codex-clipboard-47560e64-df0e-4717-9caf-0f88793e66c4.png`
- implementation URL: `http://localhost:3210/`
- implementation screenshot path: `/private/tmp/savemarks-navigation-tags-main.png`
- viewport: `1440 × 1000` CSS px in the Codex in-app Browser
- source pixels: `598 × 1296`
- implementation pixels: `1440 × 1000`; focused implementation sidebar crop: `232 × 700`
- density normalization: the reference appears to be a roughly 2× sidebar capture. For focused comparison it was scaled to 648 px high; the implementation sidebar was cropped from the browser-rendered page, independently scaled to 648 px high, and both were padded to equal 299 px columns without changing aspect ratio.
- state: dark theme, All collection, no selected tag, production-like local bookmark data
- primary interactions tested: library “Without tags” activation and second-click deactivation, Web “Without tags” filtering, tag state synchronization with the existing select, navigation overflow geometry, and fixed footer placement
- console errors checked: yes; 0 errors on `/` and `/web`

## Full-view comparison evidence

`/private/tmp/savemarks-navigation-tags-main.png`

The implementation preserves the existing SaveMarks shell while adding the reference hierarchy: primary collections, sources/formats, a “Without tags” filter, and a dedicated Tags section with right-aligned counts.

## Focused region comparison evidence

`/private/tmp/savemarks-navigation-tags-comparison.png`

The focused comparison confirms matching left alignment, icon/title/count columns, restrained dark surfaces, compact row rhythm, uppercase section labels, and a clear selected state. SaveMarks intentionally keeps its existing TUI typography, green accent, brand header, source filters, and system footer rather than cloning the reference product chrome.

## Findings

- No actionable P0, P1, or P2 differences remain.
- Fonts and typography: existing Public Sans and IBM Plex Mono remain consistent with SaveMarks. Navigation items retain a readable 14 px semibold label; section labels and counters use the established compact mono hierarchy.
- Spacing and layout rhythm: each entry keeps the existing 19 px icon / flexible label / auto counter grid. The navigation body now owns vertical scrolling, while the brand and system footer remain fixed and visible.
- Colors and visual tokens: active tags reuse the product's existing panel, line, ink, muted, and accent tokens. No new hard-coded theme palette was introduced.
- Image quality and asset fidelity: this navigation contains no raster assets. Hash and filter marks use the existing Phosphor icon library; no handmade SVG, text glyph, or CSS-drawn icon was added.
- Copy and content: “Filters”, “Without tags”, “Tags”, tag names, and counts reproduce the information model from the reference. The empty state “No tags yet” is shown when the collection has no tags.
- Functional data: the social library derives counts from all non-archived bookmarks. The Web library receives server-computed facets and counts, so the sidebar does not change as cursor-paginated rows load.

## Comparison history

1. Initial focused comparison found no P0/P1/P2 visual mismatch. The data fixture contains no tags, so the implemented empty state is visible instead of the reference's four populated tag rows.
2. Functional validation found a P2 navigation affordance gap: an active tag initially had no direct way to clear itself from the sidebar. Fixed by making active tag and “Without tags” buttons toggle back to “All tags” on a second click. Post-fix browser evidence confirmed `aria-pressed` transitions from `false` to `true` and back to `false`.

## Residual test gaps

- The current local dataset contains zero tags. Populated rows and long tag-name ellipsis were validated from rendered component structure and CSS, while the browser-rendered evidence covers the real empty state.
- The mobile layout intentionally hides the desktop sidebar at 820 px and below; mobile tag filtering remains available through the existing Tag select rather than duplicating the desktop navigation.

final result: passed
