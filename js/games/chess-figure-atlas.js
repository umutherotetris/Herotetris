// A fixed-angle render of the Ottoman figures. Each team row uses the same
// six silhouettes; the ivory and obsidian materials provide the contrast.
const SIZE = 160;
const COLUMNS = 'rnbqkp';
// Visible alpha bounds of each 160px atlas cell, shared by both teams.
// Cropping the empty margin enlarges the actual art without touching its proportions.
const ART = {
  r: [43,24,74,133,.94], n: [36,15,87,142,.96],
  b: [33,13,94,144,.96], q: [43,18,73,139,.96],
  k: [36,4,87,153,.97], p: [47,36,66,121,.89]
};
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
  const [sx,sy,sw,sh,height] = ART[piece.t];
  const h = cell * height, w = h * sw / sh;
  const base = cy + cell * .482;
  ctx.save();
  ctx.fillStyle = 'rgba(8,6,14,.42)';
  ctx.beginPath();
  ctx.ellipse(cx, base, w * .46, cell * .016, 0, 0, 2*Math.PI);
  ctx.fill();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(readyImage, column*SIZE+sx, row*SIZE+sy, sw, sh, cx-w/2, base-h, w, h);
  ctx.restore();
  return true;
}
