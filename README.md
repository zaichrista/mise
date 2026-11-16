# Mise

A minimalist cooking companion. Write a recipe or import one from a link, set the servings (quantities rescale), then cook one step at a time with real timers.

## Run it

Open **index.html** in a browser, or run `npm start` and visit http://127.0.0.1:5173 (no install needed). Use your browser's responsive view for an iPad-sized preview.

`npm test` runs the scaler tests. `npm run check` syntax-checks the scripts.

## How it works

| File | Purpose |
| --- | --- |
| `recipe.js` | Recipe data model, portion scaling, ingredient-line parser, timer detection (pure functions, tested) |
| `import-recipe.mjs` | Fetches a recipe web page safely and reads its structured recipe data |
| `server.mjs` | Local server; also serves `/api/import?url=...` for the importer |
| `app.js` | Screens (library, recipe, edit, import, cook, done), timers, alarm, wake lock, read-aloud |
| `styles.css` | Colours, type, button sizes, layout |
| `test/` | Scaler, parser and importer tests |
| `prototype/` | The earlier nine-screen visual prototype, kept for reference (open `prototype/index.html`) |
| `docs/` | The original, much larger Cook Mode spec. Most of it is deliberately **not** built; treat it as a source of later ideas |

### Writing and importing

- **Write a recipe:** a title, servings, ingredients as plain lines (`200 g pasta`, `1 lemon, zest and juice`, `salt, to taste`) and steps. A live preview shows how each ingredient line was understood. Pasting a whole method into a step splits it into separate steps.
- **Smart bits:** each step is linked to the ingredients it mentions, so the cooking screen shows only what that step needs. A single clear duration in a step ("simmer for 10 minutes") becomes a timer, which you can change or clear.
- **Import from a link:** needs the local server (`npm start`). It reads the page's schema.org Recipe data, which most big recipe sites include, then opens the result in the editor so you can check it before saving. Pages without that data can't be imported; write those in yourself.
- The importer only fetches public web addresses. It refuses localhost, private network ranges and non-http(s) links, and only answers requests made from the app itself.
- Recipes are saved in your browser (localStorage). Each recipe keeps its own cooking progress and timers.

### Cooking screen

- One step at a time; big **Next** and **Back** buttons (arrow keys work too).
- Steps with a timer get a **Start timer** button. Timers keep running across steps and show as chips; tapping a chip jumps to its step.
- When a timer ends: a full-screen prompt, repeating beep, vibration and a tab-title flag, until you tap **Got it**.
- The screen stays awake while cooking (browsers that support the Wake Lock API).
- **Read step aloud** uses the browser's speech synthesis.
- Step, servings and timers are saved in localStorage, so a refresh or phone call doesn't lose your place.

### Recipe data

Recipes follow the shape documented at the top of `recipe.js`. The sample recipe lives at the bottom of that file.

Known limits: ingredient ranges ("2–3 tbsp") scale from the lower amount and say so in the note; an ingredient used in several steps shows its full amount in each; there is no export or sync between devices yet.
