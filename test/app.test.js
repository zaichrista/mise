const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const Recipe = require('../recipe.js');

// Exercise the real event handlers and persisted session with a minimal DOM surface.
function setup(saved, { reduced = false, time = 1000000, recipe = Recipe.sample, photos, fetch: fetcher } = {}) {
  const storage = { 'mise-app-v3': JSON.stringify(saved), 'mise-recipes-v1': JSON.stringify([recipe]) }, handlers = {}, intervals = [];
  let now = time, renders = 0;
  const quantityRows = Recipe.scaleRecipe(Recipe.sample, 2).map((item) => {
    const name = { innerHTML: item.name };
    const qty = { textContent: item.qty, style: {}, offsetWidth: 50, animate() {}, getAnimations: () => [] };
    return { name, qty, querySelector: (selector) => selector === 'span' ? name : qty };
  });
  const value = { textContent: '2', animate() {}, getAnimations: () => [] };
  const nodes = { '.servings-value': value, '.servings-unit': {}, '[data-act="servings-down"]': {}, '[data-act="servings-up"]': {} };
  const ring = { dataset: { timerRing: 'sauce' }, style: {} };
  const root = {
    dataset: {}, contains: () => false,
    set innerHTML(html) { this.html = html; renders++; },
    querySelector: (selector) => nodes[selector] || null,
    querySelectorAll: (selector) => selector === '.block .row' ? quantityRows : selector === '[data-timer-ring]' ? [ring] : [],
    addEventListener: (name, fn) => { handlers[name] = fn; }
  };
  const context = {
    Recipe, document: { getElementById: () => root, addEventListener() {}, title: 'Mise' },
    localStorage: { getItem: (key) => storage[key] || null, setItem: (key, val) => { storage[key] = val; } },
    window: { RecipePhotos: photos, RecipeImport: require('../recipe-import.js') }, navigator: {}, URL, TypeError, AbortController, setTimeout, clearTimeout, fetch: fetcher, location: { href: 'https://example.github.io/book/', protocol: 'https:' }, matchMedia: () => ({ matches: reduced }),
    getComputedStyle: () => ({ transform: 'none' }),
    setInterval: (fn) => { intervals.push(fn); return intervals.length; }, clearInterval() {},
    Date: class extends Date { static now() { return now; } }
  };
  runInNewContext(readFileSync(require.resolve('../app.js'), 'utf8'), context);
  return {
    root, ring, quantityRows, nodes, get renders() { return renders; },
    saved: () => JSON.parse(storage['mise-app-v3']), recipes: () => JSON.parse(storage['mise-recipes-v1']),
    change: (id, file) => handlers.change({ target: { id, files: [file] } }),
    advance: (ms) => { now += ms; intervals[0](); },
    click: (act, data = {}) => handlers.click({ target: { closest: () => ({ dataset: { act, ...data } }) } })
  };
}
const saved = (screen, timers = []) => ({ screen, recipeId: Recipe.sample.id, sessions: { [Recipe.sample.id]: { step: 1, servings: 2, timers } } });

test('servings update in place, including ingredient names, and persist under rapid taps', () => {
  const app = setup(saved('recipe'), { reduced: true });
  app.click('servings-up'); app.click('servings-up');
  assert.equal(app.renders, 1);
  assert.equal(app.nodes['.servings-value'].textContent, 4);
  assert.equal(app.quantityRows[1].name.innerHTML, 'Lemons <small>· zest and juice</small>');
  assert.equal(app.quantityRows[0].qty.textContent, '400 g');
  app.click('servings-down'); app.click('servings-down'); app.click('servings-down');
  assert.equal(app.nodes['[data-act="servings-down"]'].disabled, true);
  assert.equal(app.saved().sessions[Recipe.sample.id].servings, 1);
});

test('timer dial tracks elapsed time, extending, reload and completion', () => {
  const app = setup(saved('cook'));
  app.click('timer-start');
  assert.equal(app.saved().sessions[Recipe.sample.id].timers[0].duration, 480000);
  app.advance(240000);
  assert.equal(app.ring.style.strokeDashoffset, 50);
  app.click('timer-plus');
  const restored = setup(app.saved(), { time: 1240000 });
  const offset = Number(restored.root.html.match(/stroke-dashoffset:([\d.]+)/)[1]);
  assert.ok(Math.abs(offset - (1 - 300000 / 540000) * 100) < .001);
  assert.match(restored.root.html, />05:00<\/div>/);
  app.advance(300000);
  assert.match(app.root.html, /Timer is up|timer is up/);
  assert.equal(app.saved().sessions[Recipe.sample.id].timers[0].state, 'finished');
});

test('existing saved timers without a duration still render the correct dial', () => {
  const app = setup(saved('cook', [{ id: 'sauce', endsAt: 1240000, state: 'running' }]));
  assert.match(app.root.html, /stroke-dashoffset:50/);
});

test('playful navigation follows direction without delaying actions or replaying on timer changes', () => {
  const initial = saved('recipe');
  initial.sessions[Recipe.sample.id].step = 0;
  const app = setup(initial);
  app.click('start');
  assert.equal(app.root.dataset.motion, 'start');
  app.click('next');
  assert.equal(app.root.dataset.motion, 'forward');
  app.click('timer-start');
  assert.equal(app.root.dataset.motion, '');
  app.click('back');
  assert.equal(app.root.dataset.motion, 'backward');
  assert.equal(app.saved().sessions[Recipe.sample.id].step, 0);
  for (let i = 0; i < Recipe.sample.steps.length; i++) app.click('next');
  assert.equal(app.root.dataset.screen, 'done');
  assert.equal(app.root.dataset.motion, 'served');
  assert.match(app.root.html, /photo-prompt/);
  assert.doesNotMatch(app.root.html, /art-dish|art-pan/);
  app.click('ack'); // An unrelated render must not replay a screen entrance.
  assert.equal(app.root.dataset.motion, '');
});


