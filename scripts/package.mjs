import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32 } from './binary.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const release = resolve(root, 'release');
await mkdir(release, { recursive: true });
async function collect(directory) {
  const files = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}
async function zip(name, base, files) {
  const locals = [], records = [];
  let offset = 0;
  for (const path of files) {
    const bytes = await readFile(path), filename = Buffer.from(relative(base, path).replaceAll('\\', '/'));
    const checksum = crc32(bytes), local = Buffer.alloc(30), record = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(33, 12); local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(bytes.length, 18); local.writeUInt32LE(bytes.length, 22); local.writeUInt16LE(filename.length, 26);
    locals.push(local, filename, bytes);
    record.writeUInt32LE(0x02014b50); record.writeUInt16LE(20, 4); record.writeUInt16LE(20, 6); record.writeUInt16LE(0x800, 8);
    record.writeUInt16LE(33, 14); record.writeUInt32LE(checksum, 16);
    record.writeUInt32LE(bytes.length, 20); record.writeUInt32LE(bytes.length, 24); record.writeUInt16LE(filename.length, 28); record.writeUInt32LE(offset, 42);
    records.push(record, filename); offset += local.length + filename.length + bytes.length;
  }
  const central = Buffer.concat(records), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
  await writeFile(resolve(release, name), Buffer.concat([...locals, central, end]));
  console.log(`Packaged release/${name}`);
}
await zip('pot-and-page-website.zip', resolve(root, 'dist'), await collect(resolve(root, 'dist')));
// An explicit source allowlist excludes credentials, editor state and generated archives.
const sourceFiles = ['.gitignore', '.nojekyll', 'README.md', 'DEPLOY.md', 'package.json', 'index.html', 'app-config.js', 'app.js', 'theme.js', 'recipe.js', 'recipe-import.js', 'photos.js', 'styles.css', 'pwa.js', 'sw.js', 'manifest.webmanifest', 'server.mjs', 'import-recipe.mjs'];
const sources = sourceFiles.map((file) => resolve(root, file));
for (const directory of ['.github', 'scripts', 'icons', 'test', 'vendor', 'docs']) sources.push(...await collect(resolve(root, directory)));
await zip('pot-and-page-source.zip', root, sources);
