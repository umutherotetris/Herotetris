// The portal palette is local to this browser, independent of profile
// cosmetics, individual boards, and the existing hero_theme accent setting.
export const PORTAL_PALETTES = Object.freeze([
  Object.freeze({ key: 'sapphire', name: 'Safir', caption: 'Serin ve parlak', canvas: '#f3f7ff', soft: '#eaf0ff', ink: '#14234c', accent: '#2452e7' }),
  Object.freeze({ key: 'pearl', name: 'Sedef', caption: 'Sıcak ve yumuşak', canvas: '#faf5ee', soft: '#f5eadc', ink: '#2f2a25', accent: '#783b24' }),
  Object.freeze({ key: 'sea', name: 'Deniz Camı', caption: 'Serin yeşil tonlar', canvas: '#eff8f6', soft: '#e1f0ec', ink: '#193732', accent: '#146054' })
]);
const paletteKey = 'hero_portal_palette';
const lookup = key => PORTAL_PALETTES.find(p => p.key === key);

export function readPortalPalette() {
  // The DOM reflects changes even when persistent storage is denied.
  const active = lookup(document.documentElement.dataset.portalPalette);
  if(active) return active.key;
  try { return lookup(localStorage.getItem(paletteKey))?.key || 'sapphire'; }
  catch { return 'sapphire'; }
}

export function applyPortalPalette(key) {
  const palette = lookup(key);
  if(!palette) return false;
  document.documentElement.dataset.portalPalette = palette.key;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if(themeColor) themeColor.content = palette.canvas;
  try { localStorage.setItem(paletteKey, palette.key); return true; }
  catch { return false; }
}
