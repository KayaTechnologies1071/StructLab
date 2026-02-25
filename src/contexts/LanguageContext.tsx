import React, { createContext, useContext, useState, type ReactNode } from 'react';

export type Language = 'en' | 'tr';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
}

const translations = {
    en: {
        // General
        'app.title': 'StructLab',
        'app.beam': 'Beam Analysis',
        'app.truss': 'Truss Analysis',
        'app.docs': 'Docs',
        'app.help': 'Help',
        'app.linkedin': 'LinkedIn',

        // Panels
        'panel.geometry': 'Geometry',
        'panel.supports': 'Supports',
        'panel.hinges': 'Hinges (Gerber)',
        'panel.tempLoad': 'Temperature Load',
        'panel.loads': 'Loads',
        'panel.nodes': 'Nodes',
        'panel.members': 'Members',

        // Beam Inputs
        'beam.length': 'Beam Length',
        'beam.elasticModulus': 'Elastic Modulus (E)',
        'beam.inertia': 'Inertia (I)',
        'support.type': 'Type',
        'support.pinned': 'Pinned',
        'support.roller': 'Roller',
        'support.fixed': 'Fixed',
        'support.none': 'None',
        'support.position': 'Position',
        'support.settlement': 'Settlement',
        'support.angle': 'Angle',
        'load.point': 'Point (Nodal)',
        'load.moment': 'Moment',
        'load.distributed': 'Distributed',
        'load.magnitude': 'Magnitude',
        'load.angle': 'Angle',
        'load.startPos': 'Start Pos',
        'load.endPos': 'End Pos',
        'load.targetNode': 'Target Node',
        'load.targetMember': 'Target Member',

        // Tooltips (Info)
        'info.beamLength': 'Total span of the continuous beam. Loads and supports must fall within this length.',
        'info.supports': 'Boundary conditions for the structure. Pinned prevents translation, Roller allows movement along its plane, Fixed prevents translation and rotation.',
        'info.supportAngle': 'Rotates the support base by the specified angle (in degrees). Affects reaction force vectors (Rx, Ry).',
        'info.settlement': 'Prescribed downward displacement of a support (e.g., foundation sinking). Causes induced moments in continuous beams.',
        'info.hinges': 'Internal moment releases. Bending moment is zero at hinge locations.',
        'info.tempLoad': 'Applies uniform temperature change (axial expansion) or temperature gradient (bending) to the structure.',
        'info.loads': 'External forces. Can be pointing load (kN), distributed load (kN/m), or pure moment (kNm).',
        'info.nodes': 'Joint coordinates for Truss/Frame structures. Every member connects between two nodes.',
        'info.members': 'Line elements connecting nodes. Requires Area (axial stiffness) and Inertia (bending stiffness for frames).',
        'info.area': 'Cross-sectional area. Governs axial stiffness (EA/L) in truss execution.',
        'info.inertia': 'Moment of inertia. Governs bending stiffness (EI/L) for rigid frames and beams.',

        // Visualizer / Controls
        'vis.loads': 'Loads',
        'vis.reactions': 'Reactions',
        'vis.nodes': 'Nodes',
        'vis.dimensions': 'Dimensions',
        'vis.png': 'PNG',

        // Results
        'results.title': 'Results',
        'results.reactions': 'Support Reactions',
        'results.internalForces': 'Member Internal Forces',
        'results.displacements': 'Nodal Displacements',
        'results.internal': 'Member Internal Forces',
        'results.member': 'Member',
        'results.node': 'Node',
        'results.equilibrium': 'Equilibrium Check',
        'results.shear': 'Shear Force (V)',
        'results.moment': 'Bending Moment (M)',
        'results.deflection': 'Deflection (δ)'
    },
    tr: {
        // General
        'app.title': 'StructLab',
        'app.beam': 'Sürekli Kiriş',
        'app.truss': 'Çerçeve & Kafes',
        'app.docs': 'Kılavuz',
        'app.help': 'Yardım',
        'app.linkedin': 'LinkedIn',

        // Panels
        'panel.geometry': 'Geometri',
        'panel.supports': 'Mesnetler',
        'panel.hinges': 'Mafsallar (Gerber)',
        'panel.tempLoad': 'Sıcaklık Yükü',
        'panel.loads': 'Yükler',
        'panel.nodes': 'Düğümler',
        'panel.members': 'Çubuklar',

        // Beam Inputs
        'beam.length': 'Kiriş Uzunluğu',
        'beam.elasticModulus': 'Elastisite Modülü (E)',
        'beam.inertia': 'Atalet Momenti (I)',
        'support.type': 'Tipi',
        'support.pinned': 'Sabit',
        'support.roller': 'Hareketli (Kavale)',
        'support.fixed': 'Ankastre',
        'support.none': 'Yok',
        'support.position': 'Konum',
        'support.settlement': 'Çökme',
        'support.angle': 'Açı (°)',
        'load.point': 'Tekil Yük',
        'load.moment': 'Moment',
        'load.distributed': 'Yayılı Yük',
        'load.magnitude': 'Büyüklük',
        'load.angle': 'Açı',
        'load.startPos': 'Başlangıç',
        'load.endPos': 'Bitiş',
        'load.targetNode': 'Hedef Düğüm',
        'load.targetMember': 'Hedef Çubuk',

        // Tooltips (Info)
        'info.beamLength': 'Sürekli kirişin toplam uzunluğu. Mesnetler ve yükler bu aralıkta olmalıdır.',
        'info.supports': 'Yapı çubuklarının sınır koşulları. Sabit mesnet ötelemeyi engeller, Hareketli kayma düzleminde serbesttir, Ankastre ise tüm ötelenme ve dönmeleri kitler.',
        'info.supportAngle': 'Mesnedi belirtilen derece kadar x ekseni etrafında döndürür. Tepki kuvvetlerinin (Rx, Ry) yeni düzleme göre ayrılmasını sağlar.',
        'info.settlement': 'Zemin oturması gibi zorunlu çökmeler. Hiperstatik (sürekli) kirişlerde ilave iç kuvvet (moment) yaratır.',
        'info.hinges': 'İç mafsallar (Gerber). Bu noktalarda eğilme momenti her zaman sıfırdır.',
        'info.tempLoad': 'Yapıya üniform sıcaklık değişimi (eksenel genleşme) veya sıcaklık farkı (eğilme) uygular.',
        'info.loads': 'Dış kuvvetler. Sisteme Tekil Yük (kN), Yayılı Yük (kN/m) veya Salt Moment (kNm) etki ettirebilirsiniz.',
        'info.nodes': 'Kafes/Çerçeve sistemlerindeki düğüm (bağlantı) noktaları. X ve Y koordinatları ile tanımlanır.',
        'info.members': 'Düğümleri birbirine bağlayan çubuk elemanlar. Çözüm için Alan (A) ve Atalet Momenti (I) gereklidir.',
        'info.area': 'Çubuğun enkesit alanı (A). Kafes sistemlerdeki eksenel (çekme/basınç) rijitliğini (EA/L) belirler.',
        'info.inertia': 'Atalet momenti (I). Çerçeve ve Kiriş sistemlerdeki eğilme rijitliğini (EI/L) belirler.',

        // Visualizer / Controls
        'vis.loads': 'Yükler',
        'vis.reactions': 'Tepkiler',
        'vis.nodes': 'Düğümler',
        'vis.dimensions': 'Ölçüler',
        'vis.png': 'PNG',

        // Results
        'results.title': 'Sonuçlar',
        'results.reactions': 'Mesnet Tepkileri',
        'results.internalForces': 'Çubuk İç Kuvvetleri',
        'results.displacements': 'Düğüm Deplasmanları',
        'results.internal': 'Çubuk İç Kuvvetleri',
        'results.member': 'Çubuk',
        'results.node': 'Düğüm',
        'results.equilibrium': 'Denge Kontrolü',
        'results.shear': 'Kesme Kuvveti (V)',
        'results.moment': 'Eğilme Momenti (M)',
        'results.deflection': 'Deplasman Diyagramı (δ)'
    }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Detect browser language or default to 'en'
    const [language, setLanguage] = useState<Language>(() => {
        const saved = localStorage.getItem('structlab-lang') as Language;
        if (saved) return saved;
        return navigator.language.startsWith('tr') ? 'tr' : 'en';
    });

    const handleSetLanguage = (lang: Language) => {
        setLanguage(lang);
        localStorage.setItem('structlab-lang', lang);
    };

    const t = (key: string): string => {
        const dict = translations[language];
        return (dict as any)[key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
