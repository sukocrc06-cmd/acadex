# Faz 4b.2 canlı testi: konu anlatımı + çizim soruları (çiziniz, işaretleyiniz, tarayınız, kaydırınız)
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, PageBreak
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
pdfmetrics.registerFont(TTFont('DV','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DVB','/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
H=ParagraphStyle('h',fontName='DVB',fontSize=15,leading=20,spaceAfter=8)
H2=ParagraphStyle('h2',fontName='DVB',fontSize=11.5,leading=16,spaceBefore=10,spaceAfter=4)
B=ParagraphStyle('b',fontName='DV',fontSize=10.2,leading=15,spaceAfter=6)
doc=SimpleDocTemplate('cizim-sorulari-ornek.pdf',pagesize=A4,leftMargin=56,rightMargin=56,topMargin=56,bottomMargin=56,title='Doğrusal Fonksiyonlar ve Piyasa Dengesi — Çizim Alıştırmaları')
P=lambda t,s=B: Paragraph(t,s)
story=[P('İktisada Giriş · Doğrusal Fonksiyonlar ve Piyasa Dengesi',H),
P('Konu özeti',H2),
P('Doğrusal bir fonksiyon y = mx + n biçimindedir; m eğimi, n dikey ekseni kestiği noktayı gösterir. İktisatta talep P = a − bQ, arz P = c + dQ biçiminde yazılır. Yatay eksende miktar (Q), dikey eksende fiyat (P) bulunur. Piyasa dengesi talep ve arz doğrularının kesiştiği noktadır.'),
P('Talepte artış (gelir artışı, ikame malın pahalanması) talep doğrusunu sağa kaydırır; azalış sola kaydırır. Arzda artış arz doğrusunu sağa kaydırır. Kaydırılan doğru, eski doğruya paraleldir.'),
P('Bir eşitsizliğin çözüm kümesi, sınır doğrusunun bir tarafında kalan bölgedir. Sınır “≤” ya da “≥” ise düz, “<” ya da “>” ise kesikli çizilir.'),
PageBreak(),
P('Alıştırma soruları (koordinat düzleminde cevaplayınız)',H),
P('1. Talep fonksiyonu P = 10 − Q ve arz fonksiyonu P = 2 + Q olarak verilmiştir. Talep (D) ve arz (S) doğrularını aynı koordinat düzleminde çiziniz ve piyasa dengesini E harfiyle işaretleyiniz.'),
P('2. P = 10 − Q talep doğrusu verilmiştir. Tüketicilerin gelirleri arttığında talep 4 birim artmaktadır. Yeni talep doğrusunu (D2) çiziniz; doğruyu hangi yöne kaydırdığınızı belirtiniz.'),
P('3. 2x + y ≤ 6 bütçe kısıtını sağlayan bölgeyi koordinat düzleminde tarayınız. Sınır doğrusunu çizmeyi unutmayınız.'),
P('4. y = 2x − 2 doğrusunu çiziniz ve doğrunun yatay ekseni kestiği noktayı işaretleyiniz.'),
]
doc.build(story)
