# SÜKÛN r767 — Düzeltme ve Mimari Temizlik Raporu

Tarih: 2026-09-11
Baz: r766

## Uygulanan düzeltmeler

- Berhetiyye 7’li isim matrisi / 7 Ruhânî Damar kaynak düğmeleri atlas panelinin ayrıca açık olmasına bağlı olmadan doğrudan kaynak görüntüleyiciyi açacak şekilde düzeltildi.
- Aktif Berhetiyye/Esmâ Latin adı cam başlıkta zorunlu ikinci satır olarak korunuyor; eski Tefekkür hero sahipliği r767 sahibi varken devreden çıkıyor.
- Android kilit dönüşündeki visibility/focus/pageshow toparlanmaları tek-flight recovery kapısından geçirildi; aynı seyire ait mükerrer fiziksel medya hedefli budanıyor.
- Eko prewarm mevcut isimden başlayacak şekilde öne çekildi; mevcut ve sıradaki seyir kayıtları kilit öncesi baked/native eko için hazırlanıyor.
- Bendir/usûl vuruşu, görünür ekranda suspended AudioContext varsa güvenli resume sonrası tek tetik olarak çalışacak şekilde güçlendirildi.
- Akıllı Seans, Global Akış ve ilgili akış yönetimi kullanıcı arayüzü Zikir > Akış & Seans altında tek sahipliğe alındı. Kaynak merkezi Zikir > Kaynaklar altında toplandı. Ana sayfada yalnız özet/kısayol mantığı korunuyor.

## Doğrulama

- `node diagnostics/r757/test_all.cjs`: **174/174 PASS**
  - source 31/31
  - mini 5/5
  - restart 10/10
  - failure 8/8
  - transport 7/7
  - ring 6/6
  - audit 15/15
  - storage 15/15
  - settings_queue 8/8
  - studio 19/19
  - ui 13/13
  - visual_sources 18/18
  - repairs 11/11
  - seal 8/8
- `node --check sw.js`: PASS
- HTML build meta / manifest / SW `SURUM` / cache / build marker: r767 ile senkron.
- Fiziksel Android/PWA kilit ekranı testi bu ortamda yapılmadı.
- Tarayıcı görsel doğrulaması bu ortamda yapılmadı.
