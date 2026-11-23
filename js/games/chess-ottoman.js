// The atlas is lit and rendered from sculpted 3D geometry at build time.
// An ordinary canvas draw preserves compatibility with drag and animation.
const ATLAS_URL = new URL('../../assets/chess-ottoman-3d-v162.webp', import.meta.url).href;
const TILE = 144;
const COLUMNS = Object.freeze({ r: 0, n: 1, b: 2, q: 3, k: 4, p: 5 });
const subscribers = new Set();
let atlas;
let loading;

export function loadOttomanPieces(onReady) {
  if (atlas) {
    if (typeof onReady === 'function') queueMicrotask(onReady);
    return Promise.resolve(true);
  }
  if (typeof Image === 'undefined') return Promise.resolve(false);
  if (typeof onReady === 'function') subscribers.add(onReady);
  if (!loading) {
    loading = new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth === TILE * 6 && img.naturalHeight === TILE * 2) atlas = img;
        resolve(Boolean(atlas));
      };
      img.onerror = () => resolve(false);
      img.src = ATLAS_URL;
    }).then(ok => {
      loading = undefined;
      const callbacks = Array.from(subscribers);
      subscribers.clear();
      if (ok) callbacks.forEach(callback => queueMicrotask(callback));
      return ok;
    });
  }
  return loading;
}

export function drawOttomanPiece(ctx, cx, cy, cell, piece) {
  if (!atlas || !Object.hasOwn(COLUMNS, piece?.t) || (piece?.c !== 'w' && piece?.c !== 'b')) return false;
  const size = cell * .94;
  ctx.drawImage(atlas, COLUMNS[piece.t] * TILE, piece.c === 'w' ? 0 : TILE, TILE, TILE,
    cx - size / 2, cy - size * .535, size, size);
  return true;
}
