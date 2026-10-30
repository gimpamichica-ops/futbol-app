import fs from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

export function icono(size) {
  const pixels = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - size / 2) / size;
      const dy = (y + 0.5 - size / 2) / size;
      const radius = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const pentagon = 0.105 / Math.cos(((angle + Math.PI * 4) % (Math.PI * 2 / 5)) - Math.PI / 5);
      const patch = radius < pentagon || (radius > 0.23 && Math.cos(5 * angle) > 0.65);
      const color = radius > 0.34 ? [16, 27, 23] : patch ? [24, 39, 31] : [240, 245, 241];
      const offset = y * (size * 3 + 1) + 1 + x * 3;
      pixels.set(color, offset);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const size of [180, 192, 512]) {
    const name = size === 180 ? 'apple-touch-icon.png' : 'icon-' + size + '.png';
    fs.writeFileSync(new URL('../public/' + name, import.meta.url), icono(size));
  }
}
