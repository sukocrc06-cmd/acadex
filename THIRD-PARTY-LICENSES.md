# Üçüncü taraf lisansları

Acadex sunum modülü (js/acadex-ink.js) aşağıdaki açık kaynak işlerden parça içerir.
Bu dosya lisans koşulu gereği depoda durmalıdır (MIT ve ISC, bildirimin kopyayla
birlikte dağıtılmasını ister).

## Lucide (simgeler)

`IKON_L` içindeki 162 simge lucide-static 1.73.0 paketinden alındı ve tek `<path>`
biçimine çevrildi. https://lucide.dev

```
ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

---

The following Lucide icons are derived from the Feather project:

airplay, alert-circle, alert-octagon, alert-triangle, aperture, arrow-down-circle, arrow-down-left, arrow-down-right, arrow-down, arrow-left-circle, arrow-left, arrow-right-circle, arrow-right, arrow-up-circle, arrow-up-left, arrow-up-right, arrow-up, at-sign, calendar, cast, check, chevron-down, chevron-left, chevron-right, chevron-up, chevrons-down, chevrons-left, chevrons-right, chevrons-up, circle, clipboard, clock, code, columns, command, compass, corner-down-left, corner-down-right, corner-left-down, corner-left-up, corner-right-down, corner-right-up, corner-up-left, corner-up-right, crosshair, database, divide-circle, divide-square, dollar-sign, download, external-link, feather, frown, hash, headphones, help-circle, info, italic, key, layout, life-buoy, link-2, link, loader, lock, log-in, log-out, maximize, meh, minimize, minimize-2, minus-circle, minus-square, minus, monitor, moon, more-horizontal, more-vertical, move, music, navigation-2, navigation, octagon, pause-circle, percent, plus-circle, plus-square, plus, power, radio, rss, search, server, share, shopping-bag, sidebar, smartphone, smile, square, table-2, tablet, target, terminal, trash-2, trash, triangle, tv, type, upload, x-circle, x-octagon, x-square, x, zoom-in, zoom-out

The MIT License (MIT) (for the icons listed above)

Copyright (c) 2013-present Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## reveal.js (şablon renkleri ve yazı tipi seçimleri)

`TEMALAR` içindeki `rv-*` şablonlarının renk ve yazı tipi değerleri reveal.js 5.1.0
temalarından (dist/theme/*.css) alındı. https://revealjs.com

```
The MIT License (MIT)

Copyright (C) 2011-2026 Hakim El Hattab, http://hakim.se, and reveal.js contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Marp Core (şablon renkleri)

`TEMALAR` içindeki `mp-*` şablonlarının renk değerleri Marp Core temalarından
(themes/default.scss, gaia.scss, uncover.scss) alındı. https://marp.app

```
MIT License

Copyright (c) 2018 Marp team (marp-team@marp.app)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Yazı tipleri

Şablon yazı tipleri dosya olarak depoda tutulmaz; seçildiklerinde Bunny Fonts
(fonts.bunny.net) üzerinden yüklenir. Her yazı tipi kendi açık lisansını
(çoğunlukla SIL Open Font License 1.1) taşır.

## Anatomi Lab 3B modelleri

- Z-Anatomy ve BodyParts3D (DBCLS): CC BY-SA 4.0 / CC BY-SA 2.1 JP. Ayrıntı: labs/anatomi/data/LISANS.txt
- Human Reference Atlas (HRA) 3D Reference Object Library, HuBMAP / CNS Indiana University, NIH 3D
  (https://humanatlas.io): CC BY 4.0. Kadın üreme organları ve kadın mesanesi (labs/anatomi/data/ax-kadin.js);
  parça seçimi, üçgen azaltma ve kalça kemiğine göre ölçekleme yapıldı. Sayfadaki kaynak satırı kaldırılmaz.

## Alınmayanlar

- unDraw: lisansı çizimlerin başka bir uygulamaya kütüphane olarak eklenmesini
  yasaklıyor; hiçbir çizim alınmadı.
- SlidesCarnival (CC BY 4.0): dosyaların olduğu gibi yeniden dağıtımı yasak ve
  robots.txt indirme yolunu otomatik erişime kapatıyor; hiçbir şablon depoya
  alınmadı. Kullanıcı kendi indirdiği .pptx dosyasından renk ve yazı tipini
  "şablon → + .pptx" ile çıkarabilir.
- Şablonların zemin desenleri ve kutu biçimleri (temaDekor) Acadex'in kendi
  çizimidir; dışarıdan alınmadı.
