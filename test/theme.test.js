const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');

function setup({ saved = null, dark = false, reduced = false, blocked = false } = {}) {
  const styles = {}, listeners = {}, stored = {}, frames = new Map();
  let now = 0, id = 0;
  const root = { style: { setProperty: (key, value) => { styles[key] = value; } }, dataset: {} };
  const media = {};
  const button = { setAttribute: (key, value) => { button[key] = value; } };
  const context = {
    document: { documentElement: root, querySelectorAll: () => [button], addEventListener: (name, fn) => { listeners[name] = fn; } },
    matchMedia: (query) => (media[query] = { matches: query.includes('color-scheme') ? dark : reduced, addEventListener(name, fn) { this.onchange = fn; } }),
    localStorage: { getItem() { if (blocked) throw Error(); return saved; }, setItem(key, value) { if (blocked) throw Error(); stored[key] = value; } },
    requestAnimationFrame: (fn) => { frames.set(++id, fn); return id; },
    cancelAnimationFrame: (key) => frames.delete(key),
    performance: { now: () => now }, window: {}
  };
  runInNewContext(readFileSync(require.resolve('../theme.js'), 'utf8'), context);
  const click = () => listeners.click({ target: { closest: () => button } });
  const advance = (count) => {
    for (let i = 0; i < count; i++) {
      now += 1000 / 60;
      const pending = [...frames.values()]; frames.clear();
      pending.forEach((fn) => fn(now));
    }
  };
  return { root, styles, stored, frames, media, button, click, advance };
}

test('theme spring keeps colour progress and switch position synchronized, and reverses continuously', () => {
  const app = setup();
  app.click(); app.advance(5);
  const position = Number(app.styles['--theme-position']);
  assert.ok(position > 0 && position < 1);
  assert.equal(parseFloat(app.styles['--theme-mix']), position * 100);
  app.click();
  assert.equal(Number(app.styles['--theme-position']), position);
  app.advance(100);
  assert.equal(app.styles['--theme-position'], 0);
  assert.equal(app.styles['--theme-mix'], '0%');
  assert.equal(app.frames.size, 0);
  assert.equal(app.button['aria-checked'], 'false');
  assert.equal(app.stored['mise-theme'], 'light');
});

test('saved theme overrides system and reduced motion changes immediately', () => {
  const app = setup({ saved: 'light', dark: true, reduced: true });
  assert.equal(app.root.dataset.theme, 'light');
  app.click();
  assert.equal(app.root.dataset.theme, 'dark');
  assert.equal(app.styles['--theme-position'], 1);
  assert.equal(app.styles['--theme-mix'], '100%');
  assert.equal(app.frames.size, 0);
});

test('system theme is followed until a manual choice; unavailable storage is harmless', () => {
  const app = setup({ dark: true, blocked: true, reduced: true });
  assert.equal(app.root.dataset.theme, 'dark');
  const system = app.media['(prefers-color-scheme: dark)'];
  system.matches = false; system.onchange();
  assert.equal(app.root.dataset.theme, 'light');
  app.click();
  system.onchange();
  assert.equal(app.root.dataset.theme, 'dark');
});