test('cooking separates ingredients and method, and stopwatches control their own step', () => {
  const app = setup(saved('cook'));
  assert.match(app.root.html, /class="cook-ingredients"/);
  assert.match(app.root.html, /class="instruction-stage"/);
  assert.match(app.root.html, /class="cook-timers"/);
  assert.ok(app.root.html.indexOf('cook-timers') < app.root.html.indexOf('instruction-stage'));
  assert.match(app.root.html, /data-step="5"/);
  app.click('timer-start', { step: '5' });
  assert.equal(app.saved().sessions[Recipe.sample.id].step, 1);
  assert.equal(app.saved().sessions[Recipe.sample.id].timers[0].id, 'pasta');
  app.click('timer-start', { step: '1' });
  app.click('timer-plus', { step: '5' });
  assert.equal(app.saved().sessions[Recipe.sample.id].timers.find((t) => t.id === 'pasta').duration, 660000);
  app.click('timer-stop', { step: '5' });
  assert.deepEqual(app.saved().sessions[Recipe.sample.id].timers.map((t) => t.id), ['sauce']);
});

test('completion photo prompt depends on provenance, and can be skipped', () => {
  for (const [photo, expected] of [[undefined, true], [{ source: 'internet', url: 'https://example.com/food.jpg' }, true], [{ source: 'upload', key: 'my-photo' }, false]]) {
    const app = setup(saved('done'), { recipe: { ...Recipe.sample, photo } });
    assert.equal(app.root.html.includes('class="photo-prompt"'), expected);
    if (expected) { app.click('photo-skip'); assert.doesNotMatch(app.root.html, /class="photo-prompt"/); }
  }
});

test('taking a completion photo persists ownership, suppresses prompt after reload, and preserves recipe data', async () => {
  const app = setup(saved('done'), { photos: { save: async () => ({ source: 'upload', key: 'taken-photo' }), remove: async () => {} } });
  await app.change('photo-camera', { type: 'image/jpeg' });
  assert.equal(app.recipes()[0].photo.source, 'upload');
  assert.equal(app.recipes()[0].photo.key, 'taken-photo');
  assert.equal(app.recipes()[0].steps.length, Recipe.sample.steps.length);
  assert.doesNotMatch(app.root.html, /class="photo-prompt"/);
  const restored = setup(app.saved(), { recipe: app.recipes()[0] });
  assert.doesNotMatch(restored.root.html, /class="photo-prompt"/);
});

test('failed photo upload preserves an existing photo and reports the error', async () => {
  const recipe = { ...Recipe.sample, photo: { source: 'internet', url: 'https://example.com/food.jpg' } };
  const app = setup(saved('recipe'), { recipe, photos: { save: async () => { throw Error('Out of storage'); } } });
  await app.change('photo-library', { type: 'image/jpeg' });
  assert.deepEqual(app.recipes()[0].photo, recipe.photo);
  assert.match(app.root.html, /Out of storage/);
});

test('static deployment keeps import visible and imports a saved recipe page into an editable draft', async () => {
  const app = setup({ screen: 'library' });
  assert.match(app.root.html, /data-act="import"/);
  app.click('import');
  const text = JSON.stringify({ '@type': 'Recipe', name: 'Uploaded soup', image: 'https://example.com/soup.jpg', recipeIngredient: ['2 tomatoes'], recipeInstructions: ['Chop tomatoes.', 'Simmer for 8 minutes.'] });
  await app.change('f-import-file', { size: text.length, text: async () => text });
  assert.equal(app.root.dataset.screen, 'edit');
  assert.match(app.root.html, /Uploaded soup/);
  assert.match(app.root.html, /https:\/\/example.com\/soup.jpg/);
  assert.match(app.root.html, /Simmer for 8 minutes/);
});


test('static URL import reads permitted sites directly and explains blocked sites', async () => {
  let requested;
  const data = { '@type': 'Recipe', name: 'Online soup', recipeIngredient: ['1 tomato'], recipeInstructions: ['Cook it.'] };
  const app = setup({ screen: 'library' }, { fetch: async (url, options) => { requested = { url, options }; return new Response(JSON.stringify(data)); } });
  app.click('import');
  app.nodes['#f-url'] = { value: 'https://recipes.example/soup' };
  app.click('do-import');
  await new Promise(setImmediate);
  assert.equal(requested.url, 'https://recipes.example/soup');
  assert.equal(requested.options.credentials, 'omit');
  assert.equal(app.root.dataset.screen, 'edit');
  assert.match(app.root.html, /Online soup/);
  const blocked = setup({ screen: 'library' }, { fetch: async () => { throw new TypeError('Network blocked'); } });
  blocked.click('import');
  blocked.nodes['#f-url'] = { value: 'https://recipes.example/soup' };
  blocked.click('do-import');
  await new Promise(setImmediate);
  assert.equal(blocked.root.dataset.screen, 'import');
  assert.match(blocked.root.html, /Many websites block direct browser imports/);
  assert.match(blocked.root.html, /f-import-file/);
});
