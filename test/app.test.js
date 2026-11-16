const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const Recipe = require('../recipe.js');

// Exercise the real event handlers and persisted session with a minimal DOM surface.
function setup(saved, { reduced = false, time = 1000000 } = {}) {
  const storage = { 'mise-app-v3': JSON.stringify(saved) }, handlers = {}, intervals = [];
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
    window: {}, navigator: {}, matchMedia: () => ({ matches: reduced }),
    getComputedStyle: () => ({ transform: 'none' }),
    setInterval: (fn) => { intervals.push(fn); return intervals.length; }, clearInterval() {},
    Date: class extends Date { static now() { return now; } }
  };
  runInNewContext(readFileSync(require.resolve('../app.js'), 'utf8'), context);
  return {
    root, ring, quantityRows, nodes, get renders() { return renders; },
    saved: () => JSON.parse(storage['mise-app-v3']),
    advance: (ms) => { now += ms; intervals[0](); },
    click: (act) => handlers.click({ target: { closest: () => ({ dataset: { act } }) } })
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
  assert.match(app.root.html, /art-dish/);
  app.click('ack'); // An unrelated render must not repeat the lid-lift.
  assert.equal(app.root.dataset.motion, '');
});
