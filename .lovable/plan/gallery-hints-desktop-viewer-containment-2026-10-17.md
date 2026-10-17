# Gallery hints + desktop viewer containment

## 1. Replace the gesture tutorial card
- Remove the glass hint card in the portfolio explorer (panel, border, close button, "↕" emoji, both explanatory lines).
- Keep a single typographic hint at the bottom of the explorer: `SCROLL TO EXPLORE ↓` — small uppercase, existing `meta` tracking, muted paper color, no background/border/glass. Shown only when there are 2+ shoots; fades on first scroll; remembered per visitor (localStorage) so it doesn't return.
- In the photoshoot viewer, change the hint to `← SWIPE TO EXPLORE →` with thin text arrows, no container; fades after the first successful swipe and is remembered.
- Existing stack demo nudges (explorer and viewer) stay exactly as they are.

## 2. Fix photos escaping the rounded overlay on desktop
Root cause: in embedded mode the viewer sizes its stage from the browser window (72% of window width / 66% of height), not from the actual glass overlay, which is narrower (max 1400px, inner padding) and shorter (header + controls). On wide or short desktop screens the stage becomes larger than the space available.

Fix at the viewer level:
- Wrap the stage in a constrained viewport (`relative`, full width/height of the space between top controls and bottom controls, `min-w-0 min-h-0 overflow-hidden`) and measure that element with a ResizeObserver; compute stage size from its measured width/height instead of the window.
- Photos keep proportional fit (contain logic already used), centered both ways, with inner padding so they never touch the rounded corners.
- The overlay panel already clips (`overflow-hidden` + radius); the new viewport clips at the parent level, so dragged cards may follow the pointer but are cut off at the boundary. No clipping on the draggable card itself, no rotation, no change to swipe direction or timing.
- Controls (Back, title, counter, close, arrows, Book) stay outside the photo viewport so images never cover them.
- Non-embedded (homepage) viewer keeps window-based sizing.

## 3. Unchanged
Explorer metadata row (name left, `03 FRAMES ↗` right), homepage, categories, studio, data, typography, glass styling.

## Verification
Playwright at 1440×900, 1920×1080, 768×1024, 390×844: open a shoot with mixed portrait/landscape frames, check every photo's box sits inside the panel's box, drag left/right mid-gesture screenshots, confirm controls visible and hints behave.
