const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');
const root = resolve(__dirname, '..');
execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: root });
const file = (path) => readFileSync(resolve(root, 'dist', path));

test('static release has local install assets and works beneath a repository path', () => {
  const manifest = JSON.parse(file('manifest.webmanifest'));
  const base = new URL('https://example.github.io/a-repository/');
  assert.equal(new URL(manifest.start_url, base).href, base.href);
  assert.equal(new URL(manifest.scope, base).href, base.href);
  assert.equal(manifest.display, 'standalone');
  const html = file('index.html').toString();
  for (const [, path] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    assert.ok(!path.startsWith('/'), path);
    assert.ok(existsSync(resolve(root, 'dist', path)), path);
  }
  for (const icon of manifest.icons) {
    const png = file(icon.src);
    assert.equal(png.toString('ascii', 1, 4), 'PNG');
    const [width, height] = icon.sizes.split('x').map(Number);
    assert.equal(png.readUInt32BE(16), width);
    assert.equal(png.readUInt32BE(20), height);
  }
  assert.match(file('app-config.js').toString(), /importEndpoint: null, offline: true/);
  assert.equal(readFileSync(resolve(root, 'sw.js'), 'utf8'), file('sw.js').toString());
  assert.match(readFileSync(resolve(root, 'app-config.js'), 'utf8'), /importEndpoint: null, offline: true/);
  assert.ok(existsSync(resolve(root, '.nojekyll')));
  assert.ok(!existsSync(resolve(root, 'dist/server.mjs')));
  assert.ok(!existsSync(resolve(root, 'dist/test')));
});

test('offline worker caches the app under its own scope and leaves APIs alone', async () => {
  const handlers = {}, stored = new Map(), deleted = [];
  const base = 'https://example.github.io/a-repository/';
  const previous = 'pot-and-page:/a-repository/:previous';
  const other = 'pot-and-page:/another-app/:previous';
  const cache = {
    async addAll(urls) { for (const url of urls) stored.set(url, { cached: url }); },
    async match(key) { return stored.get(key); }
  };
  runInNewContext(file('sw.js').toString(), {
    URL, Set, Promise,
    self: { location: { href: base + 'sw.js' }, addEventListener: (event, fn) => { handlers[event] = fn; } },
    caches: { open: async () => cache, keys: async () => [previous, other], delete: async (key) => { deleted.push(key); } },
    fetch: () => { throw Error('Unexpected network access'); }
  });
  let pending;
  handlers.install({ waitUntil: (promise) => { pending = promise; } });
  await pending;
  assert.ok(stored.has(base + 'index.html'));
  assert.ok(stored.has(base + 'icons/icon-512.png'));
  assert.ok([...stored.keys()].every((url) => url.startsWith(base)));
  handlers.activate({ waitUntil: (promise) => { pending = promise; } });
  await pending;
  assert.deepEqual(deleted, [previous]);
  let response;
  handlers.fetch({ request: { url: base + '?from=home', method: 'GET', mode: 'navigate' }, respondWith: (promise) => { response = promise; } });
  assert.equal((await response).cached, base + 'index.html');
  let intercepted = false;
  for (const url of [base + 'api/import?url=https://example.com', 'https://example.github.io/another-app/', 'https://elsewhere.example/app.js']) {
    handlers.fetch({ request: { url, method: 'GET' }, respondWith: () => { intercepted = true; } });
  }
  assert.equal(intercepted, false);
});
