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
import RecipeImport from './recipe-import.js';
export const { decodeEntities, minutesToText, normalizeRecipe, extractRecipe } = RecipeImport;

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
