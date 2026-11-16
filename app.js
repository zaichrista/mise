/* Pot & Page: a recipe library, a recipe editor/importer, and a cooking screen.
   Screens: library -> recipe -> cook -> done, plus edit and import. */
(() => {
  const R = Recipe;
  const root = document.getElementById('app');
  const importEndpoint = window.CookConfig?.importEndpoint;
  // Keep the original storage keys so existing recipes and progress survive the rename.
  const RECIPES_KEY = 'mise-recipes-v1';
  const APP_KEY = 'mise-app-v3';

  // ---- Storage (every read/write is guarded: storage can be unavailable) ----
  const readJSON = (key) => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
  const writeJSON = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
  const validRecipe = (r) => r && typeof r.id === 'string' && typeof r.title === 'string' && Array.isArray(r.ingredients) && Array.isArray(r.steps) && r.steps.length > 0;
  const validTimer = (t) => t && typeof t.id === 'string' && Number.isFinite(t.endsAt) && ['running', 'finished', 'acked'].includes(t.state);

  let recipes = (readJSON(RECIPES_KEY) || [R.sample]).filter(validRecipe);
  const savedApp = readJSON(APP_KEY) || {};
  const sessions = {};
  for (const [id, s] of Object.entries(savedApp.sessions || {})) {
    const r = recipes.find((x) => x.id === id);
    if (r && s) sessions[id] = { step: Math.min(r.steps.length - 1, Math.max(0, Math.round(Number(s.step)) || 0)), servings: R.clampServings(s.servings ?? r.baseServings), timers: Array.isArray(s.timers) ? s.timers.filter(validTimer) : [] };
  }
  const state = {
    screen: 'library', recipeId: null, draft: null, notice: '', error: '', url: '', busy: false, confirmDelete: false, speaking: false, focus: null, photoBusy: false, photoError: '', photoSkipped: false, importHtml: ''
  };
  if (['recipe', 'cook', 'done'].includes(savedApp.screen) && recipes.some((r) => r.id === savedApp.recipeId)) { state.screen = savedApp.screen; state.recipeId = savedApp.recipeId; }

  const saveRecipes = () => writeJSON(RECIPES_KEY, recipes);
  const save = () => writeJSON(APP_KEY, { screen: ['recipe', 'cook', 'done'].includes(state.screen) ? state.screen : 'library', recipeId: state.recipeId, sessions });

  const current = () => recipes.find((r) => r.id === state.recipeId);
  const sessionOf = (r) => (sessions[r.id] ||= { step: 0, servings: r.baseServings, timers: [] });
  const inProgress = (r) => { const s = sessions[r.id]; return !!s && (s.step > 0 || s.timers.length > 0); };

  // ---- Small helpers ----
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const icon = (name) => `<i data-lucide="${name}" aria-hidden="true"></i>`;
  const remaining = (t) => Math.max(0, t.endsAt - Date.now());
  function clock(ms) {
    const total = Math.ceil(ms / 1000), h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
    const mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0');
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }
  const plural = (n) => (n === 1 ? 'serving' : 'servings');
  // A short name for a step: its title, or the start of its text.
  function stepLabel(step) {
    if (step.title) return step.title.replace(/\.$/, '');
    const t = step.text.replace(/\.$/, '');
    if (t.length <= 44) return t;
    return t.slice(0, 44).replace(/\s+\S*$/, '') + '…';
  }
  const timerName = (step, n) => step.timer?.label || `Step ${n + 1}`;
  const allTimers = () => Object.entries(sessions).flatMap(([rid, s]) => s.timers.map((t) => ({ rid, t })));
  const firstFinished = () => allTimers().find((x) => x.t.state === 'finished');

  // ---- Views: shared pieces ----
  function kitchenArt(kind, extra = '') {
    const drawings = {
      bowl: `<path class="art-utensil" d="m91 24-32 51m10-48-20 48"/><path class="art-fill" d="M23 69h114c-4 39-23 57-57 57S27 108 23 69Z"/><path d="M23 69h114M63 131h34"/><path class="art-detail" d="M39 84c3 12 8 20 17 25"/>`,
      slip: `<g class="art-slip"><path class="art-fill" d="M39 20h65l19 19v102l-10-5-10 5-11-5-10 5-11-5-10 5-10-5-12 5Z"/><path d="M104 20v22h19M55 62h49M55 77h36M55 92h49M55 107h29"/><path class="art-detail" d="m93 112 8 8 17-20"/></g>`,
    };
    return `<svg class="kitchen-art art-${kind} ${extra}" viewBox="0 0 160 160" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${drawings[kind] || drawings.bowl}</svg>`;
  }
  const ingredientRows = (items) => items.map((i) => `<div class="row"><span>${esc(i.name)}${i.note ? ` <small>· ${esc(i.note)}</small>` : ''}</span><strong>${esc(i.qty)}</strong></div>`).join('');
  const mainButton = (act, ico, title, detail = '', extra = '') => `<button class="main" type="button" data-act="${act}"${extra}>${icon(ico)}<span class="main-text"><span class="main-title">${title}</span>${detail ? `<span class="main-detail">${esc(detail)}</span>` : ''}</span></button>`;

  function photoImage(item, extra = '') {
    const photo = R.normalizePhoto(item.photo);
    if (!photo) return '';
    return `<figure class="recipe-photo ${extra}"><img ${photo.source === 'upload' ? `data-photo-key="${esc(photo.key)}"` : `src="${esc(photo.url)}"`} alt="${esc(item.title || 'Recipe')}" loading="lazy" referrerpolicy="no-referrer"><span class="photo-fallback">Photo unavailable. You can add another one.</span></figure>`;
  }
  function photoControls() {
    return `<div class="photo-actions"><button class="soft" type="button" data-act="photo-camera"${state.photoBusy ? ' disabled' : ''}>${icon('camera')}Take a photo</button><button class="soft" type="button" data-act="photo-library"${state.photoBusy ? ' disabled' : ''}>${icon('image-plus')}Photo library</button></div>${state.photoBusy ? '<p class="quiet-text" role="status">Saving your photo…</p>' : ''}${state.photoError ? `<p class="error" role="alert">${esc(state.photoError)}</p>` : ''}`;
  }
  function photoEditor(item) {
    return `<section class="photo-editor" aria-label="Recipe photo">${photoImage(item) || `<div class="photo-placeholder">${icon('image-plus')}<span>A place for your finished dish</span></div>`}${photoControls()}</section>`;
  }

  // ---- Views: library ----
  function libraryView() {
    const cards = recipes.map((r) => {
      const s = sessions[r.id];
      const meta = inProgress(r) ? `<span class="live">Cooking · step ${s.step + 1} of ${r.steps.length}</span>` : `${r.ingredients.length} ingredients${r.time ? ` · ${esc(r.time)}` : ''}`;
      return `<button class="card" type="button" data-act="open" data-id="${esc(r.id)}">${photoImage(r, 'card-photo')}<span class="card-title">${esc(r.title)}</span><span class="card-meta">${meta}</span>${icon('chevron-right')}</button>`;
    }).join('');
    return `
      <header class="top"><span class="brand">pot &amp; page.</span></header>
      <main class="body">
        <div class="eyebrow">Recipes</div>
        <h1>What are we cooking?</h1>
        ${cards ? `<div class="cards">${cards}</div>` : `<div class="empty-kitchen">${kitchenArt('bowl')}<p class="lede">A little inspiration, a pinch of something good.</p><p class="quiet-text">Write your first recipe or bring one over from a link.</p></div>`}
      </main>
      <footer class="foot">
        ${mainButton('new', 'pen-line', 'Write a recipe')}
        <button class="soft wide" type="button" data-act="import">${icon('link')}Import a recipe</button>
        <details class="install-help"><summary>Keep Pot &amp; Page close</summary><p>On iPhone or iPad, open this site in Safari, then choose Share → Add to Home Screen. On Android or desktop, look for Install in your browser’s menu.</p><p>Your recipes stay in this browser. After your first online visit, the installed app also works offline.</p></details>
      </footer>`;
  }

  // ---- Views: recipe ----
  function recipeView(r) {
    const s = sessionOf(r);
    const list = R.scaleRecipe(r, s.servings);
    let host = '';
    try { host = r.source ? new URL(r.source).hostname.replace(/^www\./, '') : ''; } catch { /* ignore bad source */ }
    return `
      <header class="top">
        <button class="quiet-btn" type="button" data-act="library">${icon('chevron-left')}Recipes</button>
        <button class="quiet-btn right" type="button" data-act="edit">${icon('pencil')}Edit</button>
      </header>
      <main class="body">
        <h1>${esc(r.title)}</h1>
        ${photoEditor(r)}
        <div class="meta">
          <span class="servings">
            <button class="round" type="button" data-act="servings-down" aria-label="Fewer servings"${s.servings <= R.MIN_SERVINGS ? ' disabled' : ''}>${icon('minus')}</button>
            <b aria-live="polite" aria-atomic="true"><span class="servings-value">${s.servings}</span> <span class="servings-unit">${plural(s.servings)}</span></b>
            <button class="round" type="button" data-act="servings-up" aria-label="More servings"${s.servings >= R.MAX_SERVINGS ? ' disabled' : ''}>${icon('plus')}</button>
          </span>
          ${r.time ? `<span class="time">${icon('clock-3')}${esc(r.time)}</span>` : ''}
        </div>
        <section class="block"><div class="label">Ingredients</div>${ingredientRows(list)}</section>
        ${host ? `<p class="quiet-text left">From ${esc(host)}</p>` : ''}
      </main>
      <footer class="foot">
        ${mainButton('start', 'arrow-right', inProgress(r) ? 'Resume cooking' : 'Start cooking')}
        ${inProgress(r) ? '<button class="quiet" type="button" data-act="restart">Start from the beginning</button>' : ''}
      </footer>`;
  }

  // ---- Views: cook ----
  function timerFraction(t, step) {
    const duration = Number.isFinite(t.duration) && t.duration > 0 ? t.duration : step.timer.minutes * 60000;
    return Math.min(1, Math.max(0, remaining(t) / duration));
  }
  function timerDial(step, t) {
    return `<div class="timer-dial${t ? ' is-running' : ''}">
      <span class="timer-crown" aria-hidden="true"></span>
      <svg class="timer-ring" viewBox="0 0 240 240" aria-hidden="true">
        <circle class="timer-ring-track" cx="120" cy="120" r="108"/>
        <circle class="timer-ring-ticks" cx="120" cy="120" r="96" pathLength="60"/>
        <circle class="timer-ring-fill" cx="120" cy="120" r="108" pathLength="100"${t ? ` data-timer-ring="${esc(t.id)}"` : ''} style="stroke-dashoffset:${t ? (1 - timerFraction(t, step)) * 100 : 0}"/>
      </svg>
      <div class="timer-face"><span class="timer-face-label">${t ? 'Time remaining' : 'Ready when you are'}</span>
        <div class="clock"${t ? ` data-timer-id="${esc(t.id)}"` : ''}>${clock(t ? remaining(t) : step.timer.minutes * 60000)}</div>
        <span class="timer-face-detail">${t ? 'On the go' : 'Let’s get cooking'}</span></div>
    </div>`;
  }
  function timerBlock(step, s, n) {
    const t = s.timers.find((x) => x.id === step.id);
    const running = t?.state === 'running';
    const name = step.timer.label || `Step ${n + 1}`;
    return `<section class="timer timer-mini" aria-label="${esc(name)} stopwatch">
      <button class="timer-name quiet" type="button" data-act="goto" data-step="${n}" title="Go to this step">${esc(name)}</button>
      ${timerDial(step, running ? t : null)}
      ${running ? `<div class="timer-controls"><button class="soft" type="button" data-act="timer-plus" data-step="${n}" aria-label="Add one minute to ${esc(name)}">+1 min</button><button class="soft" type="button" data-act="timer-stop" data-step="${n}" aria-label="Stop ${esc(name)}">Stop</button></div>` : `<button class="soft timer-start" type="button" data-act="timer-start" data-step="${n}">${icon('play')}${t ? 'Restart' : 'Start'}</button>`}
    </section>`;
  }

  function cookView(r) {
    const s = sessionOf(r), step = r.steps[s.step], last = s.step === r.steps.length - 1;
    const next = r.steps[s.step + 1];
    const bars = r.steps.map((_, i) => `<span class="${i <= s.step ? 'on' : ''}${i === s.step ? ' current' : ''}"></span>`).join('');
    const ingredients = R.scaleRecipe(r, s.servings).map((item) => `<div class="row${(step.ingredients || []).includes(item.id) ? ' is-needed' : ''}"><span>${esc(item.name)}${item.note ? ` <small>· ${esc(item.note)}</small>` : ''}</span><strong>${esc(item.qty)}</strong></div>`).join('');
    const timers = r.steps.map((timedStep, n) => timedStep.timer ? timerBlock(timedStep, s, n) : '').join('');
    return `
      <header class="top"><button class="quiet-btn" type="button" data-act="exit">${icon('chevron-left')}Recipe</button><span class="count">Step ${s.step + 1} of ${r.steps.length}</span></header>
      <div class="bars" role="img" aria-label="Step ${s.step + 1} of ${r.steps.length}">${bars}</div>
      <main class="body cook-layout">
        <aside class="cook-ingredients" aria-label="Ingredients">
          <div class="eyebrow">Ingredients</div><h2>${esc(r.title)}</h2><p class="ingredient-note">${s.servings} ${plural(s.servings)} · highlighted for this step</p>
          ${ingredients}
        </aside>
        <section class="cook-recipe" aria-label="Cooking instructions">
          ${timers ? `<div class="cook-timers" aria-label="Recipe stopwatches">${timers}</div>` : '<div></div>'}
          <div class="instruction-stage"><div class="step-copy" tabindex="-1">
            <div class="eyebrow">Step ${s.step + 1} of ${r.steps.length}</div>
            ${step.title ? `<h1>${esc(step.title)}</h1><p class="lede">${esc(step.text)}</p>` : `<p class="lede big">${esc(step.text)}</p>`}
          </div></div>
          <footer class="cook-actions">
            <div class="nav"><button class="back" type="button" data-act="back" aria-label="Previous step"${s.step === 0 ? ' disabled' : ''}>${icon('arrow-left')}</button>${mainButton('next', last ? 'check' : 'arrow-right', last ? 'Finish' : 'Next', next ? stepLabel(next) : '')}</div>
            ${'speechSynthesis' in window ? `<button class="quiet" type="button" data-act="speak">${icon(state.speaking ? 'square' : 'volume-2')}${state.speaking ? 'Stop reading' : 'Read step aloud'}</button>` : ''}
          </footer>
        </section>
      </main>`;
  }

  function doneView(r) {
    const prompt = R.needsPhoto(r) && !state.photoSkipped;
    return `<header class="top"><span class="brand">pot &amp; page.</span></header>
      <main class="body center done-body">
        ${photoImage(r, 'finished-photo') || kitchenArt('bowl')}
        <div class="eyebrow">${esc(r.title)}</div><h1>À table.</h1>
        ${prompt ? `<section class="photo-prompt" aria-label="Add a photo before enjoying"><h2>Before the first bite…</h2><p class="lede">${r.photo?.source === 'internet' ? 'Make this recipe yours. Take a photo of what you made.' : 'Take a photo of your finished dish to keep in your recipe book.'}</p>${photoControls()}<button class="quiet" type="button" data-act="photo-skip">Enjoy without a photo</button></section>` : '<p class="lede">Dinner is ready. Enjoy what you’ve made.</p>'}
      </main><footer class="foot">${mainButton('again', 'rotate-ccw', 'Cook again')}<button class="quiet" type="button" data-act="library">All recipes</button></footer>`;
  }

  // ---- Views: edit ----
  function ingredientPreview(text, servings) {
    const lines = String(text).split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return '';
    return lines.map((l, i) => { const d = R.displayIngredient(R.parseIngredient(l, i), servings, servings); return `<div class="pv"><span>${esc(d.name)}${d.note ? ` · ${esc(d.note)}` : ''}</span><b>${esc(d.qty) || '–'}</b></div>`; }).join('');
  }
  function stepCard(s, i, count) {
    return `<div class="stepcard"><div class="stepnum">${i + 1}</div>
      <textarea class="field f-step" id="step-${i}" rows="2" aria-label="Step ${i + 1}" placeholder="What to do in this step">${esc(s.text)}</textarea>
      <div class="steprow"><label class="mini">${icon('timer')}<input class="field f-min" type="number" inputmode="numeric" min="0" max="600" aria-label="Timer minutes for step ${i + 1}" placeholder="–" value="${s.minutes ? esc(s.minutes) : ''}"><span>min timer</span></label>
      ${count > 1 ? `<button class="quiet-btn" type="button" data-act="step-del" data-i="${i}" aria-label="Remove step ${i + 1}">${icon('trash-2')}</button>` : ''}</div></div>`;
  }
  function editView() {
    const d = state.draft, existing = !!d.id;
    return `
      <header class="top">
        <button class="quiet-btn" type="button" data-act="cancel">${icon('chevron-left')}Cancel</button>
        <span class="count">${existing ? 'Edit recipe' : 'New recipe'}</span>
      </header>
      <main class="body form">
        ${state.notice ? `<div class="import-success">${kitchenArt('slip')}<p class="banner" role="status">${esc(state.notice)}</p></div>` : ''}
        ${photoEditor(d)}
        <label class="lab" for="f-title">Title</label>
        <input class="field" id="f-title" type="text" value="${esc(d.title)}" placeholder="Lemon &amp; herb pasta" autocomplete="off">
        <div class="two">
          <div><label class="lab" for="f-servings">Serves</label><input class="field" id="f-servings" type="number" inputmode="numeric" min="1" max="${R.MAX_SERVINGS}" value="${esc(d.baseServings)}"></div>
          <div><label class="lab" for="f-time">Time <small>(optional)</small></label><input class="field" id="f-time" type="text" value="${esc(d.time)}" placeholder="25 min" autocomplete="off"></div>
        </div>
        <label class="lab" for="f-ing">Ingredients</label>
        <textarea class="field" id="f-ing" rows="6" placeholder="200 g pasta&#10;1 lemon, zest and juice&#10;1 handful of fresh herbs&#10;salt, to taste">${esc(d.ingredientsText)}</textarea>
        <p class="hint">One per line, amount first. Amounts are rescaled when you change servings.</p>
        <div class="preview" id="ing-preview" aria-label="How the ingredients were read">${ingredientPreview(d.ingredientsText, d.baseServings)}</div>
        <div class="lab">Steps</div>
        ${d.steps.map((s, i) => stepCard(s, i, d.steps.length)).join('')}
        <button class="soft wide" type="button" data-act="step-add">${icon('plus')}Add step</button>
        <p class="hint">Tip: paste a whole method into a step and it splits into separate steps.</p>
        ${state.error ? `<p class="error" role="alert">${esc(state.error)}</p>` : ''}
        ${existing ? `<button class="quiet danger" type="button" data-act="delete">${icon('trash-2')}${state.confirmDelete ? 'Tap again to delete this recipe' : 'Delete recipe'}</button>` : ''}
      </main>
      <footer class="foot">${mainButton('save', 'check', 'Save recipe', '', state.photoBusy ? ' disabled' : '')}</footer>`;
  }

  // ---- Views: import ----
  function importView() {
    return `<header class="top"><button class="quiet-btn" type="button" data-act="cancel">${icon('chevron-left')}Cancel</button></header>
      <main class="body form import-form">${kitchenArt('slip', 'import-art')}<h1>Into your recipe book.</h1>
        <p class="lede">Bring a recipe over from a link or a saved recipe page. Check it, then make it yours.</p>
        <label class="lab" for="f-url">Recipe link</label><input class="field" id="f-url" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://…" value="${esc(state.url)}" data-autofocus>
        ${!importEndpoint ? '<p class="hint">Some websites block imports from a browser. If a link won’t open, save the recipe page as HTML and upload it below.</p>' : ''}
        <div class="import-file"><label class="lab" for="f-import-file">Upload a saved recipe page</label><input class="field" id="f-import-file" type="file" accept=".html,.htm,.json,text/html,application/json"><p class="hint">Choose an HTML page or recipe JSON file. Your file stays on this device.</p></div>
        <details class="import-source"><summary>Or paste the recipe page source</summary><label class="lab" for="f-import-html">HTML or recipe JSON</label><textarea class="field" id="f-import-html" rows="5" placeholder="Paste the saved page source here…">${esc(state.importHtml)}</textarea><button class="soft wide" type="button" data-act="import-html"${state.busy ? ' disabled' : ''}>${icon('book-plus')}Add this recipe</button></details>
        ${state.busy ? '<p class="quiet-text left" role="status">Reading your recipe…</p>' : ''}${state.error ? `<p class="error" role="alert">${esc(state.error)}</p>` : ''}
      </main><footer class="foot">${mainButton('do-import', 'download', state.busy ? 'Importing…' : 'Import from link', '', state.busy ? ' disabled' : '')}</footer>`;
  }

  function alertView() {
    const f = firstFinished();
    if (!f) return '';
    const r = recipes.find((x) => x.id === f.rid), idx = r.steps.findIndex((x) => x.id === f.t.id), step = r.steps[idx];
    const here = state.screen === 'cook' && state.recipeId === r.id && sessionOf(r).step === idx;
    const label = step.timer?.label;
    return `<div class="alert" role="alertdialog" aria-modal="true" aria-labelledby="alert-title">
      <div class="alert-inner">
        <div class="eyebrow">${icon('bell')}${esc(r.title)} · step ${idx + 1}</div>
        <h1 id="alert-title">${label ? `${esc(label)} timer is up.` : 'Timer is up.'}</h1>
        <p class="lede clamp">${esc(stepLabel(step))}</p>
        ${mainButton('ack', 'check', 'Got it', '', ' data-autofocus')}
        <div class="pair"><button class="soft" type="button" data-act="ack-plus">${icon('plus')}1 more min</button>${here ? '' : `<button class="soft" type="button" data-act="ack-go">${icon('arrow-right')}Go to step</button>`}</div>
      </div></div>`;
  }

  // ---- Rendering ----
  function syncFromDom() {
    if (state.screen === 'edit' && state.draft && root.querySelector('#f-title')) state.draft = readDraft();
    const url = root.querySelector('#f-url'); if (url) state.url = url.value;
    const html = root.querySelector('#f-import-html'); if (html) state.importHtml = html.value;
  }
  function readDraft() {
    const d = state.draft, get = (id) => root.querySelector(id)?.value ?? '';
    return {
      ...d, title: get('#f-title'), baseServings: R.clampServings(get('#f-servings') || d.baseServings), time: get('#f-time'), ingredientsText: get('#f-ing'),
      steps: [...root.querySelectorAll('.stepcard')].map((c) => ({ text: c.querySelector('.f-step').value, minutes: Math.round(Number(c.querySelector('.f-min').value)) || 0 }))
    };
  }
  // render() draws from state only. Anything that changes state first calls syncFromDom() so typed text isn't lost.
  let lastView = { screen: null, recipe: null, step: null };
  function render(cause = '') {
    const active = document.activeElement;
    const focusKey = active && root.contains(active) && active.dataset.act ? `[data-act="${active.dataset.act}"]` : null;
    const r = current();
    let html;
    if (state.screen === 'edit') html = editView();
    else if (state.screen === 'import') html = importView();
    else if (r && state.screen === 'cook') html = cookView(r);
    else if (r && state.screen === 'done') html = doneView(r);
    else if (r && state.screen === 'recipe') html = recipeView(r);
    else { state.screen = 'library'; html = libraryView(); }
    root.innerHTML = html + alertView() + (['recipe', 'edit', 'done'].includes(state.screen) ? '<input type="file" accept="image/*" capture="environment" id="photo-camera" hidden><input type="file" accept="image/*" id="photo-library" hidden>' : '');
    root.querySelectorAll('.recipe-photo img').forEach((image) => {
      image.onerror = () => { image.parentElement.dataset.missing = 'true'; };
      if (image.dataset.photoKey && window.RecipePhotos) {
        window.RecipePhotos.url(image.dataset.photoKey).then((url) => {
          if (!image.isConnected) return;
          if (url) image.src = url; else image.parentElement.dataset.missing = 'true';
        }).catch(() => { if (image.isConnected) image.parentElement.dataset.missing = 'true'; });
      }
    });
    root.dataset.screen = state.screen;
    const step = r && state.screen === 'cook' ? sessionOf(r).step : null;
    let motion = '';
    if (state.screen === 'cook' && lastView.screen === 'cook' && lastView.recipe === r.id && step !== lastView.step) motion = step > lastView.step ? 'forward' : 'backward';
    else if (state.screen === 'cook' && ['start', 'restart'].includes(cause)) motion = 'start';
    else if (state.screen === 'done' && lastView.screen !== 'done') motion = 'served';
    else if (cause === 'imported' || (cause === 'save' && lastView.screen === 'edit' && state.screen === 'recipe')) motion = 'unfold';
    root.dataset.motion = motion;
    lastView = { screen: state.screen, recipe: r?.id, step };
    const header = root.querySelector('.top');
    if (header && window.MiseTheme) {
      const tools = document.createElement('div');
      tools.className = 'top-tools';
      while (header.children.length > 1) tools.append(header.children[1]);
      tools.insertAdjacentHTML('beforeend', window.MiseTheme.markup());
      header.append(tools);
    }
    root.querySelectorAll('.main, .soft, .back, .round, .chip, .quiet, .quiet-btn').forEach((button) => {
      if (!button.closest('.servings')) button.classList.add('sponge');
    });
    if (globalThis.lucide) lucide.createIcons({ attrs: { width: 24, height: 24 } });
    const wanted = state.focus && root.querySelector(state.focus);
    const target = root.querySelector('[data-autofocus]') || wanted || (focusKey && root.querySelector(focusKey));
    target?.focus({ preventScroll: !wanted });
    state.focus = null;
    syncAlarm();
    syncWake();
  }

  // ---- Timers ----
  function tick() {
    let changed = false;
    for (const { t } of allTimers()) if (t.state === 'running' && remaining(t) <= 0) { t.state = 'finished'; changed = true; }
    if (changed) { syncFromDom(); save(); render(); return; }
    root.querySelectorAll('[data-timer-id]').forEach((el) => {
      const s = state.recipeId && sessions[state.recipeId], t = s?.timers.find((x) => x.id === el.dataset.timerId);
      if (t) { const text = clock(remaining(t)); if (el.textContent !== text) el.textContent = text; }
    });
    root.querySelectorAll('[data-timer-ring]').forEach((el) => {
      const r = current(), s = r && sessions[r.id], t = s?.timers.find((x) => x.id === el.dataset.timerRing);
      const step = r?.steps.find((x) => x.id === t?.id);
      if (t && step) el.style.strokeDashoffset = (1 - timerFraction(t, step)) * 100;
    });
  }
  function startTimer(r, step, minutes = step.timer.minutes) {
    const s = sessionOf(r);
    s.timers = s.timers.filter((t) => t.id !== step.id);
    s.timers.push({ id: step.id, endsAt: Date.now() + minutes * 60000, duration: minutes * 60000, state: 'running' });
    unlockAudio();
  }

  // ---- Alarm: repeating beep + vibration while any timer is finished and unacknowledged ----
  let audioCtx = null, alarm = null, beeps = 0;
  const baseTitle = document.title;
  function unlockAudio() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch { /* no audio available */ }
  }
  function beep() {
    try { navigator.vibrate?.([200, 100, 200]); } catch { /* ignore */ }
    if (!audioCtx || audioCtx.state !== 'running') return;
    [0, 0.22].forEach((offset) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain(), t0 = audioCtx.currentTime + offset;
      o.type = 'sine'; o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
      o.connect(g).connect(audioCtx.destination); o.start(t0); o.stop(t0 + 0.2);
    });
  }
  function syncAlarm() {
    const finished = !!firstFinished();
    if (finished && !alarm) {
      beeps = 0; beep();
      alarm = setInterval(() => { if (++beeps > 40) { clearInterval(alarm); return; } beep(); }, 1600);
    } else if (!finished && alarm) { clearInterval(alarm); alarm = null; }
    document.title = finished ? `⏰ Timer finished · ${baseTitle}` : baseTitle;
  }

  // ---- Keep the screen awake while cooking ----
  let wake = null, wakePending = false;
  async function syncWake() {
    if (!('wakeLock' in navigator) || wakePending) return;
    wakePending = true;
    try {
      if (state.screen === 'cook' && !wake && document.visibilityState === 'visible') {
        wake = await navigator.wakeLock.request('screen');
        wake.addEventListener('release', () => { wake = null; });
      } else if (state.screen !== 'cook' && wake) { await wake.release(); wake = null; }
    } catch { wake = null; /* denied or unsupported: harmless */ }
    wakePending = false;
  }
  document.addEventListener('visibilitychange', () => { syncWake(); if (document.visibilityState === 'visible') tick(); });

  // ---- Read aloud ----
  function stopSpeech() { try { speechSynthesis.cancel(); } catch { /* ignore */ } state.speaking = false; }
  function speak(r) {
    if (state.speaking) { stopSpeech(); return; }
    const s = sessionOf(r), step = r.steps[s.step];
    const needs = R.stepIngredients(r, { ingredients: step.ingredients || [] }, s.servings).map((i) => `${i.qty.replace(/ /g, ' ')} ${i.name}`);
    const u = new SpeechSynthesisUtterance(`${step.title || ''} ${step.text}${needs.length ? ' You need: ' + needs.join(', ') + '.' : ''}`);
    u.onend = u.onerror = () => { if (state.speaking) { state.speaking = false; render(); } };
    state.speaking = true;
    speechSynthesis.speak(u);
  }

  // ---- Import ----
  function acceptImport(data) {
    if (!data || !data.ingredients?.length || !data.steps?.length) throw new Error('This page doesn’t contain a complete structured recipe. Try another recipe page, or paste its ingredients and method into a new recipe.');
    let host = ''; try { host = data.source ? new URL(data.source).hostname.replace(/^www\./, '') : ''; } catch { /* Source is optional. */ }
    openEditor(R.draftFromImport(data), `Imported${host ? ' from ' + host : ''}. Check the ingredients and steps, then save to your book.`);
  }
  function importPage(text) {
    if (text.length > 3 * 1024 * 1024) throw new Error('Choose a recipe page smaller than 3 MB.');
    let source = ''; try { const url = new URL(state.url); if (/^https?:$/.test(url.protocol)) source = url.href; } catch { /* Optional source link. */ }
    acceptImport(window.RecipeImport.extractRecipe(text, source));
  }
  async function runImport() {
    if (state.busy) return;
    syncFromDom();
    let url;
    try { url = new URL(state.url.trim()); if (!/^https?:$/.test(url.protocol)) throw Error(); }
    catch { state.error = 'Paste a complete recipe link starting with https://.'; render(); return; }
    const requestedUrl = state.url;
    state.error = ''; state.busy = true; render();
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
    try {
      let data;
      if (importEndpoint) {
        const endpoint = new URL(importEndpoint, location.href); endpoint.searchParams.set('url', url.href);
        const res = await fetch(endpoint, { signal: controller.signal });
        const result = await res.json();
        if (!res.ok || !result.ok) throw new Error(result.error || 'Couldn’t import this recipe.');
        data = result.recipe;
      } else {
        const res = await fetch(url.href, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
        if (!res.ok) throw new Error('This recipe website didn’t return a page. Try uploading its saved HTML page instead.');
        const text = await window.RecipeImport.readPage(res);
        data = window.RecipeImport.extractRecipe(text, url.href);
      }
      // A completed request must not replace another screen or a newer link.
      if (state.screen === 'import' && state.url === requestedUrl) acceptImport(data);
    } catch (error) {
      if (state.screen === 'import') state.error = error.name === 'AbortError' ? 'The website took too long. Try again, or upload its saved recipe page.' : error instanceof TypeError ? 'Couldn’t read this link. Many websites block direct browser imports. Upload the saved HTML page or paste its page source below.' : error.message;
    } finally { clearTimeout(timeout); state.busy = false; syncFromDom(); render(state.screen === 'edit' ? 'imported' : ''); }
  }

  let editorSerial = 0;
  async function addPhoto(file) {
    if (!file || state.photoBusy) return;
    syncFromDom();
    const editing = state.screen === 'edit', serial = editorSerial, recipe = current();
    const previous = editing ? state.draft?.photo : recipe?.photo;
    if (!editing && !recipe) return;
    state.photoBusy = true; state.photoError = ''; render();
    let photo;
    try {
      photo = await window.RecipePhotos.save(file);
      syncFromDom();
      if (editing) {
        if (serial !== editorSerial || state.screen !== 'edit') { await window.RecipePhotos.remove(photo.key); return; }
        state.draft.photo = photo;
        if (previous?.source === 'upload' && previous.key !== recipe?.photo?.key) window.RecipePhotos.remove(previous.key).catch(() => {});
      } else {
        if (!recipes.includes(recipe)) { await window.RecipePhotos.remove(photo.key); return; }
        recipe.photo = photo;
        if (!saveRecipes()) { recipe.photo = previous; await window.RecipePhotos.remove(photo.key); throw new Error('Couldn’t save the photo to your recipe. Check that browser storage is allowed.'); }
        if (previous?.source === 'upload') window.RecipePhotos.remove(previous.key).catch(() => {});
      }
    } catch (error) { state.photoError = error.message || 'Couldn’t save that photo. Please try another.'; }
    finally { state.photoBusy = false; syncFromDom(); render(); }
  }
  root.addEventListener('change', async (event) => {
    if (event.target.id === 'photo-camera' || event.target.id === 'photo-library') { await addPhoto(event.target.files?.[0]); return; }
    if (event.target.id === 'f-import-file') {
      const file = event.target.files?.[0]; if (!file) return;
      syncFromDom(); state.error = '';
      try {
        if (file.size > 3 * 1024 * 1024) throw new Error('Choose a recipe page smaller than 3 MB.');
        const text = await file.text();
        if (state.screen !== 'import') return;
        syncFromDom(); importPage(text);
      } catch (error) { state.error = error.message; }
      render(state.screen === 'edit' ? 'imported' : '');
    }
  });

  // ---- Editing ----
  function openEditor(draft, notice = '') { editorSerial++; state.photoError = ''; state.draft = draft; state.notice = notice; state.error = ''; state.confirmDelete = false; state.screen = 'edit'; }
  function discardDraftPhoto() {
    const photo = state.draft?.photo;
    const savedPhoto = recipes.find((r) => r.id === state.draft?.id)?.photo;
    if (photo?.source === 'upload' && photo.key !== savedPhoto?.key) window.RecipePhotos?.remove(photo.key).catch(() => {});
  }
  const stripNumber = (l) => l.replace(/^\s*(?:step\s*)?\d+\s*[.):\-]\s*/i, '').trim();
  function saveDraft() {
    syncFromDom();
    const d = state.draft, err = R.validateDraft(d);
    if (err) { state.error = err; return false; }
    const r = R.buildRecipe(d, d.id);
    const i = recipes.findIndex((x) => x.id === r.id), previous = recipes[i];
    const next = [...recipes];
    if (i >= 0) next[i] = r; else next.push(r);
    if (!writeJSON(RECIPES_KEY, next)) { state.error = 'Couldn’t save the recipe. Check that browser storage is allowed and try again.'; return false; }
    recipes = next;
    if (i >= 0) delete sessions[r.id];
    if (previous?.photo?.source === 'upload' && previous.photo.key !== r.photo?.key) window.RecipePhotos?.remove(previous.photo.key).catch(() => {});
    state.recipeId = r.id; state.screen = 'recipe'; state.error = ''; state.notice = '';
    return true;
  }
  document.addEventListener('paste', (e) => {
    const t = e.target;
    if (!t.classList?.contains('f-step')) return;
    const lines = (e.clipboardData?.getData('text') || '').split(/\n+/).map(stripNumber).filter(Boolean);
    if (lines.length < 2) return;
    e.preventDefault();
    syncFromDom();
    const i = [...root.querySelectorAll('.f-step')].indexOf(t), steps = state.draft.steps;
    const fresh = lines.map((text) => ({ text, minutes: R.detectTimer(text) }));
    steps.splice(steps[i].text.trim() ? i + 1 : i, steps[i].text.trim() ? 0 : 1, ...fresh);
    state.focus = `#step-${Math.min(steps.length - 1, i + fresh.length)}`;
    render();
  });
  root.addEventListener('input', (e) => {
    if (e.target.id === 'f-ing' || e.target.id === 'f-servings') {
      const sv = R.clampServings(root.querySelector('#f-servings').value || 4);
      root.querySelector('#ing-preview').innerHTML = ingredientPreview(root.querySelector('#f-ing').value, sv);
    }
    if (e.target.id === 'f-url') state.url = e.target.value;
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.id === 'f-url') { e.preventDefault(); runImport(); }
  });

  // ---- Actions ----
  const goStep = (r, i) => { stopSpeech(); sessionOf(r).step = Math.min(r.steps.length - 1, Math.max(0, i)); };
  const actions = {
    open: (b) => { state.recipeId = b.dataset.id; state.screen = 'recipe'; state.photoError = ''; },
    library: () => { stopSpeech(); state.screen = 'library'; },
    new: () => { state.url = ''; openEditor(R.blankDraft()); state.focus = '#f-title'; },
    import: () => { state.error = ''; state.url = ''; state.importHtml = ''; state.screen = 'import'; },
    'import-html': () => { syncFromDom(); try { importPage(state.importHtml); } catch (error) { state.error = error.message; } },
    'do-import': () => runImport(),
    edit: () => openEditor(R.draftFromRecipe(current())),
    cancel: () => { if (state.screen === 'edit') discardDraftPhoto(); state.error = ''; state.notice = ''; state.photoError = ''; state.screen = state.draft?.id && state.screen === 'edit' ? 'recipe' : 'library'; if (state.screen === 'library') state.recipeId = null; state.draft = null; },
    save: () => saveDraft(),
    delete: () => {
      if (!state.confirmDelete) { state.confirmDelete = true; return; }
      const id = state.draft.id, old = recipes.find((r) => r.id === id), next = recipes.filter((r) => r.id !== id);
      if (!writeJSON(RECIPES_KEY, next)) { state.error = 'Couldn’t delete the saved recipe. Check that browser storage is allowed.'; state.confirmDelete = false; return; }
      discardDraftPhoto();
      if (old?.photo?.source === 'upload') window.RecipePhotos?.remove(old.photo.key).catch(() => {});
      recipes = next; delete sessions[id];
      state.draft = null; state.recipeId = null; state.screen = 'library'; state.confirmDelete = false;
    },
    'step-add': () => { syncFromDom(); state.draft.steps.push({ text: '', minutes: 0 }); state.focus = `#step-${state.draft.steps.length - 1}`; },
    'step-del': (b) => { syncFromDom(); state.draft.steps.splice(Number(b.dataset.i), 1); if (!state.draft.steps.length) state.draft.steps.push({ text: '', minutes: 0 }); },
    'servings-up': () => { const s = sessionOf(current()); s.servings = R.clampServings(s.servings + 1); },
    'servings-down': () => { const s = sessionOf(current()); s.servings = R.clampServings(s.servings - 1); },
    start: () => { state.screen = 'cook'; state.photoSkipped = false; unlockAudio(); },
    restart: () => { delete sessions[state.recipeId]; state.screen = 'cook'; unlockAudio(); },
    exit: () => { stopSpeech(); state.screen = 'recipe'; },
    next: () => { const r = current(); if (sessionOf(r).step === r.steps.length - 1) { stopSpeech(); state.screen = 'done'; state.photoSkipped = false; } else goStep(r, sessionOf(r).step + 1); },
    back: () => { const r = current(); goStep(r, sessionOf(r).step - 1); },
    goto: (b) => goStep(current(), Number(b.dataset.step)),
    'timer-start': (b) => { const r = current(); startTimer(r, r.steps[b.dataset.step ?? sessionOf(r).step]); },
    'timer-plus': (b) => { const r = current(), s = sessionOf(r), step = r.steps[b.dataset.step ?? s.step], t = s.timers.find((x) => x.id === step.id); if (t) { t.endsAt += 60000; t.duration = (t.duration || step.timer.minutes * 60000) + 60000; } },
    'timer-stop': (b) => { const r = current(), s = sessionOf(r); s.timers = s.timers.filter((t) => t.id !== r.steps[b.dataset.step ?? s.step].id); },
    ack: () => { allTimers().filter((x) => x.t.state === 'finished').forEach((x) => { x.t.state = 'acked'; }); },
    'ack-plus': () => { const f = firstFinished(); if (f) { const r = recipes.find((x) => x.id === f.rid); startTimer(r, r.steps.find((s) => s.id === f.t.id), 1); } },
    'ack-go': () => {
      const f = firstFinished(); if (!f) return;
      const r = recipes.find((x) => x.id === f.rid);
      f.t.state = 'acked'; state.recipeId = r.id; state.screen = 'cook'; goStep(r, r.steps.findIndex((s) => s.id === f.t.id));
    },
    'photo-camera': () => root.querySelector('#photo-camera')?.click(),
    'photo-library': () => root.querySelector('#photo-library')?.click(),
    'photo-skip': () => { state.photoSkipped = true; },
    speak: () => speak(current()),
    again: () => { delete sessions[state.recipeId]; state.screen = 'recipe'; }
  };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  function animateValue(el, direction) {
    if (!el || reducedMotion.matches || !el.animate) return;
    const currentTransform = getComputedStyle(el).transform;
    el.getAnimations().forEach((animation) => animation.cancel());
    el.animate([
      { transform: currentTransform === 'none' ? `translateY(${direction * 7}px) scale(.94)` : currentTransform },
      { transform: 'translateY(0) scale(1.06)', offset: .65 },
      { transform: 'translateY(0) scale(1)' }
    ], { duration: 260, easing: 'cubic-bezier(.2,.7,.3,1)' });
  }
  // Keep these controls mounted so rapid taps and keyboard focus remain continuous.
  function updateServings(direction) {
    const r = current(), s = sessionOf(r);
    const value = root.querySelector('.servings-value');
    value.textContent = s.servings;
    root.querySelector('.servings-unit').textContent = plural(s.servings);
    animateValue(value, direction);
    root.querySelector('[data-act="servings-down"]').disabled = s.servings <= R.MIN_SERVINGS;
    root.querySelector('[data-act="servings-up"]').disabled = s.servings >= R.MAX_SERVINGS;
    const rows = root.querySelectorAll('.block .row');
    R.scaleRecipe(r, s.servings).forEach((item, i) => {
      const row = rows[i], quantity = row?.querySelector('strong');
      // Countable ingredients can also change their name (one egg / two eggs).
      if (row) row.querySelector('span').innerHTML = `${esc(item.name)}${item.note ? ` <small>· ${esc(item.note)}</small>` : ''}`;
      if (quantity && quantity.textContent !== item.qty) {
        quantity.style.minWidth = `${quantity.offsetWidth}px`;
        quantity.textContent = item.qty;
        animateValue(quantity, direction);
      }
    });
  }
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled || !actions[b.dataset.act]) return;
    if (b.dataset.act === 'photo-camera' || b.dataset.act === 'photo-library') { actions[b.dataset.act](b); return; }
    if (b.dataset.act !== 'delete') state.confirmDelete = false;
    syncFromDom();
    actions[b.dataset.act](b);
    save();
    if (b.dataset.act.startsWith('servings-')) { updateServings(b.dataset.act === 'servings-up' ? 1 : -1); return; }
    render(b.dataset.act);
    if (b.dataset.act === 'timer-start') root.querySelector(`[data-timer-ring="${current().steps[b.dataset.step ?? sessionOf(current()).step].id}"]`)?.closest('.timer-dial')?.classList.add('just-started');
  });
  // Arrow keys step through the recipe (not while the timer alert is up).
  document.addEventListener('keydown', (e) => {
    if (state.screen !== 'cook' || firstFinished() || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowRight') actions.next(); else if (e.key === 'ArrowLeft') actions.back(); else return;
    save(); render();
  });
  document.addEventListener('pointerdown', unlockAudio, { once: true });

  setInterval(tick, 250);
  render();
})();
