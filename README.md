# The Week's Table — Meal Planner

A single-file weekly meal planner for a family of three, with per-person portions, macros and a grocery list.

- **Desktop (> 760px):** the full grid, queue and recipe library with drag-and-drop.
- **Mobile (≤ 760px):** a tabbed app —
  - **Discover** — search/filter recipes, queue them or add straight to a day
  - **Today** — one day at a time; switch days with the day strip, arrows or a swipe
  - **Grocery** — auto-totalled checklist; tap an ingredient to jump to the meals that use it
  - **Queue** — staged recipes, each with a *Place* button
  - **Profile icon** — dashboard with calories by day, macros vs goal, estimated micronutrients and a plan breakdown

Everything lives in `index.html`; state is saved in the browser's localStorage.

Micronutrient figures are rough estimates (±25%) against general adult reference intakes — edit `MICROS` and `MICRO_TARGET` in the script to tune them.
