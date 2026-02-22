import React, { useState } from 'react';
import type { AnalysisResult, Structure } from './types';
import { ArrowDownUp, Activity, Layers, CheckCircle, AlertCircle } from 'lucide-react';

interface FrameResultsProps {
    results: AnalysisResult | null;
    structure: Structure;
}

const formatNum = (v: number, dec = 3) =>
    isFinite(v) ? v.toFixed(dec) : '–';

const SectionHeader = ({ icon, title, color }: { icon: React.ReactNode; title: string; color: string }) => (
    <div className={`flex items-center gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900/60`}>
        <span className={color}>{icon}</span>
        <span className={`text-[10px] font-bold uppercase tracking-wider ${color}`}>{title}</span>
    </div>
);

export const FrameResults: React.FC<FrameResultsProps> = ({ results, structure }) => {
    const [tab, setTab] = useState<'disp' | 'react' | 'forces'>('disp');

    if (!results) {
        return (
            <div className="flex flex-col items-center justify-center h-full py-16 text-slate-600 gap-3">
                <Activity size={32} opacity={0.3} />
                <div className="text-xs text-center">
                    <div className="font-semibold text-slate-500 mb-1">Analiz Sonucu Yok</div>
                    <div className="text-slate-600">▶ butonuna basın veya elementi seçin</div>
                </div>
            </div>
        );
    }

    const supportNodes = structure.nodes.filter(n =>
        n.restraints.dx || n.restraints.dy || n.restraints.rz
    );

    const sumFy = supportNodes.reduce((s, n) => {
        const r = results.reactions[n.id];
        return s + (r?.fy ?? 0);
    }, 0);

    const tabs = [
        { id: 'disp' as const, label: 'Deplasman' },
        { id: 'react' as const, label: 'Tepki' },
        { id: 'forces' as const, label: 'Eleman' },
    ];

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Tab Bar */}
            <div className="flex gap-0.5 p-2 border-b border-slate-800 bg-slate-950/50">
                {tabs.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`flex-1 px-2 py-1 text-[10px] font-bold uppercase rounded transition-all ${tab === t.id
                                ? 'bg-indigo-600 text-white shadow'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {/* ── DISPLACEMENTS ── */}
                {tab === 'disp' && (
                    <div>
                        <SectionHeader
                            icon={<ArrowDownUp size={12} />}
                            title="Düğüm Deplasman ve Dönmeleri"
                            color="text-cyan-400"
                        />
                        <table className="w-full text-[10px] font-mono">
                            <thead>
                                <tr className="border-b border-slate-800 text-slate-500">
                                    <th className="px-3 py-1.5 text-left">Düğüm</th>
                                    <th className="px-2 py-1.5 text-right">dx (mm)</th>
                                    <th className="px-2 py-1.5 text-right">dy (mm)</th>
                                    <th className="px-2 py-1.5 text-right">rz (mrad)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {structure.nodes.map(n => {
                                    const d = results.nodeDisplacements[n.id];
                                    if (!d) return null;
                                    const dx = d.dx * 1000;
                                    const dy = d.dy * 1000;
                                    const rz = (d.rz ?? 0) * 1000;
                                    const isFixed = n.restraints.dx && n.restraints.dy;
                                    return (
                                        <tr key={n.id} className={`border-b border-slate-800/40 hover:bg-slate-800/20 ${isFixed ? 'opacity-40' : ''}`}>
                                            <td className="px-3 py-1.5 text-blue-300 font-bold">{n.id}</td>
                                            <td className={`px-2 py-1.5 text-right ${Math.abs(dx) > 0.001 ? 'text-emerald-300' : 'text-slate-600'}`}>
                                                {formatNum(dx)}
                                            </td>
                                            <td className={`px-2 py-1.5 text-right ${Math.abs(dy) > 0.001 ? 'text-emerald-300' : 'text-slate-600'}`}>
                                                {formatNum(dy)}
                                            </td>
                                            <td className={`px-2 py-1.5 text-right ${Math.abs(rz) > 0.001 ? 'text-amber-300' : 'text-slate-600'}`}>
                                                {formatNum(rz)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ── REACTIONS ── */}
                {tab === 'react' && (
                    <div>
                        <SectionHeader
                            icon={<Layers size={12} />}
                            title="Mesnet Tepkileri"
                            color="text-amber-400"
                        />
                        <table className="w-full text-[10px] font-mono">
                            <thead>
                                <tr className="border-b border-slate-800 text-slate-500">
                                    <th className="px-3 py-1.5 text-left">Düğüm</th>
                                    <th className="px-2 py-1.5 text-right">Rx (kN)</th>
                                    <th className="px-2 py-1.5 text-right">Ry (kN)</th>
                                    <th className="px-2 py-1.5 text-right">Mz (kNm)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {supportNodes.map(n => {
                                    const r = results.reactions[n.id] ?? { fx: 0, fy: 0, mz: 0 };
                                    return (
                                        <tr key={n.id} className="border-b border-slate-800/40 hover:bg-slate-800/20">
                                            <td className="px-3 py-1.5 text-amber-300 font-bold">{n.id}</td>
                                            <td className="px-2 py-1.5 text-right text-slate-300">{formatNum(r.fx ?? 0)}</td>
                                            <td className="px-2 py-1.5 text-right text-slate-300">{formatNum(r.fy ?? 0)}</td>
                                            <td className="px-2 py-1.5 text-right text-slate-300">{formatNum(r.mz ?? 0)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        <div className={`mx-3 mt-3 mb-2 flex items-center gap-2 text-[10px] rounded p-2 border ${Math.abs(sumFy) < 1
                                ? 'text-emerald-400 border-emerald-800/40 bg-emerald-900/10'
                                : 'text-red-400 border-red-800/40 bg-red-900/10'
                            }`}>
                            {Math.abs(sumFy) < 1
                                ? <CheckCircle size={11} />
                                : <AlertCircle size={11} />
                            }
                            ΣFy = {formatNum(sumFy, 2)} kN
                            {Math.abs(sumFy) < 1 ? ' ✓ Denge sağlandı' : ' – Dengesizlik!'}
                        </div>
                    </div>
                )}

                {/* ── MEMBER FORCES ── */}
                {tab === 'forces' && (
                    <div>
                        <SectionHeader
                            icon={<Activity size={12} />}
                            title="Eleman Uç Kuvvetleri (Yerel)"
                            color="text-purple-400"
                        />
                        {structure.members.map(m => {
                            const mf = results.memberForces[m.id];
                            if (!mf) return null;
                            const { N: N1, V: V1, M: M1 } = mf.startForce;
                            const { N: N2, V: V2, M: M2 } = mf.endForce;
                            const maxM = Math.max(Math.abs(M1), Math.abs(M2));
                            return (
                                <div key={m.id} className="border-b border-slate-800/60 px-3 py-2">
                                    <div className="text-[10px] font-bold text-purple-300 mb-1.5">
                                        Eleman {m.id}
                                        <span className="text-slate-500 font-normal ml-2">
                                            {m.startNodeId} → {m.endNodeId}
                                        </span>
                                    </div>
                                    <table className="w-full text-[10px] font-mono">
                                        <thead>
                                            <tr className="text-slate-600">
                                                <th className="text-left pb-0.5">Uç</th>
                                                <th className="text-right pb-0.5">N (kN)</th>
                                                <th className="text-right pb-0.5">V (kN)</th>
                                                <th className="text-right pb-0.5">M (kNm)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td className="text-blue-400 pr-2">i</td>
                                                <td className={`text-right ${N1 > 0.01 ? 'text-blue-300' : N1 < -0.01 ? 'text-red-300' : 'text-slate-600'}`}>
                                                    {formatNum(N1, 2)}
                                                </td>
                                                <td className="text-right text-slate-300">{formatNum(V1, 2)}</td>
                                                <td className={`text-right ${Math.abs(M1) > maxM * 0.6 ? 'text-orange-300 font-bold' : 'text-slate-300'}`}>
                                                    {formatNum(M1, 2)}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="text-emerald-400 pr-2">j</td>
                                                <td className={`text-right ${N2 > 0.01 ? 'text-blue-300' : N2 < -0.01 ? 'text-red-300' : 'text-slate-600'}`}>
                                                    {formatNum(N2, 2)}
                                                </td>
                                                <td className="text-right text-slate-300">{formatNum(V2, 2)}</td>
                                                <td className={`text-right ${Math.abs(M2) > maxM * 0.6 ? 'text-orange-300 font-bold' : 'text-slate-300'}`}>
                                                    {formatNum(M2, 2)}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    {(Math.abs(N1) > 0.01 || Math.abs(N2) > 0.01) && (
                                        <div className={`mt-1 text-[9px] ${N1 < -0.01 ? 'text-red-400' : 'text-blue-400'}`}>
                                            {N1 < -0.01 ? '◀ Basınç' : '▶ Çekme'} elemanı
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {structure.members.length === 0 && (
                            <div className="text-center text-slate-600 py-8 text-xs">Eleman yok</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
