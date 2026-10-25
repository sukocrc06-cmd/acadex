from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
pdfmetrics.registerFont(TTFont('DV','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DVB','/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
H=ParagraphStyle('h',fontName='DVB',fontSize=15,leading=20,spaceAfter=8)
H2=ParagraphStyle('h2',fontName='DVB',fontSize=11.5,leading=16,spaceBefore=10,spaceAfter=4)
B=ParagraphStyle('b',fontName='DV',fontSize=10.2,leading=15,spaceAfter=6)
doc=SimpleDocTemplate('arz-talep-ders-notu.pdf',pagesize=A4,leftMargin=56,rightMargin=56,topMargin=56,bottomMargin=56,title='Arz, Talep ve Piyasa Dengesi')
P=lambda t,s=B: Paragraph(t,s)
story=[P('Mikroiktisat 1 · Arz, Talep ve Piyasa Dengesi',H),
P('1. Talep doğrusu',H2),
P('Talep, belirli bir dönemde tüketicilerin farklı fiyatlarda satın almak istedikleri miktarı gösterir. Diğer koşullar sabitken fiyat yükseldikçe talep edilen miktar azalır (talep yasası). Doğrusal bir talep fonksiyonu P = a − bQ biçiminde yazılır; burada P fiyatı, Q miktarı gösterir. Grafikte yatay eksende miktar (Q), dikey eksende fiyat (P) bulunur. Talep doğrusu negatif eğimlidir: eğimi −b, dikey ekseni kestiği nokta a (Q = 0 iken fiyat), yatay ekseni kestiği nokta a/b (P = 0 iken miktar) olur.'),
P('Örnek: P = 12 − 2Q talep doğrusu dikey ekseni P = 12 noktasında, yatay ekseni Q = 6 noktasında keser. Doğruyu çizmek için bu iki noktayı birleştirmek yeterlidir.'),
P('2. Arz doğrusu',H2),
P('Arz, üreticilerin farklı fiyatlarda satmak istedikleri miktardır. Fiyat yükseldikçe arz edilen miktar artar; bu nedenle arz doğrusu pozitif eğimlidir. Doğrusal arz fonksiyonu P = c + dQ biçimindedir. Örneğin P = 3 + Q arz doğrusu dikey ekseni P = 3 noktasında keser ve her bir birimlik miktar artışında fiyat bir birim yükselir.'),
P('3. Piyasa dengesi',H2),
P('Piyasa dengesi, talep edilen miktarın arz edilen miktara eşit olduğu noktadır. Grafikte talep ve arz doğrularının kesiştiği noktadır ve genellikle E harfiyle gösterilir. Denge fiyatı ve miktarı iki denklemin ortak çözümüyle bulunur: 12 − 2Q = 3 + Q ise Q* = 3 ve P* = 6 olur. Denge fiyatının üzerindeki bir fiyatta arz fazlası, altındaki bir fiyatta talep fazlası (kıtlık) oluşur.'),
P('4. Eğrilerin kayması',H2),
P('Fiyat dışındaki bir belirleyici değiştiğinde eğrinin tamamı kayar. Normal bir mal için gelir arttığında talep doğrusu sağa (dışarı) kayar; gelir azaldığında sola kayar. İkame bir malın fiyatı yükseldiğinde de talep sağa kayar. Üretim maliyetleri düştüğünde ya da teknoloji geliştiğinde arz doğrusu sağa kayar; girdi fiyatları yükseldiğinde sola kayar. Doğrusal eğrilerde paralel kayma varsayılır: eğim değişmez, yalnızca doğrunun konumu değişir. Talebin sağa kayması diğer koşullar sabitken denge fiyatını ve denge miktarını artırır.'),
P('5. Tüketici ve üretici artığı',H2),
P('Tüketici artığı, tüketicilerin bir mal için ödemeye razı oldukları en yüksek fiyat ile fiilen ödedikleri fiyat arasındaki farkın toplamıdır. Grafikte talep doğrusunun altında ve denge fiyatının üstünde kalan üçgen alandır. P = 12 − 2Q ve P* = 6 için bu üçgenin köşeleri (0; 12), (3; 6) ve (0; 6) olup alanı 9 birimdir. Üretici artığı ise denge fiyatının altında ve arz doğrusunun üstünde kalan üçgendir.'),
P('6. Tavan ve taban fiyat',H2),
P('Devletin belirlediği tavan fiyat, denge fiyatının altında konulduğunda bağlayıcıdır ve talep fazlasına yol açar. Taban fiyat, denge fiyatının üstünde konulduğunda bağlayıcıdır ve arz fazlasına yol açar. Grafikte tavan ve taban fiyatlar yatay doğrularla gösterilir (örneğin P = 4).'),
P('7. Bütçe doğrusu ve eşitsizlikler',H2),
P('Tüketicinin bütçe kısıtı p<sub>x</sub>x + p<sub>y</sub>y ≤ M eşitsizliğiyle gösterilir. Bütçe doğrusu p<sub>x</sub>x + p<sub>y</sub>y = M doğrusudur; tüketicinin satın alabileceği mal sepetleri bu doğrunun altında ve eksenlerin içinde kalan bölgedir. Örneğin 2x + y ≤ 8 bütçe kümesinin sınırı y = 8 − 2x doğrusudur ve satın alınabilir sepetler bu doğrunun altında kalan bölgedir.'),
]
doc.build(story)
