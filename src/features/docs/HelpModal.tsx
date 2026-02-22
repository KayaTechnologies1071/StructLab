import React from 'react';
import { HelpCircle, X, Activity, BookOpen, Layers, PenTool, BarChart2 } from 'lucide-react';

interface HelpModalProps {
    onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050510]/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700/60 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/50">
                    <div className="flex items-center gap-3 text-emerald-400">
                        <HelpCircle size={22} />
                        <h2 className="text-lg font-bold tracking-wide text-white">Yenilikler & Yardım</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-red-500/20 rounded-md transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">

                    {/* Welcome Section */}
                    <div className="flex items-start gap-4 bg-blue-900/10 border border-blue-500/20 p-5 rounded-lg">
                        <Activity className="text-blue-400 mt-1 shrink-0" size={28} />
                        <div>
                            <h3 className="text-white font-bold text-lg mb-2">StructLab'e Hoş Geldiniz!</h3>
                            <p className="text-slate-300 text-sm leading-relaxed">
                                StructLab, inşaat mühendisleri ve öğrenciler için tasarlanmış modern bir yapı statiği analiz programıdır.
                                Şu anda <strong>Sürekli Kiriş (Beam Analysis)</strong> ve <strong>2D Çerçeve (Truss/Frame Analysis)</strong>
                                modüllerini içermektedir. Tüm analizler anlık olarak tarayıcınızda (client-side) çözülür.
                            </p>
                        </div>
                    </div>

                    {/* Features Grid */}
                    <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">Ana Modüller & Özellikler</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FeatureCard
                                icon={<PenTool size={18} />}
                                title="Modern Çizim Tahtası"
                                desc="Yükler, mesnetler, ölçekler... Değişiklik yaptığınız an sonuçlar görselleştiricilere yansır."
                            />
                            <FeatureCard
                                icon={<Activity size={18} />}
                                title="Beam Analysis"
                                desc="Clapeyron Modeli, Moment Dağıtma (Cross) metodu, Tesir Çizgileri, Isı Değişimleri ve Mesnet çökmeleri."
                            />
                            <FeatureCard
                                icon={<Layers size={18} />}
                                title="Frame/Truss Analysis"
                                desc="6 Serbestlik Derecesine sahip (DOF) matris çözücü. Noktasal yük, yayılı yük ve kolon düğüm momentleri."
                            />
                            <FeatureCard
                                icon={<BarChart2 size={18} />}
                                title="PNG Export & Detay"
                                desc="Diyagram katmanlarını gizleyebilir, temiz kesme-moment sonuçlarını yüksek kalitede cihazınıza indirebilirsiniz."
                            />
                        </div>
                    </div>

                    {/* Developer Note */}
                    <div className="bg-slate-800/40 rounded-lg p-5 border border-slate-700/50">
                        <h4 className="text-slate-200 font-bold mb-2">Geliştirici Hakkında</h4>
                        <p className="text-slate-400 text-sm leading-relaxed mb-4">
                            Bu uygulama Süleyman Kaya tarafından geliştirilmektedir. Daha fazla bilgi, iş birliği veya projeyi incelemek için
                            sosyal medya (LinkedIn) bağlantısını kullanabilirsiniz.
                            Kapsamlı kullanım kılavuzu için de sağ üstteki <strong className="text-slate-200"><BookOpen size={14} className="inline mx-1" />Docs</strong> (Dökümanlar) butonunu ziyaret edebilirsiniz.
                        </p>
                        <a
                            href="https://www.linkedin.com/in/suuleymankaya0/"
                            target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors"
                        >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" /></svg>
                            LinkedIn Profili
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

const FeatureCard = ({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) => (
    <div className="bg-slate-800/30 border border-slate-700/40 rounded-lg p-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-slate-200 font-bold text-sm">
            <span className="text-cyan-400">{icon}</span>
            {title}
        </div>
        <p className="text-slate-400 text-[11px] leading-relaxed">
            {desc}
        </p>
    </div>
);
