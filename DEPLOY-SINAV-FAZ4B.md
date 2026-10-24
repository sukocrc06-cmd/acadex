# Sınav Platformu — Faz 4b.1: grafik çizme sorusu

Yeni soru tipi **çizim** (`graph`). Öğrenci cevabı koordinat ızgarasında çizer ya da yazarak girer. Puanı kod verir; yapay zekâ puan vermez.

Tasarım, örnek alınan platformların özellikleri ve kullanıcı şikâyetleri araştırılarak yapıldı: WebAssign, WeBWorK GraphTool, Norton Smartwork ekonomi aracı, Khan Academy, Möbius; MyLab ve ALEKS yorumları; WCAG 2.5.7.

## Öğrencinin gördüğü

- **Araçlar:** seç/taşı, nokta, doğru, doğru parçası, ışın, parabol, çember, alan, bölge boyama, verilen doğruyu kaydırma.
  - Yalnızca sorunun gerektirdiği araçlar görünür; nokta ve doğru her zaman vardır.
- **Çizerek giriş:** dokun-dokun çizilir, sürükleme gerekmez (sürüklemek de çalışır).
  - Noktalar ızgaraya yapışır.
  - İmlecin koordinatı canlı yazar ("Q = 3, P = 6").
  - Her araç ne yapılacağını bir satırla söyler.
- **Yazarak giriş:** çizim yeteneği gerekmez.
  - Kabul edilen biçimler: "P = 12 − 2Q", "D: P = 12 − 2Q", "E(3; 6)", "(0; 12) (6; 0)", "Q = 4", "(2,5; 4)".
  - Eksen harfleri (Q, P) ve Türkçe ondalık kabul edilir.
  - Yazılan nesne anında çizilir.
- **Nesne listesi:** her nesnenin denklemi ya da koordinatları görünür ve kutulardan düzeltilebilir. Ayrıca:
  - etiket seçilebilir (D, S, E…);
  - düz/kesikli değiştirilebilir;
  - nesne silinebilir.
- **Düzenleme:** geri al, yinele, temizle ve "çizilecek bir şey yok (çözüm yok)" kutusu.
- **Klavye:** çizim alanında ok tuşları imleci taşır, Enter yerleştirir, Esc vazgeçer, Delete siler, Ctrl+Z geri alır.
  - Çizim alanındayken ok tuşları soru değiştirmez.
- **Ekran okuyucu:** her işlemi söyler ("Eklendi: Doğru D: P = −2Q + 12").
- **Telefon:** 390 px'te yatay taşma yok; çizim alanı ekran yüksekliğinin en çok %68'i.

## Puanlama (grade-exam, kodla)

Her öğe ayrı puanlanır; not = öğe kredileri toplamı / (öğe sayısı + fazladan çizim).

| Öğe | Tam | Yarım |
|---|---|---|
| Doğru | İki noktası da doğrunun üstünde (hangi iki nokta olduğu önemsiz) | Eğim doğru ama kaymış, ya da doğru bir noktadan geçiyor ama eğim farklı |
| Nokta | Yarım ızgara adımı içinde | Yalnızca x ya da yalnızca y doğru |
| Kaydırma (yalnızca yön soruluysa) | Verilene paralel ve doğru yönde | Yön doğru, eğim değişmiş |
| Parça / ışın | İki uç / başlangıç ve yön | Bir uç / yalnızca başlangıç |
| Parabol / çember | Tepe + açıklık / merkez + yarıçap | Biri doğru |
| Alan | Örtüşme ≥ %90 | ≥ %60 |
| Bölge boyama | Örnek noktaların ≥ %97'si doğru tarafta | ≥ %85 |

Ek kurallar:
- **Etiket:** istenmiş ama yanlışsa öğenin kredisi yarıya iner.
- **Çizgi türü:** düz/kesikli yanlışsa kredinin dörtte üçü kalır.
- **Tekrar:** aynı nesneyi iki kez çizmek ceza değildir.
- **Yanlış deneme:** "fazladan çizim" sayılmaz; notu neyin yanlış olduğunu söyler.
- **Çözüm yok:** soru "çözüm yok" ise yalnızca kutuyu işaretleyip hiçbir şey çizmemek 100 alır.
- **Anahtar bozuksa:** soru puanlanamaz ve nota katılmaz.

