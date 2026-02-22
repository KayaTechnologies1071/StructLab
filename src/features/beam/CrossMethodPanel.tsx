import React, { useState, useCallback } from 'react';
import { CrossMethodAnalyzer, type CrossNode, type CrossMember, type CrossLoad, type CrossResult } from '../../engine/CrossMethodAnalyzer';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Play } from 'lucide-react';

// Preset: 2-span continuous beam, fixed left end, roller middle, roller right
const DEFAULT_NODES: CrossNode[] = [
    { id: 'A', isFixed: true, isPinned: false },
    { id: 'B', isFixed: false, isPinned: false },
    { id: 'C', isFixed: false, isPinned: true },
];
const DEFAULT_MEMBERS: CrossMember[] = [
    { id: 'AB', startNodeId: 'A', endNodeId: 'B', EI: 50000, length: 6 },
    { id: 'BC', startNodeId: 'B', endNodeId: 'C', EI: 50000, length: 5 },
];
const DEFAULT_LOADS: CrossLoad[] = [
    { memberId: 'AB', type: 'udl', magnitude: 10 },
    { memberId: 'BC', type: 'udl', magnitude: 8 },
];

export const CrossMethodPanel: React.FC = () => {
    const [nodes] = useState<CrossNode[]>(DEFAULT_NODES);
    const [members, setMembers] = useState<CrossMember[]>(DEFAULT_MEMBERS);
    const [loads, setLoads] = useState<CrossLoad[]>(DEFAULT_LOADS);
    const [result, setResult] = useState<CrossResult | null>(null);
    const [tolerance] = useState(0.001);
    const [showIterations, setShowIterations] = useState(false);

    const calculate = useCallback(() => {
        const res = CrossMethodAnalyzer.analyze(nodes, members, loads, 100, tolerance);
        setResult(res);
    }, [nodes, members, loads, tolerance]);

    const updateMember = (id: string, patch: Partial<CrossMember>) => {
        setMembers(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));
    };

    const updateLoad = (memberId: string, patch: Partial<CrossLoad>) => {
        setLoads(prev => prev.map(l => l.memberId === memberId ? { ...l, ...patch } : l));
    };

    return (
        <div className="space-y-4">
            <Card title="Cross (Moment Dağıtım) Yöntemi">
                <p className="text-[10px] text-slate-500 mb-3 italic">
                    2 açıklıklı kiriş: A (ankastre) — B (ara mesnet) — C (mafsallı uç)
                </p>
                {members.map(m => {
                    const load = loads.find(l => l.memberId === m.id);
                    return (
                        <div key={m.id} className="mb-3 border-b border-slate-700/30 pb-3 last:border-0">
                            <div className="text-xs font-bold text-emerald-300 mb-2">Eleman {m.id}</div>
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase">L (m)</label>
                                    <input type="number" step={0.5} value={m.length} min={0.5}
                                        onChange={e => updateMember(m.id, { length: Number(e.target.value) })}
                                        className="w-full bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-xs text-white" />
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase">EI (kN·m²)</label>
                                    <input type="number" step={1000} value={m.EI}
                                        onChange={e => updateMember(m.id, { EI: Number(e.target.value) })}
                                        className="w-full bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-xs text-white" />
                                </div>
                                <div>
                                    <label className="text-[10px] text-red-400 uppercase">w (kN/m)</label>
                                    <input type="number" step={1} value={load?.magnitude ?? 0}
                                        onChange={e => updateLoad(m.id, { magnitude: Number(e.target.value) })}
                                        className="w-full bg-slate-800 border border-red-700/30 rounded px-1 py-0.5 text-xs text-red-200" />
                                </div>
                            </div>
                        </div>
                    );
                })}
                <Button variant="primary" icon={<Play size={14} />} onClick={calculate} className="w-full mt-2">
                    Hesapla (Cross)
                </Button>
            </Card>

            {result && (
                <Card title="Cross Sonuçları">
                    <div className="text-[10px] text-slate-400 mb-2">
                        Yakınsama: <span className="text-emerald-400 font-mono">{result.convergedAt}</span> iterasyonda
                    </div>

                    {/* End Moments Table */}
                    <div className="text-[10px] uppercase text-slate-500 mb-1">Uç Momentleri</div>
                    <div className="space-y-1 mb-3">
                        {Object.entries(result.endMoments).map(([membId, mo]) => (
                            <div key={membId} className="flex justify-between bg-slate-800/50 rounded px-2 py-1">
                                <span className="text-slate-400">{membId}</span>
                                <span className="text-amber-300 font-mono">{mo.start.toFixed(3)} / {mo.end.toFixed(3)} kNm</span>
                            </div>
                        ))}
                    </div>

                    {/* Toggle iterations table */}
                    <button
                        className="text-[10px] text-blue-400 underline mb-2"
                        onClick={() => setShowIterations(p => !p)}>
                        {showIterations ? 'Gizle' : 'İterasyon tablosunu göster'}
                    </button>

                    {showIterations && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-[9px] font-mono">
                                <thead>
                                    <tr className="text-slate-500 border-b border-slate-700">
                                        <th className="text-left py-0.5 px-1">İter</th>
                                        <th className="text-left py-0.5 px-1">Düğüm</th>
                                        <th className="text-right py-0.5 px-1">Dengesizlik</th>
                                        {members.map(m => (
                                            <th key={m.id} className="text-right py-0.5 px-1">Dağ. {m.id}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.iterations.slice(0, 40).map((it, idx) => (
                                        <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/30">
                                            <td className="py-0.5 px-1 text-slate-500">{it.iterationNumber}</td>
                                            <td className="py-0.5 px-1 text-sky-400">{it.nodeId}</td>
                                            <td className="py-0.5 px-1 text-right text-red-300">{it.unbalancedMoment.toFixed(3)}</td>
                                            {members.map(m => (
                                                <td key={m.id} className="py-0.5 px-1 text-right text-emerald-300">
                                                    {(it.distributed[m.id] ?? 0).toFixed(3)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                    {result.iterations.length > 40 && (
                                        <tr><td colSpan={4} className="text-center text-slate-600 py-1">... (ilk 40 satır gösteriliyor)</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
};
