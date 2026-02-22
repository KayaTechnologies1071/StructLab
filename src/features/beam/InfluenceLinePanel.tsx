import React, { useState, useCallback } from 'react';
import { InfluenceLineAnalyzer, type InfluenceTarget, type InfluenceLineResult } from '../../engine/InfluenceLineAnalyzer';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Play } from 'lucide-react';
import type { Beam } from './types';

interface InfluenceLinePanelProps {
    beam: Beam;
}

export const InfluenceLinePanel: React.FC<InfluenceLinePanelProps> = ({ beam }) => {
    const [targetType, setTargetType] = useState<'reaction' | 'shear' | 'moment'>('reaction');
    const [supportId, setSupportId] = useState(beam.supports[0]?.id ?? '');
    const [section, setSection] = useState(beam.length / 2);
    const [result, setResult] = useState<InfluenceLineResult | null>(null);
    const [loading, setLoading] = useState(false);

    // Load multiplier P — defaults to the first beam load's magnitude so the user
    // immediately sees the actual max effect (e.g. 20kN × 2.5 = 50 kNm)
    const defaultP = beam.loads.find(l => l.magnitude)?.magnitude ?? 1;
    const [loadP, setLoadP] = useState<number>(defaultP);

    // Re-init supportId when beam changes
    React.useEffect(() => {
        if (beam.supports.length > 0 && !beam.supports.find(s => s.id === supportId)) {
            setSupportId(beam.supports[0].id);
        }
    }, [beam.supports, supportId]);

    const calculate = useCallback(() => {
        let target: InfluenceTarget;
        if (targetType === 'reaction') target = { type: 'reaction', supportId };
        else if (targetType === 'shear') target = { type: 'shear', position: section };
        else target = { type: 'moment', position: section };

        setLoading(true);
        setTimeout(() => {
            const res = InfluenceLineAnalyzer.analyze(beam, target, 80);
            setResult(res);
            setLoading(false);
        }, 10);
    }, [beam, targetType, supportId, section]);

    // Derived unit labels
    const unitLabel = targetType === 'reaction' ? 'kN/kN' : targetType === 'shear' ? 'kN/kN' : 'kNm/kN';
    const resultUnitLabel = targetType === 'moment' ? 'kNm' : 'kN';

    const renderDiagram = () => {
        if (!result) return null;
        const W = 580, H = 110;
        const padX = 20, padY = 20;
        const drawW = W - 2 * padX;
        const drawH = H - 2 * padY;
        const pts = result.points;
        if (pts.length === 0) return null;

        const minV = Math.min(...pts.map(p => p.value));
        const maxV = Math.max(...pts.map(p => p.value));
        const range = Math.max(Math.abs(minV), Math.abs(maxV), 0.001);

        const toSvgX = (x: number) => padX + (x / beam.length) * drawW;
        const toSvgY = (v: number) => padY + drawH / 2 - (v / range) * (drawH / 2 - 2);

        const polyPoints = pts.map(p => `${toSvgX(p.loadPosition)},${toSvgY(p.value)}`).join(' ');
        const zeroY = toSvgY(0);

        return (
            <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="mt-2 bg-slate-900/50 rounded">
                {/* Beam line */}
                <line x1={padX} y1={H - 8} x2={W - padX} y2={H - 8} stroke="#334155" strokeWidth="2" />
                {/* Zero line */}
                <line x1={padX} y1={zeroY} x2={W - padX} y2={zeroY} stroke="#475569" strokeWidth="1" strokeDasharray="4 2" />
                {/* Shade positive areas green */}
                {result.favorablePositiveRange.map((r, i) => (
                    <rect key={i}
                        x={toSvgX(r.start)} y={padY}
                        width={Math.max(1, toSvgX(r.end) - toSvgX(r.start))} height={drawH}
                        fill="#10b981" fillOpacity={0.12} />
                ))}
                {/* Shade negative areas red */}
                {result.favorableNegativeRange.map((r, i) => (
                    <rect key={i}
                        x={toSvgX(r.start)} y={padY}
                        width={Math.max(1, toSvgX(r.end) - toSvgX(r.start))} height={drawH}
                        fill="#ef4444" fillOpacity={0.12} />
                ))}
                {/* Influence line */}
                <polyline points={polyPoints} fill="none" stroke="#f59e0b" strokeWidth="2" />
                {/* Ordinate labels */}
                <text x={padX} y={padY - 6} fill="#f59e0b" fontSize="8" fontWeight="bold">
                    max+ {result.maxPositive.toFixed(3)} {unitLabel}
                </text>
                {result.maxNegative < -1e-9 && (
                    <text x={W - padX} y={padY - 6} textAnchor="end" fill="#f87171" fontSize="8" fontWeight="bold">
                        max− {result.maxNegative.toFixed(3)} {unitLabel}
                    </text>
                )}
            </svg>
        );
    };

    return (
        <div className="space-y-4">
            <Card title="Tesir Çizgisi (Influence Line)">
                <p className="text-[10px] text-slate-500 mb-3 italic leading-relaxed">
                    Birim yük (1 kN) kirişi boyunca hareket eder. Tesir ordinatı = 1 kN başına etki.
                    Gerçek maksimum etki = <span className="text-amber-400">ordinat × P</span>.
                </p>

                <div className="space-y-3">
                    {/* Target type */}
                    <div>
                        <label className="text-[10px] uppercase text-slate-500 font-bold">Tesir Tipi</label>
                        <select value={targetType} onChange={e => setTargetType(e.target.value as any)}
                            className="w-full mt-0.5 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white">
                            <option value="reaction">Tepki Kuvveti (Mesnet)</option>
                            <option value="shear">Kesme Kuvveti (Kesit)</option>
                            <option value="moment">Eğilme Momenti (Kesit)</option>
                        </select>
                    </div>

                    {targetType === 'reaction' && (
                        <div>
                            <label className="text-[10px] uppercase text-slate-500 font-bold">Mesnet</label>
                            <select value={supportId} onChange={e => setSupportId(e.target.value)}
                                className="w-full mt-0.5 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white">
                                {beam.supports.map(s => (
                                    <option key={s.id} value={s.id}>{s.id} (x={s.position}m)</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {(targetType === 'shear' || targetType === 'moment') && (
                        <div>
                            <label className="text-[10px] uppercase text-slate-500 font-bold">
                                Kesit Konumu (m)
                            </label>
                            <input type="number" min={0} max={beam.length} step={0.1} value={section}
                                onChange={e => setSection(Number(e.target.value))}
                                className="w-full mt-0.5 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white" />
                        </div>
                    )}

                    {/* Load multiplier P */}
                    <div className="bg-amber-900/20 border border-amber-700/30 rounded p-2">
                        <label className="text-[10px] uppercase text-amber-400 font-bold">
                            Çarpan Yük P (kN)
                        </label>
                        <p className="text-[9px] text-slate-500 mb-1">Gerçek etkiyi görmek için kirişe uygulanan yük büyüklüğünü girin.</p>
                        <input type="number" min={0} step={1} value={loadP}
                            onChange={e => setLoadP(Number(e.target.value))}
                            className="w-full bg-slate-800 border border-amber-700/40 rounded px-2 py-1 text-xs text-amber-200 font-mono" />
                    </div>

                    <Button variant="primary" icon={<Play size={14} />} onClick={calculate}
                        className="w-full" disabled={loading}>
                        {loading ? 'Hesaplanıyor...' : 'Tesir Çizgisini Hesapla'}
                    </Button>
                </div>
            </Card>

            {result && (
                <Card title="Tesir Çizgisi Diyagramı">
                    {renderDiagram()}

                    {/* Ordinate results */}
                    <div className="mt-3 bg-slate-900/40 rounded p-2 space-y-1.5 text-[10px]">
                        <div className="text-[9px] uppercase text-slate-600 font-bold tracking-wider mb-1">
                            Birim Yük (1 kN) Tesir Ordinatı
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Max (+) ordinat:</span>
                            <span className="text-emerald-400 font-mono">
                                {result.maxPositive.toFixed(4)} <span className="text-slate-600">{unitLabel}</span>
                            </span>
                        </div>
                        {result.maxNegative < -1e-9 && (
                            <div className="flex justify-between">
                                <span className="text-slate-500">Max (−) ordinat:</span>
                                <span className="text-red-400 font-mono">
                                    {result.maxNegative.toFixed(4)} <span className="text-slate-600">{unitLabel}</span>
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Actual max effect with load P */}
                    {loadP !== 0 && (
                        <div className="mt-2 bg-amber-900/20 border border-amber-700/30 rounded p-2 space-y-1.5 text-[10px]">
                            <div className="text-[9px] uppercase text-amber-500 font-bold tracking-wider mb-1">
                                P = {loadP} kN ile Maksimum Gerçek Etki
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400">
                                    {loadP} × {result.maxPositive.toFixed(4)} =
                                </span>
                                <span className="text-amber-300 font-mono font-bold text-sm">
                                    {(loadP * result.maxPositive).toFixed(3)} {resultUnitLabel}
                                </span>
                            </div>
                            {result.maxNegative < -1e-9 && (
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400">
                                        {loadP} × {result.maxNegative.toFixed(4)} =
                                    </span>
                                    <span className="text-red-400 font-mono font-bold text-sm">
                                        {(loadP * result.maxNegative).toFixed(3)} {resultUnitLabel}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Favorable ranges */}
                    <div className="mt-2 space-y-1 text-[10px]">
                        {result.favorablePositiveRange.length > 0 && (
                            <div>
                                <span className="text-slate-500">Elverişli (+) yük bölgesi: </span>
                                <span className="text-emerald-300">
                                    {result.favorablePositiveRange.map(r => `${r.start.toFixed(1)}–${r.end.toFixed(1)}m`).join(', ')}
                                </span>
                            </div>
                        )}
                        {result.favorableNegativeRange.length > 0 && (
                            <div>
                                <span className="text-slate-500">Elverişsiz (−) yük bölgesi: </span>
                                <span className="text-red-300">
                                    {result.favorableNegativeRange.map(r => `${r.start.toFixed(1)}–${r.end.toFixed(1)}m`).join(', ')}
                                </span>
                            </div>
                        )}
                    </div>
                </Card>
            )}
        </div>
    );
};
