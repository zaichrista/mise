# Deploy Pot & Page

The important files are at the repository root: `index.html`, `styles.css`, `app.js`, `recipe.js`, `recipe-import.js`, `photos.js`, `theme.js`, `app-config.js`, `pwa.js`, `manifest.webmanifest`, and the ready-to-serve `sw.js`. Keep `icons/` and `vendor/` alongside them. There is no enclosing project folder to move or unzip.

## Recommended: GitHub Actions

1. Open the repository's **Settings → Pages**.
2. Under **Build and deployment**, select **GitHub Actions** as the source.
3. Push to `main`, or run **Deploy Pot & Page to GitHub Pages** from the **Actions** tab.
4. Open the URL shown on the successful deployment.

The workflow in `.github/workflows/pages.yml` checks and tests the app, builds a clean `dist/`, and deploys only the website files. GitHub requires workflow files inside `.github/workflows/`.

## Alternative: publish the repository root

The checked-in root is also ready for static hosting. In **Settings → Pages**, choose **Deploy from a branch**, then **main** and **/(root)**. Disable the Actions deployment workflow if switching to this method so only one publishing method is active. After editing application assets, run `npm run build` and commit the updated root `sw.js` alongside your changes so offline updates receive a fresh cache version.

## Commands

```sh
npm start          # Local development with URL importing
npm run check     # Syntax checks
npm test          # Tests, including static/offline deployment checks
npm run build     # Refresh root sw.js and build dist/
npm run package   # Build website and source ZIPs in release/
```

GitHub Pages uses the static configuration: recipe writing, saved HTML/JSON recipe imports, direct URL imports where the source permits browser access, local photo storage, offline support, and home-screen installation. Sites that block direct URL access require the optional local server or a separately configured import endpoint; see README.md. Instructions for installing on phones and details about saved data are in [README.md](README.md).
