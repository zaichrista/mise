# Pot & Page

A little joy in the kitchen. Save recipes and your own food photos, scale servings, and cook with ingredients on the left, vertically centred instructions on the right, and compact stopwatches at the top. A responsive website and installable progressive web app, ready for GitHub Pages.

**Start here:** [Deploy to GitHub Pages](DEPLOY.md). The live app files and web-app metadata sit at the repository root, ready to serve. Supporting icons, vendor code, scripts, and tests stay in their own folders.

## Run locally

Requires Node.js 22 or newer. No dependencies or installation step.

```sh
npm start
```

Open http://127.0.0.1:5173. This local server also supports importing recipe links from sites with structured Recipe data. It rejects private network addresses and non-HTTP links.

```sh
npm run check
npm test
npm run build
npm run package
```

- `dist/` is the complete static website. Serve it over HTTP to preview production; do not open it using `file://`.
- `release/pot-and-page-website.zip` contains the built site, with `index.html` at its root.
- `release/pot-and-page-source.zip` contains source, tests, icons, and the GitHub Actions workflow. Use this archive when creating your GitHub repository.

## Deploy on GitHub Pages

1. Create a GitHub repository, for example `pot-and-page`, with `main` as its default branch.
2. Extract **pot-and-page-source.zip** and put its contents at the repository root. Include the hidden `.github/` folder containing `workflows/pages.yml`.
3. Select **Settings → Pages → Build and deployment → Source → GitHub Actions** in the repository.
4. Push to `main`, or run **Actions → Deploy Pot & Page to GitHub Pages → Run workflow**.
5. When deployment finishes, open the website URL shown on the workflow's deployment.

The workflow checks syntax, runs tests, builds `dist/`, then uploads and deploys it. Pull requests run checks/build without deployment. If your branch has another name, update `branches: [main]` in the workflow. All asset, manifest, launch, and service worker paths are relative, so repository sites (`https://USERNAME.github.io/pot-and-page/`), account sites, and custom domains work without editing a base URL.

GitHub Pages requires a public repository on GitHub Free; private-repository Pages availability depends on your plan. GitHub's workflow documentation: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

### Recipe imports on static hosting

**Import a recipe** is available on GitHub Pages as well as locally:

- Paste a link. The static website fetches it directly if the recipe site allows cross-origin browser access. Many publishers block this, so it cannot work with every URL.
- Upload a saved HTML recipe page or schema.org Recipe JSON file, or paste the page source. These are parsed on your device; page scripts never run. You can check and edit the result before saving it to your book.
- When a link is blocked, save that recipe page as HTML in your browser and use the upload option. The site must include structured Recipe data; otherwise write or paste the ingredients and method into a new recipe.
- For broad URL support, configure `importEndpoint` in `app-config.js` to a separately hosted importer with CORS enabled for your website. The expected response is `{ "ok": true, "recipe": { "title": "…", "ingredients": [], "steps": [], "image": "https://…" } }` or `{ "ok": false, "error": "…" }`. The endpoint receives a `url` query parameter. GitHub Pages itself cannot run this server.
- `npm start` keeps the existing public-URL-only Node importer available automatically. The static website does not use an undisclosed third-party proxy.

Imported recipe images are marked as internet photos. After cooking, you are prompted to replace an internet image or add a missing image with a photo of your own.

## Install as an app

- **iPhone/iPad:** open the deployed site in Safari, choose Share → Add to Home Screen, and enable Open as Web App if offered.
- **Android:** open it in Chrome and choose Install app / Add to Home screen from the browser menu.
- **Desktop:** use the install icon or Install option when offered by your browser.

Installation UI varies by browser. Included: manifest, standalone launch mode, 192px/512px icons, a maskable icon, and an Apple touch icon. See https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable

After an online visit finishes caching the app, recipes, editing, serving calculations, and cooking work offline. No external fonts or CDNs are required. Each build gets a content-versioned cache. Updates wait until the old app's tabs/windows close, so the page will not reload while you cook. Offline support is enabled in production; local development does not register a worker.

## Data and timers

Recipes, theme, cooking progress, and timer end times stay in browser localStorage. Photos you take or select from the photo library are resized (longest edge up to 1600px) and stored as image Blobs in IndexedDB on this device. They are not uploaded to a server and remain available offline.

The recipe page and editor both offer **Take a photo** and **Photo library**. Supported phones open the rear camera for the camera action; other devices may open a file picker. Completion prompts appear only when no photo exists or the current image came from the internet. A photo you uploaded suppresses the prompt, including after reloading or editing the recipe. You can skip the prompt and enjoy the meal.

Original `mise-*` storage keys are preserved so this rename does not discard existing data on the same origin. Moving to another domain or browser does not transfer data. Clearing site data removes saved recipes and photos. There is no account, cross-device sync, or recipe backup/export yet.

Timers use saved end times and catch up when you return. Sound, vibration, and screen wake are browser/device dependent. A closed or suspended web app cannot guarantee a background timer alert; keep the app open for alerts. Read-aloud uses available browser speech voices and may depend on connectivity.

## Project map

| File | Purpose |
| --- | --- |
| `app.js`, `styles.css` | Screens, playful kitchen illustrations, interactions and timers |
| `recipe.js` | Recipe model, ingredient parser, serving calculations and photo provenance |
| `photos.js` | Photo resizing, IndexedDB storage and offline photo retrieval |
| `recipe-import.js` | Shared HTML/JSON recipe parser, image extraction and bounded browser reads |
| `theme.js` | Day/night spring and colour palette |
| `app-config.js` | Static hosting defaults; local server serves development settings |
| `DEPLOY.md` | Quick deployment guide for Actions or the repository root |
| `manifest.webmanifest`, `pwa.js`, `sw.js` | Installation and offline app shell |
| `icons/` | App icons, including the editable SVG saucepan mark |
| `scripts/build.mjs` | Static build; excludes server, tests and editor files |
| `scripts/sw-template.js` | Service worker source; build generates root and dist copies |
| `scripts/package.mjs` | Website and source ZIP archives |
| `scripts/generate-icons.mjs` | Reproducible app icons without dependencies |
| `.github/workflows/pages.yml` | GitHub Pages CI and deployment |
| `server.mjs`, `import-recipe.mjs` | Optional local URL importer |
| `test/` | Recipe, theme, app and deployment checks |
| `docs/` | Original design context and interaction specification |

Lucide icons are bundled locally; retain `vendor/LUCIDE-LICENSE` when redistributing.
