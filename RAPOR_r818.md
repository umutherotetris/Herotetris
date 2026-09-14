# SÜKÛN r818 — Sayaç Çarkı İzolasyon ve Cache Düzeltmesi

## Ekran görüntülerinden saptanan hata
r817'de yeni Berhetiyye çarkı artık yükleniyor fakat `#r811BerhetRing` üzerinde geçmiş sürümlerden kalan birbirine zıt `left/top/inset/transform/keyframes` kuralları aynı anda etkili olabiliyordu. Sonuç: çark sayaç merkezinde değil, ekranın sol üstüne taşarak görünüyordu. Aynı anda generic ince orbit halkası merkezde kalıyordu.

Ayrıca r817 paketi içindeki `sw.js` ve `manifest.webmanifest` hâlâ r815 kimliğindeydi. Bu da yeni HTML ile eski cache shell'inin karışmasına imkân veriyordu.

## r818 çözümü
- Tarihsel `#r811BerhetRing` artık sayaç görseli olarak kullanılmıyor.
- Yeni `#r818BerhetRingStage` doğrudan `#zCountVisual` içine ekleniyor.
- Stage `position:absolute; inset:-7%; display:grid; place-items:center` ile sayaç merkezine bağlı.
- Yeni `#r818BerhetRing` sadece kendi stage'i içinde `rotate(-360deg)` animasyonu alıyor; `translate()` veya left/top animasyon bağımlılığı yok.
- Berhetiyye aktifken generic ring/orbit/pseudo/canvas katmanları gizleniyor.
- Normal zikir aktifken premium stage gizleniyor ve standart sayaç katmanları geri açılıyor.
- `Kendi Sesin`, `bsStatus`, `es99Status`, `r470VoiceSource`, `cntSub` dar ekran taşmaları sınırlandı.
- Service worker / manifest / latest marker / cache marker r818 olarak senkronlandı.

## Kritik test zinciri
1. Normal zikir → normal çark görünmeli.
2. Berhetiyye → premium kristal çark tam merkezde görünmeli.
3. Berhetiyye Tefekkür → premium çark merkezden kaçmamalı; ince generic orbit görünmemeli.
4. Tefekkürden çık → premium çark yerinde kalmalı.
5. Normal zikre dön → premium çark kapanmalı, normal çark geri gelmeli.
