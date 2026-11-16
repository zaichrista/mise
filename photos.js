// Photos live as Blobs in IndexedDB, keeping large images out of recipe localStorage.
(() => {
  let database;
  const urls = new Map();
  function open() {
    if (!('indexedDB' in window)) return Promise.reject(new Error('Photo storage is unavailable in this browser.'));
    if (!database) database = new Promise((resolve, reject) => {
      const request = indexedDB.open('pot-and-page-photos', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('photos');
      request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); database = null; }; resolve(request.result); };
      request.onerror = () => { database = null; reject(new Error('Couldn’t open photo storage. Check that site storage is allowed.')); };
      request.onblocked = () => { database = null; reject(new Error('Close other Pot & Page tabs, then try the photo again.')); };
    });
    return database;
  }
  async function transaction(mode, work) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('photos', mode);
      const request = work(tx.objectStore('photos'));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = tx.onabort = () => reject(new Error('Couldn’t save the photo. Your device may be out of storage.'));
    });
  }
  async function prepare(file) {
    if (!file.type.startsWith('image/')) throw new Error('Choose a photo from your camera or photo library.');
    if (file.size > 40 * 1024 * 1024) throw new Error('Choose a photo smaller than 40 MB.');
    const source = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('Couldn’t read this photo. Try a JPEG or PNG image.')); image.src = source; });
      const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Photo processing is unavailable in this browser.');
      ctx.fillStyle = '#fbf8f0'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      return await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Couldn’t prepare this photo. Try another image.')), 'image/jpeg', .84));
    } finally { URL.revokeObjectURL(source); }
  }
  window.RecipePhotos = {
    async save(file) {
      const blob = await prepare(file);
      const key = `photo-${crypto.randomUUID()}`;
      await transaction('readwrite', (store) => store.put(blob, key));
      return { source: 'upload', key };
    },
    async url(key) {
      if (urls.has(key)) return urls.get(key);
      const blob = await transaction('readonly', (store) => store.get(key));
      if (!blob) return null;
      // Another render may have requested the same photo while IndexedDB was opening.
      if (!urls.has(key)) urls.set(key, URL.createObjectURL(blob));
      return urls.get(key);
    },
    async remove(key) {
      await transaction('readwrite', (store) => store.delete(key));
      if (urls.has(key)) URL.revokeObjectURL(urls.get(key));
      urls.delete(key);
    }
  };
})();
