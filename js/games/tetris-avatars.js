// ════════════════════════════════════════════════════════════════
//  HeroTetris — KARAKTER SVG AVATARLARI (özgün, telifsiz)
//
//  Her kahraman için kompakt, stilize SVG figür. Emoji yerine
//  gerçek çizim. heroAvatar(key, size) → SVG string döndürür.
//  Renkler kahramanla uyumlu, tasarımlar özgün (telif yok).
// ════════════════════════════════════════════════════════════════

// Ortak yardımcı: yuvarlak gövde + baş şablonu
function fig(parts, c){
  return `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="g_${c.replace('#','')}" cx="50%" cy="35%" r="70%">
        <stop offset="0%" stop-color="${c}" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="${c}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <circle cx="50" cy="50" r="48" fill="url(#g_${c.replace('#','')})"/>
    ${parts}
  </svg>`;
}

export const AVATARS = {
  // VORTEKS — kapüşonlu, alnında girdap sembolü, pelerin
  vor: (c) => fig(`
    <path d="M30 95 Q50 70 70 95 Z" fill="${c}" opacity="0.5"/>
    <rect x="36" y="50" width="28" height="38" rx="10" fill="${c}"/>
    <circle cx="50" cy="38" r="18" fill="#1a3a5c"/>
    <path d="M32 38 A18 18 0 0 1 68 38 L68 30 Q50 18 32 30 Z" fill="${c}"/>
    <circle cx="50" cy="40" r="11" fill="#ffd9b3"/>
    <path d="M44 40 Q50 34 56 40 Q50 46 44 40Z" fill="none" stroke="${c}" stroke-width="2.5"/>
    <circle cx="50" cy="40" r="3" fill="${c}"/>
    <circle cx="44" cy="38" r="1.6" fill="#1a3a5c"/><circle cx="56" cy="38" r="1.6" fill="#1a3a5c"/>
  `, c),
  // ARAKNA — örümcek maskesi, ağ deseni, kırmızı
  arak: (c) => fig(`
    <rect x="36" y="52" width="28" height="36" rx="9" fill="${c}"/>
    <circle cx="50" cy="40" r="20" fill="${c}"/>
    <path d="M50 20 L50 60 M30 40 L70 40 M36 26 L64 54 M64 26 L36 54" stroke="#7a0000" stroke-width="1.5" opacity="0.6"/>
    <ellipse cx="42" cy="38" rx="7" ry="9" fill="#fff"/><ellipse cx="58" cy="38" rx="7" ry="9" fill="#fff"/>
    <ellipse cx="42" cy="39" rx="4" ry="6" fill="#111"/><ellipse cx="58" cy="39" rx="4" ry="6" fill="#111"/>
  `, c),
  // KSENON — kurt başı, sivri kulaklar, mor
  ksen: (c) => fig(`
    <rect x="37" y="54" width="26" height="34" rx="9" fill="${c}"/>
    <path d="M32 30 L38 48 L30 46 Z M68 30 L62 48 L70 46 Z" fill="${c}"/>
    <circle cx="50" cy="44" r="18" fill="${c}"/>
    <path d="M40 48 Q50 58 60 48 L56 56 Q50 60 44 56 Z" fill="#d8c0e8"/>
    <ellipse cx="43" cy="42" rx="3" ry="4" fill="#ffe44d"/><ellipse cx="57" cy="42" rx="3" ry="4" fill="#ffe44d"/>
    <circle cx="50" cy="52" r="2.5" fill="#222"/>
  `, c),
  // GÖLGE — yarasa kulaklı maske, gri-mavi
  gol: (c) => fig(`
    <path d="M30 95 Q50 72 70 95 Z" fill="#2a2a35" opacity="0.7"/>
    <rect x="37" y="54" width="26" height="34" rx="9" fill="#2a2a35"/>
    <path d="M34 28 L40 46 L46 40 Z M66 28 L60 46 L54 40 Z" fill="${c}"/>
    <path d="M34 44 Q50 30 66 44 L66 50 Q50 40 34 50 Z" fill="${c}"/>
    <circle cx="50" cy="50" r="13" fill="#ffd9b3"/>
    <rect x="40" y="44" width="20" height="8" rx="4" fill="${c}"/>
    <path d="M44 56 Q50 60 56 56" stroke="#333" stroke-width="2" fill="none"/>
  `, c),
  // HIZIR — şimşek kasklı, sarı
  hiz: (c) => fig(`
    <rect x="37" y="54" width="26" height="34" rx="9" fill="${c}"/>
    <circle cx="50" cy="42" r="18" fill="${c}"/>
    <circle cx="50" cy="44" r="12" fill="#ffe9b3"/>
    <path d="M58 30 L48 42 L54 42 L46 54 L62 38 L56 38 Z" fill="#fff" stroke="#c89000" stroke-width="0.8"/>
    <circle cx="45" cy="42" r="1.8" fill="#7a5800"/><circle cx="55" cy="42" r="1.8" fill="#7a5800"/>
    <path d="M30 36 L36 38 M30 44 L36 44" stroke="#fff" stroke-width="2"/>
  `, c),
  // ELARA — taçlı, pembe
  ELARA: (c) => fig(`
    <rect x="37" y="55" width="26" height="33" rx="9" fill="${c}"/>
    <circle cx="50" cy="44" r="17" fill="#ffd9c0"/>
    <path d="M34 50 Q34 70 50 72 Q66 70 66 50 Q60 64 50 64 Q40 64 34 50Z" fill="#5a3a2a"/>
    <path d="M36 32 L42 40 L50 30 L58 40 L64 32 L62 42 L38 42 Z" fill="#ffd740" stroke="#c8a000" stroke-width="0.8"/>
    <circle cx="50" cy="30" r="2.5" fill="${c}"/>
    <circle cx="44" cy="46" r="1.8" fill="#5a3a2a"/><circle cx="56" cy="46" r="1.8" fill="#5a3a2a"/>
    <path d="M45 52 Q50 55 55 52" stroke="${c}" stroke-width="2" fill="none"/>
  `, c),
  // GOLEM — iri, kayalık gövde, yeşil
  golem: (c) => fig(`
    <rect x="30" y="48" width="40" height="42" rx="10" fill="${c}"/>
    <rect x="22" y="54" width="12" height="26" rx="6" fill="${c}"/><rect x="66" y="54" width="12" height="26" rx="6" fill="${c}"/>
    <circle cx="50" cy="36" r="16" fill="${c}"/>
    <path d="M38 32 L44 30 M56 30 L62 32" stroke="#2a5a2a" stroke-width="2.5"/>
    <rect x="40" y="34" width="7" height="4" rx="2" fill="#1a3a1a"/><rect x="53" y="34" width="7" height="4" rx="2" fill="#1a3a1a"/>
    <path d="M44 44 Q50 42 56 44" stroke="#1a3a1a" stroke-width="2" fill="none"/>
    <path d="M34 52 L40 56 M60 56 L66 52" stroke="#2a5a2a" stroke-width="1.5"/>
  `, c),
  // PALYAÇO — kaos gülüşü, mor + yeşil saç
  pal: (c) => fig(`
    <rect x="37" y="55" width="26" height="33" rx="9" fill="${c}"/>
    <path d="M34 38 Q30 50 36 56 Q34 44 40 40Z M66 38 Q70 50 64 56 Q66 44 60 40Z" fill="#3aaa3a"/>
    <circle cx="50" cy="42" r="17" fill="#f0e6e0"/>
    <ellipse cx="43" cy="40" rx="3" ry="4" fill="#111"/><ellipse cx="57" cy="40" rx="3" ry="4" fill="#111"/>
    <path d="M40 48 Q50 60 60 48 Q50 54 40 48Z" fill="#c0392b"/>
    <path d="M40 48 Q50 58 60 48" stroke="#111" stroke-width="1.5" fill="none"/>
    <path d="M34 34 Q40 30 44 34" stroke="#3aaa3a" stroke-width="2" fill="none"/>
  `, c),
  // NEKSUS — kozmik, yıldız/galaksi başlık, cyan
  neks: (c) => fig(`
    <rect x="37" y="55" width="26" height="33" rx="9" fill="#0a2a3a"/>
    <circle cx="50" cy="42" r="19" fill="#0a1a2e"/>
    <circle cx="50" cy="42" r="19" fill="none" stroke="${c}" stroke-width="2"/>
    <circle cx="44" cy="38" r="1.5" fill="#fff"/><circle cx="58" cy="36" r="1.2" fill="#fff"/>
    <circle cx="54" cy="48" r="1" fill="#fff"/><circle cx="42" cy="46" r="1" fill="${c}"/>
    <path d="M50 28 L52 34 L58 34 L53 38 L55 44 L50 40 L45 44 L47 38 L42 34 L48 34 Z" fill="${c}" opacity="0.9"/>
    <ellipse cx="45" cy="44" rx="2.5" ry="3" fill="${c}"/><ellipse cx="55" cy="44" rx="2.5" ry="3" fill="${c}"/>
  `, c)
};

// Avatar SVG döndür (yoksa null)
export function heroAvatar(key){
  const fn = AVATARS[key];
  if(!fn) return null;
  const color = (window.__HERO_COLORS && window.__HERO_COLORS[key]) || '#00E5FF';
  try{ return fn(color); }catch(e){ return null; }
}
