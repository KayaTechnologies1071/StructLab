# StructLab - Yapı Statiği Analiz Yazılımı
## Teknik Şartname ve Özellik Belgesi

**Sürüm:** 1.0.0
**Tarih:** 22 Şubat 2026
**Geliştirici:** Süleyman Kaya
**Platform:** Web Tabanlı (React, TypeScript, Tailwind CSS)
**Altyapı:** Tamamen İstemci Taraflı (Client-side), Matris Analiz Motoru

---

## 1. Sistemin Amacı ve Kapsamı
**StructLab**, inşaat mühendisleri, mimarlar ve mühendislik öğrencileri için geliştirilmiş, izostatik ve hiperstatik (sürekli kirişler ve 2D çerçeve/kafes sistemler) taşıyıcı sistemlerin yapısal analizini tarayıcı üzerinden anında ve görsel olarak gerçekleştiren modern bir yapı statiği analiz programıdır.

Uygulama temel olarak iki ana analiz modülüne ayrılmıştır:
1. **Beam Analysis** (Sürekli Kiriş Analizi)
2. **Frame / Truss Analysis** (2D Çerçeve ve Kafes Sistem Analizi)

---

## 2. Sürekli Kiriş Analizi (Beam Analysis) Modülü
Bu modül, tek açıklıklı basit kirişlerden, çok açıklıklı sürekli (hiperstatik) kirişlere ve mafsallı (Gerber) kirişlere kadar geniş bir yelpazeyi yatay x-ekseni üzerinde analiz etmek için tasarlanmıştır.

### 2.1. Desteklenen Sınır Şartları (Mesnetler)
Sistem, üç temel sınır şartını destekler ve x eksenindeki konumlarına göre serbestçe eklenebilir:
- **Sabit Mesnet (Pinned):** Düşey ve yatay ötelemeyi engeller, moment aktarmaz.
- **Kayıcı Mesnet (Roller):** Sadece düşey ötelemeyi engeller, moment aktarmaz.
- **Ankastre Mesnet (Fixed):** Yatay, düşey ötelemeyi ve dönmeyi tamamen engeller, reaksiyon momenti üretir.
- **Mesnet Çökmesi:** Her bir mesnet için mm cinsinden aşağı veya yukarı zorunlu deplasman tanımlanabilir.

### 2.2. Kiriş İçi Tanımlamalar
- **Mafsallar (Hinges):** Eğilme momentini sıfırlayan ve kirişi statik olarak ayıran iç mafsallar eklenebilir.
- **Malzeme Özellikleri:** Elastisite Modülü ($E$ - GPa) ve Kesit Atalet Momenti ($I$ - $cm^4$).

### 2.3. Kesit Zorlamaları ve Yük Tipleri
Geometri üzerinde limitsiz sayıda yük tanımlanabilir.
- **Noktasal Yük (Point Load):** Seçilen konumda (metre), $y$ (veya açılı) ekseninde uygulanan tekil kuvvetler ($kN$).
- **Yayılı Yük (Distributed Load):** Başlangıç ve bitiş noktası belirtilen düzgün veya değişken (üçgen/trapez) yayılı yükler ($kN/m$).
- **Tekil Moment (Point Moment):** Belirli bir noktada x-y düzleminde burulma/eğilme yaratan moment yükleri ($kNm$).
- **Sıcaklık Değişimi:** Çizilen her bir açıklık (Span) için kesitin altı ve üstü arasındaki dış sıcaklık farkları ($T_{top}, T_{bot}$) kaynaklı termal eğilmeler.

### 2.4. Çözüm Yetenekleri ve Çıktılar
Sistem, girilen Kiriş problemini eşzamanlı olarak dört alt çözümleyici (solver) ile değerlendirir:
- **Ana Analiz Motoru:** Tam Kesme Kuvveti ($V$), Eğilme Momenti ($M$) ve Elastik Eğri/Çökme ($D$) diyagramı grafiklerini çıkartır. Maksimum değerleri metin olarak listeler.
- **Clapeyron Teoremi (3 Moment):** Hiperstatik kirişlerde klasik denklemleri, düğüm noktalarındaki moment matrisini adım adım kullanıcıya eğitim amaçlı gösterir.
- **Cross Yöntemi (Moment Dağıtma):** Ankastrelik uç kuvvetlerini, düğüm rijitlik ve dağıtma (Redör) katsayılarına göre tablo şeklinde iteratif olarak sıfıra yaklaştırarak çözer.
- **Müller-Breslau Tesir Çizgileri:** Kiriş üzerinde hareket eden 1 birimlik dingil yükünün x ekseni boyunca istenilen x' noktasında yaratacağı Maksimum Kesme veya Moment değişimini çizer.

---

## 3. 2D Çerçeve ve Kafes Analizi (Frame/Truss Analysis) Modülü
Bu modül, uzayda (x, y düzleminde) serbestçe çizilebilen, 3 Serbestlik Derecesine sahip (DOF: $u, v, \theta$) düğümler (Nodes) ve bükülebilir çubuklardan (Members) oluşan kompleks Çerçeve (Frame) ve Kafes (Truss) yapılarını yerel rijitlik matrisleri oluşturarak çözer.

### 3.1. Geometri Tabanlı Modelleme
- **Düğümler (Nodes):** Koordinat sisteminde (x, y) sonlu elemanlar düğümleri oluşturulur.
- **Mesnet Şartları (Support):** Oluşturulan düğümler tamamen bağımsız (none) bırakılabileceği gibi; Sabit (Pinned), Kayıcı (Roller) veya Ankastre (Fixed) mesnetler atanabilir.
- **Çubuklar (Members):** Düğümleri birleştiren kolon ve kiriş elemanları. Eksenel kuvvetler için Kesit Alanı ($A$, $cm^2$) ve Çerçeve momenti için Atalet momenti ($I$, $cm^4$) girilir. Eğilme rijitliği sağlanır.

