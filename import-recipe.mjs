// Recipe import: fetch a web page and extract its schema.org Recipe (JSON-LD).
// Used by server.mjs. Node built-ins only.
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import zlib from 'node:zlib';

const MAX_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 4;
const TIMEOUT_MS = 10000;

// ---------- Extraction (pure) ----------
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', deg: '°', frac12: '½', frac14: '¼', frac34: '¾', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
export function decodeEntities(s) {
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
export function minutesToText(min) {
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

export function normalizeRecipe(node, sourceUrl = '') {
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
    source: sourceUrl
  };
}

export function extractRecipe(html, sourceUrl = '') {
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

// ---------- Safe fetching ----------
// The server fetches URLs on a user's behalf, so it must never reach internal addresses.
const blocked = new net.BlockList();
[['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 3]]
  .forEach(([a, p]) => blocked.addSubnet(a, p, 'ipv4'));
[['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]].forEach(([a, p]) => blocked.addSubnet(a, p, 'ipv6'));

export function isPublicAddress(address) {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  const ip = mapped ? mapped[1] : address;
  const family = net.isIP(ip);
  if (!family) return false;
  return !blocked.check(ip, family === 4 ? 'ipv4' : 'ipv6');
}

// dns lookup that refuses non-public results, evaluated at connect time (no check/use gap).
function safeLookup(hostname, options, callback) {
  dns.lookup(hostname, { all: true }, (err, addresses) => {
    if (err) return callback(err);
    if (!addresses.length || !addresses.every((a) => isPublicAddress(a.address))) {
      return callback(Object.assign(new Error('That address is not allowed.'), { code: 'EBLOCKED' }));
    }
    if (options?.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
}

export function parseTarget(input) {
  let url;
  try { url = new URL(String(input).trim()); } catch { throw new ImportError('That doesn’t look like a web address.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new ImportError('Only http and https links can be imported.');
  if (url.username || url.password) throw new ImportError('Links with a username or password can’t be imported.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) && !isPublicAddress(host)) throw new ImportError('That address is not allowed.');
  return url;
}

export class ImportError extends Error {}

function getOnce(url) {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.get(url, {
      lookup: safeLookup,
      timeout: TIMEOUT_MS,
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; MiseRecipeImporter/1.0)',
        accept: 'text/html,application/xhtml+xml',
        'accept-encoding': 'gzip, deflate, br'
      }
    }, (res) => {
      const status = res.statusCode || 0;
      if (status >= 300 && status < 400 && res.headers.location) { res.resume(); return resolve({ redirect: new URL(res.headers.location, url) }); }
      if (status < 200 || status >= 300) { res.resume(); return reject(new ImportError(`The site answered with an error (${status}).`)); }
      const type = String(res.headers['content-type'] || '');
      if (type && !/html|xml/i.test(type)) { res.resume(); return reject(new ImportError('That link isn’t a web page.')); }
      const enc = String(res.headers['content-encoding'] || '').toLowerCase();
      const stream = enc === 'gzip' ? res.pipe(zlib.createGunzip()) : enc === 'deflate' ? res.pipe(zlib.createInflate()) : enc === 'br' ? res.pipe(zlib.createBrotliDecompress()) : res;
      const chunks = []; let size = 0;
      stream.on('data', (c) => {
        size += c.length;
        if (size > MAX_BYTES) { req.destroy(); reject(new ImportError('That page is too large to import.')); return; }
        chunks.push(c);
      });
      stream.on('end', () => resolve({ html: Buffer.concat(chunks).toString('utf8') }));
      stream.on('error', () => reject(new ImportError('Couldn’t read that page.')));
    });
    req.on('timeout', () => { req.destroy(); reject(new ImportError('The site took too long to respond.')); });
    req.on('error', (e) => reject(e instanceof ImportError ? e : new ImportError(e.code === 'EBLOCKED' ? 'That address is not allowed.' : 'Couldn’t reach that site.')));
  });
}

export async function importFromUrl(input) {
  let url = parseTarget(input);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const result = await getOnce(url);
    if (result.redirect) { url = parseTarget(result.redirect.href); continue; }
    const recipe = extractRecipe(result.html, url.href);
    if (!recipe) throw new ImportError('No recipe found on that page. You can still write it in yourself.');
    return recipe;
  }
  throw new ImportError('Too many redirects.');
}
