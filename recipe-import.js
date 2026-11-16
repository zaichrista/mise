// Shared structured-recipe parser. Saved HTML is parsed as text, never executed.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RecipeImport = factory();
})(typeof self !== 'undefined' ? self : this, function () {
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', deg: '°', frac12: '½', frac14: '¼', frac34: '¾', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
function decodeEntities(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}
const plain = (s) => decodeEntities(String(s).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '')).replace(/[ \t ]+/g, ' ').trim();

const typeIncludes = (node, type) => [].concat(node?.['@type'] ?? []).some((t) => String(t).toLowerCase().endsWith(type.toLowerCase()));

function findRecipe(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 6) return null;
  if (Array.isArray(node)) { for (const n of node) { const r = findRecipe(n, depth + 1); if (r) return r; } return null; }
  if (typeIncludes(node, 'Recipe')) return node;
  if (node['@graph']) return findRecipe(node['@graph'], depth + 1);
  return null;
}

function isoToMinutes(iso) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i.exec(String(iso || ''));
  if (!m) return 0;
  return (Number(m[1] || 0) * 24 + Number(m[2] || 0)) * 60 + Number(m[3] || 0);
}
function minutesToText(min) {
  if (!min) return '';
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
}

function instructionTexts(x) {
  if (!x) return [];
  if (typeof x === 'string') return plain(x).split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (Array.isArray(x)) return x.flatMap(instructionTexts);
  if (typeof x === 'object') {
    if (x.itemListElement) return instructionTexts(x.itemListElement);
    return instructionTexts(x.text || x.name || '');
  }
  return [];
}

function yieldToServings(y) {
  const first = [].concat(y ?? []).map(String).join(' ');
  const m = /\d+/.exec(first);
  return m ? Math.min(24, Math.max(1, Number(m[0]))) : 4;
}

function imageUrl(image, sourceUrl) {
  const value = Array.isArray(image) ? image[0] : image;
  const candidate = typeof value === 'string' ? value : value?.url || value?.contentUrl;
  if (!candidate) return '';
  try { const url = new URL(candidate, sourceUrl || undefined); return /^https?:$/.test(url.protocol) ? url.href : ''; } catch { return ''; }
}

function normalizeRecipe(node, sourceUrl = '') {
  const ingredients = [].concat(node.recipeIngredient ?? node.ingredients ?? []).map((i) => plain(i)).filter(Boolean);
  const steps = instructionTexts(node.recipeInstructions);
  if (!ingredients.length && !steps.length) return null;
  const minutes = isoToMinutes(node.totalTime) || isoToMinutes(node.cookTime) + isoToMinutes(node.prepTime);
  return {
    title: plain(node.name || 'Imported recipe'),
    servings: yieldToServings(node.recipeYield),
    time: minutesToText(minutes),
    ingredients,
    steps,
    source: sourceUrl,
    image: imageUrl(node.image, sourceUrl)
  };
}

function extractRecipe(html, sourceUrl = '') {
  if (/^\s*[\[{]/.test(html)) {
    try { const node = findRecipe(JSON.parse(html)); if (node) return normalizeRecipe(node, sourceUrl); } catch { /* Try an HTML page instead. */ }
  }
  const re = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    let data;
    try { data = JSON.parse(m[1].trim()); }
    catch { try { data = JSON.parse(m[1].replace(/[\u0000-\u001f]+/g, ' ').trim()); } catch { continue; } }
    const node = findRecipe(data);
    const recipe = node && normalizeRecipe(node, sourceUrl);
    if (recipe) return recipe;
  }
  return null;
}

async function readPage(response) {
  const limit = 3 * 1024 * 1024;
  if (Number(response.headers.get('content-length')) > limit) throw new Error('This recipe page is too large. Try a saved recipe JSON file.');
  if (!response.body?.getReader) {
    const text = await response.text();
    if (text.length > limit) throw new Error('This recipe page is too large.');
    return text;
  }
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let size = 0, text = '';
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error('This recipe page is too large. Try a saved recipe JSON file.'); }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally { reader.releaseLock(); }
}
return { decodeEntities, minutesToText, normalizeRecipe, extractRecipe, readPage };
});
