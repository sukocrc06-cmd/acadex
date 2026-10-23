import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
import textwrap
plt.rcParams.update({'font.family':'DejaVu Sans','pdf.fonttype':42,'pdf.compression':9})
NAVY='#1f2f5c'; BLUE='#3b6fe0'
W,H=8.27,11.69
def page(pdf,n,body):
    f=plt.figure(figsize=(W,H))
    f.text(0.07,0.965,'İKTİSADA GİRİŞ · GRAFİK YORUMLAMA ÇALIŞMA KÂĞIDI',fontsize=7.5,color='#666',weight='bold')
    f.text(0.93,0.965,f'Sayfa {n}',fontsize=7.5,color='#666',weight='bold',ha='right')
    body(f); pdf.savefig(f); plt.close(f)
def lines(f,y,txt,size=9.5,width=95,lead=0.017,weight='normal'):
    for p in txt.split('\n'):
        for ln in (textwrap.wrap(p,width) or ['']): f.text(0.07,y,ln,fontsize=size,weight=weight); y-=lead
    return y
INTRO='''Ekonomik veriler çoğunlukla sütun, çizgi ve daire grafikleriyle sunulur. Sınavlarda grafik soruları genellikle yorum bazlıdır: öğrenciden grafikteki değerleri okuyarak eğilimi, en yüksek ve en düşük değerleri, iki dönem arasındaki değişimi ya da bir kalemin toplam içindeki payını değerlendirmesi beklenir.
Sütun grafiği farklı kategorileri ya da yılları karşılaştırmak için kullanılır. Çizgi grafiği zaman içindeki değişimi göstermeye uygundur; iki seri aynı grafikte verildiğinde aradaki fark (örneğin satış ile maliyet arasındaki fark kârı verir) yorumlanabilir. Daire grafiği bir bütünün parçalarını yüzde olarak gösterir ve dilimlerin toplamı yüzde yüzdür.
Yüzde değişim şu formülle hesaplanır: (Yeni değer − Eski değer) / Eski değer × 100. Örneğin bir değişken 40'tan 50'ye çıkmışsa artış oranı %25'tir. Bir dönemden diğerine azalma varsa yüzde değişim negatif olur.
"Sürekli artmıştır" ifadesinin doğru olması için her dönemin değeri bir öncekinden büyük olmalıdır; tek bir düşüş bu ifadeyi yanlış yapar. "En yüksek" ya da "en düşük" ifadeleri tüm dönemler karşılaştırılarak değerlendirilmelidir.
Öncüllü sorularda (I, II, III) her ifade ayrı ayrı grafikle karşılaştırılır ve doğru olanların bileşimi seçilir. "Hangisi söylenemez?" sorularında ise grafikle çelişen tek seçenek aranır.
Aşağıdaki sayfalarda bu konuya ait örnek sorular yer almaktadır.'''
def p1(f):
    f.text(0.07,0.925,'Grafik Yorumlama: Konu Özeti',fontsize=15,weight='bold'); lines(f,0.895,INTRO)
def clean(ax): ax.spines[['top','right']].set_visible(False)
def c_bar(ax):
    x=['2019','2020','2021','2022','2023']; y=[180,169,225,254,256]; b=ax.bar(x,y,color=NAVY,width=.6)
    for r,v in zip(b,y): ax.text(r.get_x()+r.get_width()/2,v+4,str(v),ha='center',fontsize=9)
    ax.set_title('Yıllara göre ihracat',fontsize=11); ax.set_xlabel('Yıl'); ax.set_ylabel('Milyar $'); ax.set_ylim(0,300); clean(ax)
def c_line(ax):
    x=['2019','2020','2021','2022','2023']; s=[120,135,150,140,170]; m=[90,100,105,115,120]
    ax.plot(x,s,marker='o',color=NAVY,label='Satış'); ax.plot(x,m,marker='s',color=BLUE,label='Maliyet')
    for i,(a,b) in enumerate(zip(s,m)): ax.text(i,a+4,str(a),ha='center',fontsize=8.5); ax.text(i,b-10,str(b),ha='center',fontsize=8.5)
    ax.set_title('Bir firmanın satış ve maliyetleri',fontsize=11); ax.set_xlabel('Yıl'); ax.set_ylabel('Bin TL'); ax.set_ylim(60,190); ax.legend(frameon=False,loc='upper left'); clean(ax)