## Sonuç kâğıdı

- **Üst üste çizim:** verilenler gri, öğrencinin çizimi mavi, doğrusu yeşil kesikli.
- **Öğe öğe açıklama:** her öğe ✓ / ½ / ✗ ile işaretli; örneğin "eğim doğru ama doğru kaymış", "doğru sağa kaymalıydı", "etiketi D olmalıydı (sen S yazdın)", "sınır kesikli çizilmeliydi".
- **Metin olarak cevaplar:** "senin cevabın" ve "doğrusu" okunur metin olarak yazar ("Doğru D: P = −2Q + 12 · Nokta E (3; 6)"). Hata defteri ve eski sonuç ekranı da aynı metni gösterir.

## Üretim (generate-exam)

- **Ne zaman:** çizim soruları yalnızca karışık ve hesaplama sınavlarında, kaynak koordinat düzleminde çizilen bir konu öğretiyorsa gelir. Örnekler: doğrusal fonksiyon, eşitsizlik, parabol, arz-talep, denge ve kayma, bütçe doğrusu, tüketici/üretici artığı, taban/tavan fiyat. Sınavların yaklaşık beşte biri çizim sorusu.
- **Modelin verdiği:** ızgara ve cevabın **tanımı**. Örnekler: `y = 12 - 2*x`; kesişim `{"intersect": ["a0", "a1"]}`; doğru üstünde nokta `{"on": "g0", "x": 0}`; kaydırma `{"shift_of": "g0", "direction": "right"}`; bölge `["y < -x + 4"]`.
- **Kodun yaptığı** (`verifyGraph`):
  - Bütün koordinatları hesaplar.
  - Cevap ızgara kesişimlerine oturmuyorsa soruyu atar (`graph_off_grid`). Öteki atılma nedenleri: `graph_axes_invalid`, `graph_no_answer`, `graph_shift_wrong_dir`, `graph_shift_not_parallel`, `graph_*_invalid`.
  - Yarım adım gerekiyorsa yapışma adımını yarıya indirir.
- **Cevabın yeri:** cevap (`graph_answer`) anahtarda durur; tarayıcıya yalnızca ızgara ve verilen nesneler gider.
- **Token:** çizim açıkken soru başına +60 çıktı tokenı.

## "Grafik sorusu olmasın" kutusu

- **Kurulum:** pencerede yeni bir kutu var, varsayılanı **işaretsiz**. İşaretsizken grafik okuma (Faz 4a) ve çizim soruları kaynak uygunsa kendiliğinden gelir.
- **İşaretlenirse:** grafik okuma da çizim de gelmez. "Dosyadaki grafik sorularına göre" kutusu gizlenir, kapakta `GRAFİK: grafik sorusu yok` satırı çıkar.
- **İstek:** `noGraphs: true`.

## Mevcut işleyişe etkisi

- **Eski sınavlar ve öteki tipler:** değişmedi. `allowedTypesFor` eski çağrıda aynı listeyi döndürür (testte denetleniyor).
- **Test ve klasik sınavlar:** çizim sorusu gelmez.
- **İtiraz:** çizim sorusunda itiraz yok, çünkü puan kodla veriliyor. "Soru hatalı" bildirimi var.
- **Migration:** yok.

## Deploy (sıra önemli)

1. **`grade-exam`:** çizim sorusunu puanlayabilmesi için önce bu.
2. **`generate-exam`.**
3. **Ön yüz:** PR birleşince Vercel'den kendiliğinden çıkar.

Ters sırada deploy edilirse çizim sorusu olan bir sınav notlanırken o soru sonuçta görünmez.

## Elle kontrol

- [ ] Arz-talep ya da doğrusal fonksiyon anlatan bir belgeyle karışık sınav kur. En az bir "çizim" sorusu gelmeli.
- [ ] Bir doğruyu dokunarak, birini yazarak çiz; noktayı koy, etiketleri seç. Geri al ve yinele çalışmalı.
- [ ] Telefonda dokunarak çizim yapılabilmeli; sayfa yana taşmamalı.
- [ ] Teslimden sonra çizimin ve doğrusu üst üste görünmeli; kısmi puanlar notlarıyla yazmalı.
- [ ] "Grafik sorusu olmasın" işaretliyken grafik ve çizim sorusu gelmemeli.
