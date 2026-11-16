// Optional local preview server. Uses only Node's built-in modules.
import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ImportError, importFromUrl } from './import-recipe.mjs';

const projectRoot = await realpath(dirname(fileURLToPath(import.meta.url)));
const previewPort = 5173;
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

const allowedHosts = new Set([`127.0.0.1:${previewPort}`, `localhost:${previewPort}`]);

// GET /api/import?url=... -> { ok, recipe } | { ok:false, error }. Same-origin only (no CORS headers),
// and the Host check blocks DNS-rebinding pages from driving it.
async function handleImport(request, url, response) {
  const send = (status, body) => {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(body));
  };
  if (!allowedHosts.has(request.headers.host || '')) return send(403, { ok: false, error: 'Not allowed.' });
  try {
    send(200, { ok: true, recipe: await importFromUrl(url.searchParams.get('url') || '') });
  } catch (error) {
    if (error instanceof ImportError) send(422, { ok: false, error: error.message });
    else { console.error(error); send(502, { ok: false, error: 'Something went wrong importing that page.' }); }
  }
}

const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end('Method not allowed');
    return;
  }

  try {
    const parsed = new URL(request.url, 'http://localhost');
    if (parsed.pathname === '/api/import') return await handleImport(request, parsed, response);
    const pathname = decodeURIComponent(parsed.pathname);
    const requestedFile = pathname === '/' ? 'index.html' : pathname.slice(1);
    const file = await realpath(resolve(projectRoot, requestedFile));
    if (!file.startsWith(projectRoot + sep) || !(await stat(file)).isFile()) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    const content = await readFile(file);
    response.writeHead(200, {
      'Content-Type': contentTypes[extname(file)] || 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${previewPort} is already in use. Stop the other preview and try again.`);
  } else {
    console.error(error.message);
  }
  process.exitCode = 1;
});

server.listen(previewPort, '127.0.0.1', () => {
  console.log(`Cook Mode preview: http://127.0.0.1:${previewPort}`);
  console.log('Press Ctrl+C to stop. Refresh your browser after saving an edit.');
});
