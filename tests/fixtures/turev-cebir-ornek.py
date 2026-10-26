# Faz 3b canlı testi: sembolik cebir ve türev (ifade sorusu için kaynak)
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
pdfmetrics.registerFont(TTFont('DV','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DVB','/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
H=ParagraphStyle('h',fontName='DVB',fontSize=15,leading=20,spaceAfter=8)
H2=ParagraphStyle('h2',fontName='DVB',fontSize=11.5,leading=16,spaceBefore=10,spaceAfter=4)
B=ParagraphStyle('b',fontName='DV',fontSize=10.2,leading=15,spaceAfter=6)
doc=SimpleDocTemplate('turev-cebir-ornek.pdf',pagesize=A4,leftMargin=56,rightMargin=56,topMargin=56,bottomMargin=56,title='Matematik 1: Cebirsel İfadeler ve Türev')
P=lambda t,s=B: Paragraph(t,s)
story=[P('Matematik 1 · Cebirsel İfadeler ve Türev',H),
P('1. Cebirsel ifadeleri sadeleştirme',H2),
P('Benzer terimler toplanarak ifade sadeleştirilir: 3x + 2y − x + 4y = 2x + 6y. Parantez açılırken dağılma özelliği kullanılır: 2(x + 3) − (x − 1) = 2x + 6 − x + 1 = x + 7. Çarpanlara ayırmada ortak çarpan paranteze alınır: 6x² + 9x = 3x(2x + 3). İki kare farkı: a² − b² = (a − b)(a + b). Tam kare: (a + b)² = a² + 2ab + b².'),
P('2. Rasyonel ifadeler',H2),
P('Pay ve payda çarpanlarına ayrılarak sadeleştirilir: (x² − 9)/(x − 3) = x + 3 (x ≠ 3). Paydalar eşitlenerek toplama yapılır: 1/x + 1/(x+1) = (2x + 1)/(x(x + 1)).'),
P('3. Türev kuralları',H2),
P('Kuvvet kuralı: (xⁿ)′ = n·xⁿ⁻¹. Sabitin türevi sıfırdır; sabitle çarpım korunur: (c·f)′ = c·f′. Toplamın türevi türevlerin toplamıdır. Örnek: f(x) = 4x³ − 5x² + 7x − 2 için f′(x) = 12x² − 10x + 7.'),
P('Çarpım kuralı: (f·g)′ = f′g + fg′. Örnek: (x²·(3x + 1))′ = 2x(3x + 1) + 3x² = 9x² + 2x. Bölüm kuralı: (f/g)′ = (f′g − fg′)/g². Zincir kuralı: (f(g(x)))′ = f′(g(x))·g′(x). Örnek: ((2x + 1)⁵)′ = 10(2x + 1)⁴.'),
P('Üstel ve logaritmik fonksiyonlar: (eˣ)′ = eˣ, (ln x)′ = 1/x, (e^{kx})′ = k·e^{kx}. Örnek: (x·ln x)′ = ln x + 1.'),
P('4. İktisatta türev',H2),
P('Toplam maliyet C(q) = q³ − 6q² + 15q + 20 ise marjinal maliyet MC(q) = C′(q) = 3q² − 12q + 15 olur. Toplam hasılat R(q) = p·q ve talep p = 50 − 2q ise R(q) = 50q − 2q² ve marjinal hasılat MR(q) = 50 − 4q bulunur.'),
]
doc.build(story)
