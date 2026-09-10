# SÜKÛN r769 — Kaynak Durumu Temizliği

Tarih: 2026-09-11
Baz: r768

## Değişiklik

- Tefekkür ekranındaki yanıltıcı “Kaynak bekleniyor” varsayılan metni kaldırıldı.
- Kaynak henüz bilinmiyorsa durum rozeti tamamen gizlenir ve yer kaplamaz.
- Gerçek hazırlık sürüyorsa “Ses hazırlanıyor”; kaynak kesinleşince “Kendi kaydın”, “Sesli okuma” veya “Sessiz sayım” görünür.
- r768 aktif isim cam sahibi ve r767 playback/kategori düzeltmeleri korunmuştur.

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
- Fiziksel Android/PWA testi bu ortamda yapılmadı.
