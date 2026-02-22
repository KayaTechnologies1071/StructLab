import React, { useState } from 'react';
import { BookOpen, X, Globe, ChevronRight } from 'lucide-react';

interface DocsPageProps {
    onClose: () => void;
    initialModule?: 'beam' | 'truss';
}

type Lang = 'tr' | 'en';

export const DocsPage: React.FC<DocsPageProps> = ({ onClose, initialModule = 'beam' }) => {
    const [lang, setLang] = useState<Lang>('tr');
    const [activeSection, setActiveSection] = useState<'beam' | 'frame'>(initialModule === 'truss' ? 'frame' : 'beam');

    const toggleLang = () => setLang(l => (l === 'tr' ? 'en' : 'tr'));

    const content = {
        tr: {
            beam: {
                title: 'Sürekli Kiriş Analizi (Beam Analysis)',
                sections: [
                    {
                        title: '1. Sistemin Kurulumu (Mesnetler ve Açıklıklar)',
                        body: 'Kiriş modülünde analiz yapabilmek için sol paneldeki "SUPPORTS" kısmından mesnet ekleyin. Her mesnedin konumunu (X Metre) ve tipini (Pinned: Sabit, Roller: Kayıcı, Fixed: Ankastre) belirleyebilirsiniz. İki mesnet arası otomatik olarak bir açıklık (Span) oluşturur.',
                    },
                    {
                        title: '2. Yüklerin Tanımlanması',
                        body: 'Yükleri "LOADS" panelinden ekleyebilirsiniz. "Point" (Noktasal Yük), "Distributed" (Yayılı Yük) ve "Moment" (Tekil Moment) olmak üzere üç tip yük atanabilir. Yüklerin yönü negatiftir (Aşağı yönde kuvvetler pozitiftir).',
                    },
                    {
                        title: '3. Mafsallar (Gerber Kirişleri)',
                        body: 'Kiriş üzerine mafsal (Hinge) eklemek isterseniz, eklediğiniz yükleri Moment değeri 0 olan noktalarla kontrol edebilirsiniz. Özel mafsal ekleme işlemi "HINGES" panelinden konum (Metre) belirtilerek yapılır.',
                    },
                    {
                        title: '4. İleri Düzey Etkiler: Sıcaklık ve Çökme',
                        body: 'Eğer bir mesnette çökme (Settlement) yaşanıyorsa, o mesnedin ayarlarından "Settlement (mm)" değerini girebilirsiniz. Sıcaklık farkları için açıklıklara (Spans) alt ve üst sıcaklık (T_top, T_bot) ataması yapabilirsiniz.',
                    },
                    {
                        title: '5. Çözüm Yöntemleri ve Çıktı Alma (Export)',
                        body: 'Sağ paneldeki sekmeler:\n- **Sonuçlar (Results):** Reaktanslar, Mesnet kesme/moment değerleri ve diyagramların tepe noktaları.\n- **Clapeyron (Üç Moment):** Sürekli kirişleri çözmek için kullanılan matris yönteminin adım adım denklemleri.\n- **Cross (Moment Dağıtım):** Ankastrelik uç momentlerinin düğümlere rijitlikleri oranında dağıtıldığı iteratif yöntem.\n- **Tesir (Influence):** Kiriş üzerinde hareket eden birim yükün oluşturduğu kesme ve moment değişimini gösteren Müller-Breslau tesir çizgileri.\n\n**Görüntü İndirme:** Çizim alanının (Workspace) üzerindeki Yükler, Tepkiler ve Ölçüler katmanlarını Göz (Eye) ikonlarına tıklayarak gizleyip/açabilirsiniz. Temizlediğiniz bu çizimleri veya analiz diyagramlarını yanlarındaki "📷 PNG" butonuna basarak yüksek çözünürlüklü şeffaf görsel olarak bilgisayarınıza indirebilirsiniz.'
                    }
                ]
            },
            frame: {
                title: '2D Çerçeve ve Kafes Analizi (Frame/Truss Analysis)',
                sections: [
                    {
                        title: '1. Düğüm (Node) ve Çubuk (Member) Mantığı',
                        body: 'Bu modülde yapıları X ve Y koordinat düzleminde çizersiniz. Önce "NODES" panelinden uzayda noktalar (Düğümler) oluşturun. Daha sonra "MEMBERS" panelinden bu düğümleri birbirine bağlayarak kolon ve kirişleri (Çubukları) oluşturun.',
                    },
                    {
                        title: '2. Mesnet Tipleri ve Sınır Şartları',
                        body: 'Oluşturduğunuz düğümlere 3 farklı mesnet atayabilirsiniz:\n- **Pinned (Sabit):** X ve Y yönünde yer değiştirmeyi engeller, dönebilir.\n- **Roller (Kayıcı):** Sadece Y yönünde (veya X yönünde) yer değiştirmeyi engeller.\n- **Fixed (Ankastre):** X, Y yer değiştirmesini ve Dönmeyi engeller. Tam rijit mesnettir.',
                    },
                    {
                        title: '3. Eleman Özellikleri (Alan ve Atalet)',
                        body: 'Çubukların davranışını kesit özellikleri belirler. Her bir Member için A (Alan, cm²) ve I (Atalet Momenti, cm⁴) değerlerini girebilirsiniz. Elastisite modülü (E) varsayılan olarak çeliktir (200 GPa).',
                    },
                    {
                        title: '4. Çubuklara Yük Atamak',
                        body: 'İki tür spesifik yönde yük atacaksınız:\n- **Global Açı (Angle):** Yükün yere göre açısıdır. 0° sağa, 90° yukarı, 180° sola ve 270° aşağı doğrudan etkir (Standart yerçekimi yükü için 270° kullanın).\n- Noktasal ve Yayılı yükler çubukların (Members) üzerine başlangıç-bitiş metrelerine göre atanır.',
                    },
                    {
                        title: '5. Görselleştirme, Sonuç Okuma ve Çıktı Alma (Export)',
                        body: 'Sağ üst köşedeki düğmeleri kullanarak farklı diyagramları görüntüleyebilirsiniz:\n- **Axial (Eksenel Kuvvet):** Mavi renkle çizilir. (Çekme pozitif, Basınç negatiftir)\n- **Shear (Kesme Kuvveti):** Camgöbeği rengiyle çizilir.\n- **Moment (Eğilme Momenti):** Kırmızı renkle çizilir. \nTepe değerleri grafik üzerinde yazmaktadır. Sağ panelde ise Her bir düğümün net Deplasmanı (mm, mrad) ve elemanların başlangıç/bitiş uç kuvvetleri tabular olarak mevcuttur.\n\n**Görüntü İndirme:** Düğüm, Yük, Tepki ve Ölçü katmanlarını ekrandaki Göz (Eye) butonlarından kapayarak sade bir görünüm elde edebilirsiniz. "📷 PNG" butonuna basarak anlık grafiği (analiz diyagramları dahil) projenize eklemek üzere yüksek çözünürlüklü olarak formatında indirebilirsiniz.'
                    }
                ]
            }
        },
        en: {
            beam: {
                title: 'Continuous Beam Analysis',
                sections: [
                    {
                        title: '1. System Setup (Supports and Spans)',
                        body: 'To analyze a beam, add supports from the "SUPPORTS" panel on the left. You can define the position (X in meters) and type (Pinned, Roller, Fixed) of each support. A span is automatically created between any two supports.',
                    },
                    {
                        title: '2. Defining Loads',
                        body: 'Loads can be added from the "LOADS" panel. Three types are available: "Point" Load, "Distributed" Load, and Concentrated "Moment". Note that downward continuous loads act in the positive input magnitude direction.',
                    },
                    {
                        title: '3. Hinges (Gerber Beams)',
                        body: 'If you want to add an internal hinge to the beam (where bending moment becomes 0), you can add them from the "HINGES" panel by specifying their exact coordinate (Meters).',
                    },
                    {
                        title: '4. Advanced Effects: Temperature & Settlement',
                        body: 'If a support experiences differential settlement, enter the value in the "Settlement (mm)" field of that support. For temperature gradients across the beam depth, assign top and bottom temperatures (T_top, T_bot) via the Spans panel.',
                    },
                    {
                        title: '5. Solution Methods & PNG Export',
                        body: 'The tabs on the right panel provide comprehensive insights:\n- **Results:** Reactions, internal forces, and diagram peak values.\n- **Clapeyron (Three-Moment Equation):** Step-by-step matrix derivation for continuous beams.\n- **Cross (Moment Distribution):** An iterative method distributing fixed-end moments according to stiffness.\n- **Influence Lines:** Visualize maximum shear or moment responses as a unit load traverses the beam using Müller-Breslau principles.\n\n**Exporting Images:** Use the Eye icons in the toolbar to toggle the visibility of Loads, Reactions, and Dimensions to clean up the workspace. Then, click the "📷 PNG" button to export and download a high-resolution, transparent image of the current structural diagram directly to your device.'
                    }
                ]
            },
            frame: {
                title: '2D Frame & Truss Analysis',
                sections: [
                    {
                        title: '1. Nodes and Members Concept',
                        body: 'In this module, you draw structures on an X-Y coordinate plane. First, create points in space (Nodes) from the "NODES" panel. Then, build columns and beams (Members) by connecting these nodes from the "MEMBERS" panel.',
                    },
                    {
                        title: '2. Support Types and Boundary Conditions',
                        body: 'You can assign 3 different support conditions to your nodes:\n- **Pinned:** Restricts translation in X and Y, but allows rotation.\n- **Roller:** Restricts translation only in the Y direction (or specific restricted axis).\n- **Fixed:** Restricts X, Y translations, and Rotation. It creates a fully rigid boundary.',
                    },
                    {
                        title: '3. Member Properties (Area & Inertia)',
                        body: 'The cross-sectional properties define the behavior of the members. You can input A (Cross-sectional Area, cm²) and I (Moment of Inertia, cm⁴) for each Member. The Modulus of Elasticity (E) defaults to structural steel (200 GPa).',
                    },
                    {
                        title: '4. Assigning Loads to Members',
                        body: 'You apply loads to exact member local coordinates using global angles:\n- **Global Angle:** Describes the load vector relative to the ground. 0° points right, 90° points up, 180° points left, and 270° points down (Use 270° for standard gravity loads).\n- Point and distributed loads are assigned onto Members using relative start/end distances in meters.',
                    },
                    {
                        title: '5. Visualization & PNG Export',
                        body: 'Use the buttons at the top right of the canvas to toggle different internal force diagrams:\n- **Axial Force:** Drawn in blue. (Tension is positive, Compression is negative)\n- **Shear Force:** Drawn in cyan.\n- **Bending Moment:** Drawn in red.\nPeak values are overlaid directly on the graph. The right panel provides tabular exact values for Nodal Displacements (mm, mrad) and local Member End Forces.\n\n**Exporting Images:** Click the Eye icons to toggle the visibility of specific structure layers (Nodes, Loads, Reactions, Dimensions) for a clean look. Once ready, click the "📷 PNG" button to download a high-quality snapshot of the active structural diagram.'
                    }
                ]
            }
        }
    };

    const currentData = content[lang][activeSection];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 sm:p-8 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700/80 shadow-2xl rounded-xl w-full max-w-5xl h-full max-h-[85vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <BookOpen className="text-blue-500" size={24} />
                        <h2 className="text-lg font-bold text-slate-100">
                            {lang === 'tr' ? 'StructLab Kullanım Kılavuzu' : 'StructLab User Manual'}
                        </h2>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={toggleLang}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors text-sm font-medium border border-slate-700 hover:border-slate-600"
                        >
                            <Globe size={16} className="text-blue-400" />
                            {lang === 'tr' ? 'English' : 'Türkçe'}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-red-500/20 rounded-md transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar */}
                    <div className="w-64 bg-slate-900/40 border-r border-slate-800 p-4 flex flex-col gap-2">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 pl-2">
                            {lang === 'tr' ? 'Modüller' : 'Modules'}
                        </div>
                        <button
                            onClick={() => setActiveSection('beam')}
                            className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeSection === 'beam'
                                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
                                }`}
                        >
                            {lang === 'tr' ? 'Sürekli Kiriş Analizi' : 'Continuous Beam'}
                            {activeSection === 'beam' && <ChevronRight size={16} />}
                        </button>
                        <button
                            onClick={() => setActiveSection('frame')}
                            className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeSection === 'frame'
                                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
                                }`}
                        >
                            {lang === 'tr' ? '2D Çerçeve Analizi' : '2D Frame Analysis'}
                            {activeSection === 'frame' && <ChevronRight size={16} />}
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                        <div className="max-w-3xl">
                            <h1 className="text-2xl font-black text-white mb-8 border-b border-slate-800 pb-4">
                                {currentData.title}
                            </h1>

                            <div className="space-y-8">
                                {currentData.sections.map((sec, idx) => (
                                    <div key={idx} className="bg-slate-800/30 rounded-lg p-5 border border-slate-800/80">
                                        <h3 className="text-lg font-bold text-blue-400 mb-3 flex items-center gap-2">
                                            {sec.title}
                                        </h3>
                                        <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                                            {sec.body}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
