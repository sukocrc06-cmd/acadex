/* ==========================================================================
   FORMULO · "Nereden geliyor?" türetme adımları (formulo/assets/formulo-turet.js), 08.11.2026
   Her ders için temel formüllerin kısa türetmesi. Adım: {tr, en, m}; m tahtaya yazılan
   matematik satırıdır (düz Unicode; dile göre değişiyorsa [tr, en]).
   formulo-plus.js tahtada adım adım açar. Kimlikler formulo-veri*.js ile aynıdır.
   ========================================================================== */
(function (W) {
  'use strict';
  W.FORMULO_TURET = {
    /* ---------- Calculus I ---------- */
    'kuvvet-turev': [
      { tr: 'Türevin tanımından başla.', en: 'Start from the definition of the derivative.', m: 'd/dx xⁿ = lim(h→0) [(x + h)ⁿ − xⁿ] / h' },
      { tr: '(x + h)ⁿ ifadesini binom açılımıyla aç.', en: 'Expand (x + h)ⁿ with the binomial theorem.', m: '(x + h)ⁿ = xⁿ + n xⁿ⁻¹ h + n(n − 1)/2 · xⁿ⁻² h² + …' },
      { tr: 'xⁿ terimleri sadeleşir; kalanı h’ye böl.', en: 'The xⁿ terms cancel; divide the rest by h.', m: '[…] / h = n xⁿ⁻¹ + n(n − 1)/2 · xⁿ⁻² h + …' },
      { tr: 'h → 0: içinde h olan her terim sıfıra gider.', en: 'Let h → 0: every term containing h vanishes.', m: 'd/dx xⁿ = n xⁿ⁻¹' },
      { tr: 'Sabit çarpan türevin dışına çıkar.', en: 'A constant factor comes out of the derivative.', m: 'd/dx (c xⁿ) = c n xⁿ⁻¹' }
    ],
    'disk': [
      { tr: 'Dönel cismi x eksenine dik, ince dilimlere kes.', en: 'Slice the solid into thin slabs perpendicular to the x-axis.', m: ['dilim kalınlığı = dx', 'slab thickness = dx'] },
      { tr: 'Her dilim, yarıçapı R(x) olan bir disk.', en: 'Each slab is a disk of radius R(x).', m: 'A(x) = π [R(x)]²' },
      { tr: 'Dilimin hacmi = taban alanı × kalınlık.', en: 'Slab volume = base area × thickness.', m: 'dV = π [R(x)]² dx' },
      { tr: 'a’dan b’ye bütün dilimleri topla: bu bir integral.', en: 'Add up every slab from a to b: that is an integral.', m: 'V = π ∫ₐᵇ [R(x)]² dx' }
    ],
    /* ---------- Calculus II ---------- */
    'kismi-int': [
      { tr: 'Çarpımın türev kuralıyla başla.', en: 'Start from the product rule.', m: 'd(uv) = u dv + v du' },
      { tr: 'İki tarafın da integralini al.', en: 'Integrate both sides.', m: '∫ d(uv) = ∫ u dv + ∫ v du' },
      { tr: 'Türevin integrali fonksiyonun kendisidir.', en: 'The integral of a derivative is the function itself.', m: 'uv = ∫ u dv + ∫ v du' },
      { tr: '∫ v du terimini karşıya geçir.', en: 'Move ∫ v du to the other side.', m: '∫ u dv = uv − ∫ v du' }
    ],
    'geo-seri': [
      { tr: 'İlk n terimin toplamını yaz.', en: 'Write the sum of the first n terms.', m: 'Sₙ = a + ar + ar² + … + arⁿ⁻¹' },
      { tr: 'İki tarafı r ile çarp.', en: 'Multiply both sides by r.', m: 'r Sₙ = ar + ar² + … + arⁿ' },
      { tr: 'Alt alta çıkar: ortadaki terimler gider.', en: 'Subtract: the middle terms cancel.', m: 'Sₙ − r Sₙ = a − arⁿ' },
      { tr: 'Sₙ’i yalnız bırak.', en: 'Solve for Sₙ.', m: 'Sₙ = a (1 − rⁿ) / (1 − r)' },
      { tr: '|r| < 1 ise n büyüdükçe rⁿ → 0.', en: 'If |r| < 1, rⁿ → 0 as n grows.', m: 'S = lim Sₙ = a / (1 − r)' }
    ],
    /* ---------- Fizik I ---------- */
    'zamansiz': [
      { tr: 'Sabit ivmede hız doğrusal artar; süreyi çek.', en: 'At constant acceleration speed grows linearly; solve for time.', m: 'v = v₀ + a t  ⟹  t = (v − v₀) / a' },
      { tr: 'Yer değiştirme = ortalama hız × süre.', en: 'Displacement = average velocity × time.', m: 'Δx = (v + v₀)/2 · t' },
      { tr: 't’yi yerine koy.', en: 'Substitute t.', m: 'Δx = (v + v₀)/2 · (v − v₀)/a' },
      { tr: 'Pay iki kare farkı: (v + v₀)(v − v₀) = v² − v₀².', en: 'The numerator is a difference of squares.', m: '2a Δx = v² − v₀²' },
      { tr: 'Süre denklemden çıktı: zamansız hız denklemi.', en: 'Time is gone: the timeless equation.', m: 'v² = v₀² + 2a Δx' }
    ],
    'menzil': [
      { tr: 'İlk hızı bileşenlerine ayır.', en: 'Split the launch velocity into components.', m: ['yatay: v₀ cos θ   ·   dikey: v₀ sin θ', 'horizontal: v₀ cos θ   ·   vertical: v₀ sin θ'] },
      { tr: 'Dikeyde: aynı yüksekliğe dönüş süresi.', en: 'Vertically: time to return to launch height.', m: '0 = v₀ sin θ · t − ½ g t²  ⟹  t = 2 v₀ sin θ / g' },
      { tr: 'Yatayda ivme yok: yol = hız × süre.', en: 'No horizontal acceleration: distance = speed × time.', m: 'R = v₀ cos θ · 2 v₀ sin θ / g' },
      { tr: '2 sin θ cos θ = sin 2θ özdeşliğini kullan.', en: 'Use 2 sin θ cos θ = sin 2θ.', m: 'R = v₀² sin 2θ / g' },
      { tr: 'sin 2θ en çok 1 olur: en uzun menzil θ = 45°’de.', en: 'sin 2θ peaks at 1: maximum range at θ = 45°.', m: 'Rₘₐₓ = v₀² / g' }
    ],
    /* ---------- Fizik II ---------- */
    'sigac-enerji': [
      { tr: 'Sığaçta q yük varken plakalar arası gerilim:', en: 'With charge q on the capacitor the voltage is:', m: 'V(q) = q / C' },
      { tr: 'Küçük bir dq yükünü taşımak için yapılan iş:', en: 'Work to bring a small charge dq across:', m: 'dW = V(q) dq = (q / C) dq' },
      { tr: 'Yükü 0’dan Q’ya kadar topla.', en: 'Add it up from 0 to Q.', m: 'U = ∫₀^Q (q / C) dq = Q² / (2C)' },
      { tr: 'Q = C V yaz.', en: 'Substitute Q = C V.', m: 'U = ½ C V²' }
    ],
    'paralel-iki': [
      { tr: 'Paralel kolların uçları ortak: gerilim aynı.', en: 'Parallel branches share their ends: same voltage.', m: 'V₁ = V₂ = V' },
      { tr: 'Toplam akım kollara ayrılır (Kirchhoff akım yasası).', en: 'The current splits between branches (Kirchhoff’s current law).', m: 'I = I₁ + I₂ = V/R₁ + V/R₂' },
      { tr: 'Eşdeğer direnç I = V / Reş ile tanımlanır.', en: 'The equivalent resistance satisfies I = V / Req.', m: ['1/Reş = 1/R₁ + 1/R₂', '1/Req = 1/R₁ + 1/R₂'] },
      { tr: 'Paydaları eşitle ve ters çevir.', en: 'Combine the fractions and invert.', m: ['Reş = R₁R₂ / (R₁ + R₂)', 'Req = R₁R₂ / (R₁ + R₂)'] }
    ],
    /* ---------- Lineer Cebir ---------- */
    'ters2': [
      { tr: 'Aranan B matrisi A · B = I eşitliğini sağlamalı.', en: 'We want B with A · B = I.', m: 'A = [a  b ; c  d]' },
      { tr: 'Adayı dene: köşegeni yer değiştir, diğerlerinin işaretini çevir.', en: 'Try this: swap the diagonal, negate the off-diagonal.', m: 'B = [d  −b ; −c  a]' },
      { tr: 'Çarp ve bak.', en: 'Multiply and check.', m: 'A · B = [ad − bc   0 ; 0   ad − bc] = (ad − bc) I' },
      { tr: 'ad − bc ile böl; bu yüzden det A ≠ 0 olmalı.', en: 'Divide by ad − bc, which is why det A ≠ 0.', m: 'A⁻¹ = 1/(ad − bc) · [d  −b ; −c  a]' }
    ],
    'cramer2': [
      { tr: 'İki bilinmeyenli sistem:', en: 'A system in two unknowns:', m: 'ax + by = e ,   cx + dy = f' },
      { tr: 'y’yi yok et: 1. denklemi d, 2. denklemi b ile çarp.', en: 'Eliminate y: multiply the first by d, the second by b.', m: 'adx + bdy = ed ,   bcx + bdy = bf' },
      { tr: 'Alt alta çıkar.', en: 'Subtract.', m: '(ad − bc) x = ed − bf' },
      { tr: 'ad − bc ≠ 0 ise böl.', en: 'Divide, assuming ad − bc ≠ 0.', m: 'x = (ed − bf) / (ad − bc)' },
      { tr: 'Pay ve payda birer determinant: Cramer kuralı.', en: 'Numerator and denominator are determinants: Cramer’s rule.', m: 'x = det[e  b ; f  d] / det[a  b ; c  d]' }
    ],
    /* ---------- Diferansiyel Denklemler ---------- */
    'buyume': [
      { tr: 'Değişim hızı o anki miktarla orantılı.', en: 'The rate of change is proportional to the amount.', m: 'dy/dt = k y' },
      { tr: 'Değişkenleri ayır.', en: 'Separate the variables.', m: 'dy / y = k dt' },
      { tr: 'İki tarafın integralini al.', en: 'Integrate both sides.', m: 'ln |y| = k t + C' },
      { tr: 'Üstel al; t = 0’da y = y₀ olduğundan e^C = y₀.', en: 'Exponentiate; at t = 0, y = y₀ so e^C = y₀.', m: 'y(t) = y₀ eᵏᵗ' }
    ],
    'yari-omur': [
      { tr: 'Bozunmada miktar üstel azalır.', en: 'In decay the amount falls exponentially.', m: 'y(t) = y₀ e⁻ᵏᵗ' },
      { tr: 'Yarı ömürde miktar başlangıcın yarısıdır.', en: 'At the half-life the amount is half the start.', m: 'y₀ / 2 = y₀ e^(−k t½)' },
      { tr: 'y₀ sadeleşir; iki tarafın ln’ini al.', en: 'Cancel y₀ and take ln of both sides.', m: 'ln(1/2) = −k t½' },
      { tr: 'ln(1/2) = −ln 2.', en: 'ln(1/2) = −ln 2.', m: 't½ = ln 2 / k' }
    ],
    /* ---------- İstatistik ---------- */
    'bayes': [
      { tr: 'Koşullu olasılığın tanımı:', en: 'Definition of conditional probability:', m: 'P(A|B) = P(A ∩ B) / P(B)' },
      { tr: 'Aynı kesişimi öbür yönden yaz.', en: 'Write the same intersection the other way round.', m: 'P(A ∩ B) = P(B|A) · P(A)' },
      { tr: 'Yerine koy.', en: 'Substitute.', m: 'P(A|B) = P(B|A) · P(A) / P(B)' },
      { tr: 'Payda genelde toplam olasılıkla bulunur.', en: 'The denominator usually comes from total probability.', m: 'P(B) = P(B|A)P(A) + P(B|Aᶜ)P(Aᶜ)' }
    ],
    'binom': [
      { tr: 'n bağımsız deneme; her birinde başarı olasılığı p.', en: 'n independent trials, each a success with probability p.', m: ['başarı: p   ·   başarısızlık: 1 − p', 'success: p   ·   failure: 1 − p'] },
      { tr: 'Belirli bir dizilimin (k başarı, n − k başarısızlık) olasılığı:', en: 'Probability of one specific sequence (k successes, n − k failures):', m: 'pᵏ (1 − p)ⁿ⁻ᵏ' },
      { tr: 'k başarının yeri C(n, k) farklı biçimde seçilir.', en: 'The k successes can be placed in C(n, k) ways.', m: 'C(n, k) = n! / (k! (n − k)!)' },
      { tr: 'Dizilimler ayrık olaylar: olasılıkları toplanır.', en: 'Sequences are disjoint, so their probabilities add.', m: 'P(X = k) = C(n, k) pᵏ (1 − p)ⁿ⁻ᵏ' }
    ],
    /* ---------- Sayısal Yöntemler ---------- */
    'newton-raphson': [
      { tr: 'xₙ noktasında eğriye teğet çiz.', en: 'Draw the tangent to the curve at xₙ.', m: 'y = f(xₙ) + f′(xₙ) (x − xₙ)' },
      { tr: 'Teğetin x eksenini kestiği yer yeni tahmindir.', en: 'Where the tangent hits the x-axis is the next guess.', m: '0 = f(xₙ) + f′(xₙ) (xₙ₊₁ − xₙ)' },
      { tr: 'xₙ₊₁’i yalnız bırak.', en: 'Solve for xₙ₊₁.', m: 'xₙ₊₁ = xₙ − f(xₙ) / f′(xₙ)' },
      { tr: 'f′(xₙ) sıfıra yakınsa adım patlar: başlangıcı köke yakın seç.', en: 'If f′(xₙ) is near zero the step blows up: start close to the root.', m: 'f′(xₙ) ≠ 0' }
    ],
    'yamuk': [
      { tr: '[a, b] aralığını n eşit parçaya böl.', en: 'Split [a, b] into n equal pieces.', m: 'h = (b − a) / n ,   xᵢ = a + i h' },
      { tr: 'Her parçada eğrinin yerine düz çizgi koy: bir yamuk.', en: 'Replace the curve on each piece with a straight line: a trapezoid.', m: 'Aᵢ ≈ h (fᵢ + fᵢ₊₁) / 2' },
      { tr: 'Bütün yamukları topla.', en: 'Add all the trapezoids.', m: '∫ₐᵇ f dx ≈ h/2 [(f₀ + f₁) + (f₁ + f₂) + … + (fₙ₋₁ + fₙ)]' },
      { tr: 'İç noktalar iki kez sayıldı.', en: 'Interior points were counted twice.', m: '∫ₐᵇ f dx ≈ h/2 [f₀ + 2f₁ + … + 2fₙ₋₁ + fₙ]' }
    ]
  };
})(window);
