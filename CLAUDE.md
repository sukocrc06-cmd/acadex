- **Doğrudan Kod Odaklı Ol:** Uzun açıklama yapma, temel programlama mantığını anlatma.
- **Klasör ve Büyük Dosya Tarama Sınırı:** Projenin tamamını tarama. 500 KB üstü devasa dosyalarda (`dashboard.js`, `acadex-ink.js`, `index.ts`) asla tam okuma yapma. Hedef fonksiyonu veya sınıfı bulup sadece ilgili 50-100 satırlık aralığı oku ve düzenle.
- **Windows Uyumluluğu:** Sistem Windows olduğu için doğrudan Linux `sed` komutu çalıştırıp hata alma; dosya içi aramalarda MCP `filesystem` araçlarını, Node.js tek satırlık scriptlerini veya PowerShell (`Select-String`) yapılarını kullan.
- **MCP Ajan Kullanımı:** Kütüphane/Supabase API'si eklerken ezbere gitme (`context7` kullan). Karmaşık mimari değişikliklerde önce `sequential-thinking` ile plan yap, öğrendiğin yeni kritik proje kurallarını `memory` ajanına kaydet.

## 3. Çalışma ve Güvenlik Prensibi
- Mevcut dosya yapısına, isimlendirmeye ve kod stiline birebir sadık kal. Ekstra soyutlama katmanı uydurma.
- **Git & Branch Güvenliği:** Benden habersiz `git push` yapma veya `main` branch'ini doğrudan tehlikeye atacak yıkıcı komutlar çalıştırma.