### 3.2. Frame Analiz Yük Tipleri
Sistem, kiriş analizine ek olarak lokal ve global eksen dönüşümleri dikkate alınarak geliştirilmiştir.
- **Açılı Noktasal Yük (Point Load):** İlgili çubuğun seçilen metresine göre, Global açı koordinat açısıyla (0-360°) etki eden tekil kuvvet eklenebilir. Standart düşey yük yönü 270 derecedir.
- **Açılı Yayılı Yük (Distributed Load):** Çubuğun seçilen kesit aralığına ve belirtilen açıya (Angle) göre yerçekimi sömünü (örneğin kar veya rüzgar yükü) simüle edilebilir.

### 3.3. Çözüm Yetenekleri (Sonlu Elemanlar Matrisi)
- İlgili analizin motoru $6 \times 6$ Kiriş-Sütun (Euler-Bernoulli) rijitlik matrisinden dönüştürülmüş büyük bir sistem Rijitlik ($K$) matrisi inşa eder.
- Çubuklar üzerine gelen yükler, uç düğümlere Ankastrelik Uç Kuvvetleri (Fixed End Moments/Forces - FEM) olarak aktarılır.
- **Çıktılar:**
  - Düğümler için küresel yer değiştirmeler ($dx, dy$) ve dönme açıları ($\theta$ radian/mrad).
  - Her bir çubuk için lokal eksende Eksenel Kuvvet ($N$), Kesme Kuvveti ($V$) ve Bükülme Momenti ($M$) serbest cisim sonuçları (Start/End forces).
  - Tuval (Canvas) üzerinde Mavi ($N$), Camgöbeği ($V$) ve Kırmızı ($M$) renk kodlarına ayrılmış dinamik Analiz diyagramı vizualizasyonları.

---

## 4. Kullanıcı Arayüzü (UI), Deneyim (UX) ve Araçlar

### 4.1. Mobil Uyumlu ve Adaptif Tasarım
Sistem tamamen mobil uyumlu (Responsive) olarak tasarlanmıştır. "MainLayout" ve "Header" bileşenleri TailwindCSS breakpoint'lerine göre kırılır; geniş ekranlarda yanda duran "Controls" ve "Results" panelleri, dar ekranlı tablet ve telefonlarda gizli "Drawer" menüler ve alt gezinme çubuğu (Bottom Navigation Tab) kullanarak ferah bir Çizim Tahtası (Workspace) bölgesi bırakır.

### 4.2. Katmanlar ve Çizim Yönetimi (Visualization Toggles)
Kullanıcı, analiz tuvalindeki veri karmaşasından kurtulmak için üst menüdeki araçları (Göz İkonları) kullanabilir:
- *Yükleri (Loads), Tepkileri (Reactions), Düğümleri (Nodes) ve Ölçümleri (Dimensions)* bağımsız olarak gizleyip açabilir.
- Arayüz elemanları, karanlık tema (Dark Mode) modern kod editörlerine sadık kalarak Slate-Cyan renk paletiyle çizilmiş, interaktif hover efektleriyle donatılmıştır.

### 4.3. Yüksek Çözünürlüklü Görüntü Aktarımı (PNG Export)
Sistem (DOM tabanlı HTML2Canvas altyapısı yardımıyla); o an vizualizasyonda olan saf Analiz diyagramlarını, kullanıcı yapılandırmasını dikkate alıp transparan ve arka plan gerektirmeyen (Vektörel SVG tabanından üretilmiş) Yüksek Çözünürlüklü bir PNG fotoğrafı olarak dışa aktarır. Resmi evraklara konulacak bu render'lara sağ alt kısımda şık bir filigran ("StructLab.kayasuleyman.com" & Logo Watermark) damgalanır.

### 4.4. Çoklu Dil Destekli Yardım ve Dökümantasyon
- Sistem, **"StructLab Kullanım Kılavuzu" (Docs)** adında özel bir modülle gelir. Modal pencerelerle ayrılmış kılavuz paneli, TR-EN (Türkçe / İngilizce) dinamik dil değişimi destekler. Tüm çözücü metodolojiler ve PNG indirme formatları detaylıca listelenmiştir.
- Sağ üst **"Help"** menüsü ile analizcilere kısa "Yenilikler" turu attırılır ve sistemin sosyal ağ (LinkedIn) yetkili iletişimi sağlanır.

---

## 5. Yazılım Mimarisi (Geliştirici Notları)
- **State Management:** React `useState` ve props-drilling veya Context pattern yardımıyla merkezi `App.tsx` yönetiminden beslenen modüler analiz bileşenleri mevcuttur.
- **Hesaplamalar:** Matematik motorları (`BeamAnalyzer.ts`, `TrussAnalyzer.ts`, `CrossMethodAnalyzer.ts` vb.) UI render döngüsünden bağımsız soyutlanmış (Vanilla TS) fonksiyon bloklarıdır. Tarayıcı işlemcisinin yorulmaması hedeflenmiştir.
- **Birim Testleri:** `verify_reactions.mjs`, `verify_gerber.mjs` test komut dosyaları, analiz sisteminin iteratif entegrasyonlarına karşı doğruluk algoritmalarını güvence altın alır. Kiriş denge ($ΣF=0, ΣM=0$) şartları terminal üzerinden denetlenmiştir.

## Onay Belgesi
> Bu doküman StructLab projesinde tamamlanmış güncel özellikleri referans alarak hazırlanmış resmi kapsam/teknik spesifikasyon formudur. Proje, talep edilen tüm analitik koşulları karşılayacak biçimde stabil ve teste hazır olarak teslim standartlarındadır.
