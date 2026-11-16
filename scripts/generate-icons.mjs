// Rasterize our simple saucepan mark with no native or third-party dependencies.
import { writeFile, mkdir } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { crc32 } from './binary.mjs';
import { fileURLToPath } from 'node:url';
const directory = fileURLToPath(new URL('../icons/', import.meta.url));
await mkdir(directory, { recursive: true });
const cream = [251, 248, 240], burgundy = [113, 63, 70], gold = [170, 113, 37];
const paths = [
  [[160, 244], [160, 308], [166, 333], [185, 353], [213, 366], [248, 370], [283, 366], [311, 353], [330, 333], [336, 308], [336, 244]],
  [[336, 260], [384, 260], [398, 267], [398, 283], [384, 291], [336, 291]],
  [[148, 243], [348, 243]],
  [[179, 227], [188, 211], [210, 199], [248, 195], [286, 199], [308, 211], [317, 227]],
  [[237, 195], [237, 181], [259, 181], [259, 195]],
  [[213, 162], [207, 150], [214, 136], [213, 123]],
  [[270, 162], [264, 150], [271, 136], [270, 123]]
];
const detail = [[181, 270], [181, 301], [187, 321], [202, 333]];
function chunk(type, bytes) {
  const name = Buffer.from(type), size = Buffer.alloc(4), crc = Buffer.alloc(4);
  size.writeUInt32BE(bytes.length); crc.writeUInt32BE(crc32(Buffer.concat([name, bytes])));
  return Buffer.concat([size, name, bytes, crc]);
}
function distance(x, y, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const p = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - a[0] - p * dx, y - a[1] - p * dy);
}
function raster(size) {
  const data = Buffer.alloc(size * (1 + size * 3));
  const lines = paths.flatMap((path) => path.slice(1).map((point, i) => [path[i], point, burgundy, 6]));
  lines.push(...detail.slice(1).map((point, i) => [detail[i], point, gold, 5]));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = (x + .5) * 512 / size, py = (y + .5) * 512 / size;
    let colour = [...cream];
    for (const [a, b, ink, radius] of lines) {
      const coverage = Math.max(0, Math.min(1, (radius - distance(px, py, a, b)) * size / 512 + .5));
      colour = colour.map((value, i) => Math.round(value * (1 - coverage) + ink[i] * coverage));
    }
    const index = y * (1 + size * 3) + 1 + x * 3;
    data.set(colour, index);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(data)), chunk('IEND', Buffer.alloc(0))]);
}
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable-512.png', 512], ['apple-touch-icon.png', 180]]) await writeFile(directory + name, raster(size));
const draw = (path) => `M${path.map((point) => point.join(' ')).join(' L')}`;
await writeFile(directory + 'icon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#fbf8f0"/><g fill="none" stroke="#713f46" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">${paths.map((path) => `<path d="${draw(path)}"/>`).join('')}<path stroke="#aa7125" stroke-width="10" d="${draw(detail)}"/></g></svg>\n`);
console.log('Generated saucepan app icons.');
