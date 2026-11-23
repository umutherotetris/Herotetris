// A fixed-angle render of the Ottoman figures. Each team row uses the same
// six silhouettes; the ivory and obsidian materials provide the contrast.
const SIZE = 160;
const COLUMNS = 'rnbqkp';
const ATLAS_URL = new URL('../../assets/ottoman-figures-v162.webp', import.meta.url);
let readyImage = null;
let loading = null;

export function loadOttomanPieces(){
  if(readyImage) return Promise.resolve(true);
  if(loading) return loading;
  loading = new Promise(resolve => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if(img.naturalWidth === SIZE * COLUMNS.length && img.naturalHeight === SIZE * 2) readyImage = img;
      resolve(!!readyImage);
    };
    img.onerror = () => resolve(false);
    img.src = ATLAS_URL.href;
  }).finally(() => { loading = null; });
  return loading;
}

export function drawOttomanPiece(ctx, cx, cy, cell, piece){
  const column = COLUMNS.indexOf(piece?.t ?? '');
  if(!readyImage || !piece?.t || column < 0 || (piece.c !== 'w' && piece.c !== 'b') || !(cell > 0)) return false;
  const row = piece.c === 'w' ? 0 : 1;
  const side = cell * .96;
  ctx.save();
  ctx.fillStyle = 'rgba(8,6,14,.42)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + side * .45, side * (piece.t === 'q' || piece.t === 'p' ? .19 : .28), side * .031, 0, 0, 2*Math.PI);
  ctx.fill();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(readyImage, column*SIZE, row*SIZE, SIZE, SIZE, cx-side/2, cy-side/2, side, side);
  ctx.restore();
  return true;
}
