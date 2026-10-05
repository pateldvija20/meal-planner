# The Week's Table — Meal Planner

**Live:** https://pateldvija20.github.io/meal-planner/ · personal views: [`#dvija`](https://pateldvija20.github.io/meal-planner/#dvija) · [`#akshar`](https://pateldvija20.github.io/meal-planner/#akshar) · [`#aum`](https://pateldvija20.github.io/meal-planner/#aum)

A weekly meal planner for a family of three: per-person portions sized to calorie targets, family-batch cooking with leftover lunches, a grocery list split by store, and personal trackers. Synced between phones with Firebase.

## How the week works
- **Every day:** morning seed water → heavy breakfast → protein shake → lunch → (weekly snack) → dinner.
- **Leftovers:** Mon–Fri lunch is the previous night's dinner, so Sun–Thu dinners are cooked as a double batch. Weekend lunches are fresh.
- **Diet rules:** Dvija vegetarian; Akshar & Aum get chicken 1–2× a week on a shared base (veg protein for Dvija), never Thursday or Saturday; Aum eats farali on Thursday.
- **Generate:** "Add to plan" queues a recipe; Generate places the queue first, then fills the week from the library. The week refreshes automatically the first time anyone opens the site after Sunday 9 pm.
- **Weekly snack box:** one no-added-sugar recipe batch-made on Sunday.
- **Skipped / ate out:** mark any meal; totals, cooking batches and the grocery list adjust.

## Targets (Mifflin-St Jeor)
| | Target | Protein |
|---|---|---|
| Dvija | 1,650 kcal (lose 0.5 kg/wk) | 120 g |
| Akshar | 2,550 kcal (lean gain) | 115 g |
| Aum | 2,650 kcal (lean gain) | 120 g |

Logging a new weight in the tracker can recalculate a target.

## Code
| File | What it holds |
|---|---|
| `index.html`, `css/styles.css` | Page and styles (desktop grid + mobile tab app) |
| `js/foods.js` | Food composition table (per 100 g, USDA/IFCT) with grocery aisle and default store |
| `js/recipes.js`, `js/recipes-library.js`, `js/recipes-snacks.js` | Recipes, written per standard serving |
| `js/model.js` | Targets, portions, leftovers, batches, grocery, generator, weekly refresh |
| `js/sync.js` | Google sign-in + shared Firestore plan (`family/main`) |
| `js/trackers.js` | Personal trackers (`trackers/{person}`) and Dvija's private cycle log |
| `js/ui.js` | Rendering and interactions |
| `firestore.rules` | Database access: family emails only; trackers owner-write; cycle log private |

Nutrition figures are estimates (±10–25%), not lab data.