def c_pie(ax):
    l=['Marmara','Ege','İç Anadolu','Akdeniz','Diğer']; v=[38,17,15,12,18]
    ax.pie(v,labels=[f'{a} %{b}' for a,b in zip(l,v)],colors=[NAVY,BLUE,'#7fa2ef','#b9cbf5','#d9d9d9'],startangle=90,counterclock=False,wedgeprops={'edgecolor':'white'},textprops={'fontsize':9})
    ax.set_title('Bölgelere göre pazar payı (%)',fontsize=11)
def c_q(ax):
    x=['1. çeyrek','2. çeyrek','3. çeyrek','4. çeyrek']; y=[40,50,65,55]; b=ax.bar(x,y,color=BLUE,width=.55)
    for r,v in zip(b,y): ax.text(r.get_x()+r.get_width()/2,v+1.5,str(v),ha='center',fontsize=9)
    ax.set_title('2024 yılı çeyreklik satış adedi',fontsize=11); ax.set_ylabel('Bin adet'); ax.set_ylim(0,80); clean(ax)
def qp(title,chart,stem,opts,prem=None,extra=None,rect=(0.14,0.55,0.76,0.3)):
    def body(f):
        f.text(0.07,0.925,title,fontsize=12,weight='bold'); f.text(0.07,0.9,'Aşağıdaki grafik ile ilgili soruyu cevaplayınız.',fontsize=9.5)
        chart(f.add_axes(rect)); y=0.5
        y=lines(f,y,stem)
        for p in (prem or []): y=lines(f,y,p)
        y-=0.006
        for o in opts: y=lines(f,y,o)
        if extra: lines(f,y-0.02,extra)
    return body
with PdfPages('grafik-yorumlama-ornek.pdf') as pdf:
    page(pdf,1,p1)
    page(pdf,2,qp('Soru 1',c_bar,'Grafiğe göre aşağıdaki ifadelerden hangileri doğrudur?',['A) Yalnız I','B) Yalnız II','C) I ve II','D) I ve III','E) I, II ve III'],['I. 2020 yılında ihracat bir önceki yıla göre azalmıştır.','II. 2019–2023 döneminde ihracat sürekli artmıştır.','III. En yüksek ihracat 2023 yılında gerçekleşmiştir.']))
    page(pdf,3,qp('Soru 2',c_line,'Grafiğe göre aşağıdakilerden hangisi söylenemez?',['A) Satışlar 2022 yılında bir önceki yıla göre azalmıştır.','B) Maliyetler incelenen dönem boyunca sürekli artmıştır.','C) Satış ile maliyet arasındaki fark en fazla 2023 yılındadır.','D) 2019 yılında satış maliyetten 30 bin TL fazladır.','E) Maliyetler 2021 yılında satışları geçmiştir.']))
    page(pdf,4,qp('Soru 3',c_pie,'Grafiğe göre aşağıdakilerden hangisi söylenebilir?',['A) En düşük pazar payı Ege bölgesine aittir.',"B) Marmara'nın payı Ege ve İç Anadolu'nun toplamından fazladır.","C) Akdeniz'in payı İç Anadolu'dan fazladır.","D) Diğer bölgelerin payı Ege'den azdır.","E) Marmara'nın payı toplamın yarısından fazladır."],rect=(0.2,0.54,0.6,0.32)))
    page(pdf,5,qp('Soru 4',c_q,'Grafiğe göre 2. çeyrekten 3. çeyreğe satış adedi yüzde kaç artmıştır?',['A) %15','B) %20','C) %25','D) %30','E) %35'],extra='Soru 5 (açık uçlu): Aynı grafiğe göre yılın ikinci yarısındaki satış eğilimini yorumlayınız.'))
    d=pdf.infodict(); d['Title']='Grafik Yorumlama Çalışma Kâğıdı'
