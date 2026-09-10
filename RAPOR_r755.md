# RAPOR_r755 — Berhetiyye detay kartı flashing düzeltmesi

## Sorun
Berhetiyye isminin detay bilgi kısmı açılırken önce eski temel bilgi kartı bir an görünüyor, hemen ardından r752/r754 zengin kartı devreye girdiği için **flashing** hissi oluşuyordu.

## Kök neden
Temel `r642` bilgi kartı önce render ediliyor, daha sonra r752 zengin kart scripti bu içeriği ezerek premium karta çeviriyordu. Bu iki aşama çıplak gözle fark edilen kısa bir geçiş üretiyordu.

## Çözüm
- Berhetiyye seçiliyken bilgi kartı açıldığında temel satırlar artık hazır olmadan görünmüyor.
- r755 senkronizasyon katmanı, kart açılır açılmaz r752 zengin kartı ve r754 bağlam katmanını tetikliyor.
- Zengin içerik hazır olduğunda kart tek fazda görünür oluyor.
- Böylece eski kart + yeni kart arasında yanıp sönme ortadan kalkıyor.

## Etki
- Yalnızca Berhetiyye detay kartı hedeflendi.
- Esmâ veya diğer açıklama kartları etkilenmez.
- Görsel içerik kaybı yok; sadece geçiş temizlendi.

## Ek not
- r754 ile gelen Berhetiyye derin tema scriptindeki `selected()` söz dizimi hatası da bu sürümde düzeltilerek runtime kararlılığı artırıldı.
