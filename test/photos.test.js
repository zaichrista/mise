const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');

function setup({ denyStorage = false } = {}) {
  const stored = new Map(), revoked = [], drawn = [];
  let urlId = 0, keyId = 0;
  const database = {
    createObjectStore() {}, close() {},
    transaction() {
      const tx = {};
      const operation = (work) => {
        const request = {};
        queueMicrotask(() => { if (denyStorage) tx.onabort(); else { request.result = work(); tx.oncomplete(); } });
        return request;
      };
      tx.objectStore = () => ({
        put: (blob, key) => operation(() => stored.set(key, blob)),
        get: (key) => operation(() => stored.get(key)),
        delete: (key) => operation(() => stored.delete(key))
      });
      return tx;
    }
  };
  const indexedDB = { open() { const request = { result: database }; queueMicrotask(() => request.onsuccess()); return request; } };
  const window = { indexedDB };
  runInNewContext(readFileSync(require.resolve('../photos.js'), 'utf8'), {
    window, indexedDB, Blob,
    crypto: { randomUUID: () => `id-${++keyId}` },
    URL: { createObjectURL: () => `blob:${++urlId}`, revokeObjectURL: (url) => revoked.push(url) },
    Image: class { naturalWidth = 4000; naturalHeight = 3000; set src(value) { queueMicrotask(() => this.onload()); } },
    document: { createElement() { return {
      getContext: () => ({ fillRect() {}, drawImage(...args) { drawn.push(args); } }),
      toBlob: (done) => done(new Blob(['resized photo'], { type: 'image/jpeg' }))
    }; } }
  });
  return { photos: window.RecipePhotos, stored, revoked, drawn };
}

test('camera photos are resized, persisted as blobs, retrieved offline, and cleaned up', async () => {
  const { photos, stored, drawn, revoked } = setup();
  const photo = await photos.save(new Blob(['camera bytes'], { type: 'image/jpeg' }));
  assert.equal(photo.source, 'upload');
  assert.equal(stored.get(photo.key).type, 'image/jpeg');
  assert.deepEqual(drawn[0].slice(3), [1600, 1200]);
  const [first, second] = await Promise.all([photos.url(photo.key), photos.url(photo.key)]);
  assert.equal(first, second);
  await photos.remove(photo.key);
  assert.equal(stored.size, 0);
  assert.ok(revoked.includes(first));
  assert.equal(await photos.url('missing'), null);
});

test('invalid files and failed photo storage report errors instead of pretending to save', async () => {
  const { photos } = setup({ denyStorage: true });
  await assert.rejects(() => photos.save(new Blob(['text'], { type: 'text/plain' })), /Choose a photo/);
  await assert.rejects(() => photos.save(new Blob(['image'], { type: 'image/jpeg' })), /Couldn’t save/);
});
