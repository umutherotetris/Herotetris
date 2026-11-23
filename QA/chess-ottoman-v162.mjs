import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { drawOttomanPiece, loadOttomanPieces } from '../js/games/chess-ottoman.js';

test('Ottoman atlas failures preserve the glyph, then retry once for all callers', async () => {
  const url = new URL('../assets/chess-ottoman-3d-v162.webp', import.meta.url);
  const webp = await readFile(url);
  assert.equal(webp.toString('ascii', 8, 16), 'WEBPVP8X');
  const width = webp.readUIntLE(24, 3) + 1, height = webp.readUIntLE(27, 3) + 1;
  assert.deepEqual([width, height], [864, 288]);
  assert.ok((webp[20] & 16) !== 0, 'Transparent alpha preserves the board under each piece');
  assert.ok(webp.length < 70_000, 'The optional pack stays small for mobile clients');
  const loaded = [], calls = [];
  const ctx = { drawImage: (...args) => calls.push(args) };
  let notified = 0;
  const ready = () => { notified++; };
  const OriginalImage = globalThis.Image;
  globalThis.Image = class {
    set src(path) { this.url = path; loaded.push(this); }
  };
  try {
    const p = { t: 'p', c: 'w' };
    assert.equal(drawOttomanPiece(ctx, 30, 50, 40, p), false);
    const first = loadOttomanPieces(ready);
    assert.equal(loaded[0].url, url.href);
    loaded[0].onerror();
    assert.equal(await first, false);
    assert.equal(notified, 0);
    assert.equal(drawOttomanPiece(ctx, 30, 50, 40, p), false);

    const retry = loadOttomanPieces(ready);
    assert.equal(loadOttomanPieces(ready), retry);
    assert.equal(loaded.length, 2);
    Object.assign(loaded[1], { naturalWidth: width, naturalHeight: height });
    loaded[1].onload();
    assert.equal(await retry, true);
    assert.equal(notified, 1);
    for (const [row, color] of ['w', 'b'].entries()) {
      for (const [col, kind] of [...'rnbqkp'].entries()) {
        assert.equal(drawOttomanPiece(ctx, 30, 50, 40, { t: kind, c: color }), true);
        const [img, sx, sy, sw, sh, x, y, w, h] = calls.at(-1);
        assert.equal(img, loaded[1]);
        assert.deepEqual([sx, sy, sw, sh], [144*col, 144*row, 144, 144]);
        assert.ok(x >= 10 && y >= 29.88 && x + w <= 50 && y + h <= 70, 'Sprite does not overlap a neighboring square');
      }
    }
    assert.equal(drawOttomanPiece(ctx, 30, 50, 40, { t: 'constructor', c: 'w' }), false);
    await loadOttomanPieces(ready);
    assert.equal(notified, 2);
    assert.equal(loaded.length, 2);
  } finally {
    if (OriginalImage) globalThis.Image = OriginalImage;
    else delete globalThis.Image;
  }
});
