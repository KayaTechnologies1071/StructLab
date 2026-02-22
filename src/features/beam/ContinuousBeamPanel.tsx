import React, { useState, useCallback } from 'react';
import { ContinuousBeamAnalyzer, type ContinuousSpan, type ContinuousBeamResult } from '../../engine/ContinuousBeamAnalyzer';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Plus, Trash2, Play } from 'lucide-react';

const DEFAULT_SPAN: ContinuousSpan = {
    length: 5,
    EI: 50000, // kN·m²  (e.g. 200GPa * 2500cm⁴)
    loads: [{ type: 'udl', magnitude: 10 }],
    settlement_start: 0,
    settlement_end: 0,
};

export const ContinuousBeamPanel: React.FC = () => {
    const [spans, setSpans] = useState<ContinuousSpan[]>([{ ...DEFAULT_SPAN }, { ...DEFAULT_SPAN }]);
    const [result, setResult] = useState<ContinuousBeamResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const updateSpan = (idx: number, patch: Partial<ContinuousSpan>) => {
        setSpans(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
    };

    const calculate = useCallback(() => {
        try {
            setError(null);
            const res = ContinuousBeamAnalyzer.analyze(spans);
            setResult(res);
        } catch (e) {
            setError(String(e));
        }
    }, [spans]);

    const totalLength = spans.reduce((s, sp) => s + sp.length, 0);

    // Build SVG diagram of continuous beam
    const renderDiagram = () => {
        if (!result) return null;
        const W = 600, H = 120;
        const padX = 30;
        const scaleX = (W - 2 * padX) / totalLength;
        const beamY = 60;

        let offsetX = 0;
        const nPoints: [number, number, number][] = []; // x, shear, moment arrays flattened
        const shearPts: string[] = [];
        const momPts: string[] = [];

        for (const span of result.spans) {
            for (const pt of span.points) {
                const svgX = padX + (offsetX + pt.x) * scaleX;
                nPoints.push([svgX, pt.shear, pt.moment]);
            }
            offsetX += spans[span.spanIndex].length;
        }

        const maxShear = Math.max(...nPoints.map(p => Math.abs(p[1])), 1);
        const maxMom = Math.max(...nPoints.map(p => Math.abs(p[2])), 1);
        const scaleS = 25 / maxShear;
        const scaleM = 25 / maxMom;

        nPoints.forEach(([x, V, M]) => {
            shearPts.push(`${x},${beamY - V * scaleS}`);
            momPts.push(`${x},${beamY + M * scaleM}`);
        });

        return (
            <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="mt-2">
                {/* Beam */}
                <line x1={padX} y1={beamY} x2={W - padX} y2={beamY} stroke="#94a3b8" strokeWidth="3" />
                {/* Shear */}
                <polyline points={shearPts.join(' ')} fill="none" stroke="#22d3ee" strokeWidth="1.5" />
                {/* Moment (below beam) */}
                <polyline points={momPts.join(' ')} fill="none" stroke="#f59e0b" strokeWidth="1.5" />
                {/* Legends */}
                <text x={padX} y={14} fill="#22d3ee" fontSize="8">Kesme (V)</text>
                <text x={padX + 60} y={14} fill="#f59e0b" fontSize="8">Moment (M)</text>
            </svg>
        );
    };

    return (
        <div className="space-y-4">
            <Card title="Sürekli Kiriş (Clapeyron)" action={
                <Button size="sm" variant="ghost" icon={<Plus size={12} />}
                    onClick={() => setSpans(prev => [...prev, { ...DEFAULT_SPAN }])}>Açıklık ekle</Button>
            }>
                {spans.map((span, idx) => (
                    <div key={idx} className="mb-4 border-b border-slate-700/30 pb-4 last:border-0 relative group">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-sky-300">Açıklık {idx + 1}</span>
                            {spans.length > 1 && (
                                <button className="text-slate-600 hover:text-red-400 transition-colors"
                                    onClick={() => setSpans(prev => prev.filter((_, i) => i !== idx))}>
                                    <Trash2 size={12} />
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] text-slate-500 uppercase">L (m)</label>
                                <input type="number" step={0.5} value={span.length} min={0.1}
                                    onChange={e => updateSpan(idx, { length: Number(e.target.value) })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-xs text-white" />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 uppercase">EI (kN·m²)</label>
                                <input type="number" step={1000} value={span.EI}
                                    onChange={e => updateSpan(idx, { EI: Number(e.target.value) })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-xs text-white" />
                            </div>
                            <div>
                                <label className="text-[10px] text-amber-500 uppercase">Çökme başlangıç (m)</label>
                                <input type="number" step={0.001} value={span.settlement_start ?? 0}
                                    onChange={e => updateSpan(idx, { settlement_start: Number(e.target.value) })}
                                    className="w-full bg-slate-800 border border-amber-700/40 rounded px-1 py-0.5 text-xs text-amber-200" />
                            </div>
                            <div>
                                <label className="text-[10px] text-amber-500 uppercase">Çökme bitiş (m)</label>
                                <input type="number" step={0.001} value={span.settlement_end ?? 0}
                                    onChange={e => updateSpan(idx, { settlement_end: Number(e.target.value) })}
                                    className="w-full bg-slate-800 border border-amber-700/40 rounded px-1 py-0.5 text-xs text-amber-200" />
                            </div>
                        </div>
                        <div className="mt-2">
                            <label className="text-[10px] text-red-400 uppercase">Yayılı Yük (kN/m)</label>
                            <input type="number" step={1} value={span.loads[0]?.magnitude ?? 0}
                                onChange={e => updateSpan(idx, { loads: [{ type: 'udl', magnitude: Number(e.target.value) }] })}
                                className="w-full bg-slate-800 border border-red-700/40 rounded px-1 py-0.5 text-xs text-red-200" />
                        </div>
                    </div>
                ))}
                <Button variant="primary" icon={<Play size={14} />} onClick={calculate} className="w-full mt-2">
                    Hesapla (Clapeyron)
                </Button>
            </Card>

            {error && (
                <div className="bg-red-900/30 border border-red-700 rounded p-2 text-xs text-red-300">{error}</div>
            )}

            {result && (
                <Card title="Sonuçlar">
                    <div className="text-[10px] text-slate-400 mb-1">Mesnet Momentleri</div>
                    <div className="flex flex-wrap gap-2 mb-3">
                        {result.supportMoments.map((M, i) => (
                            <div key={i} className="bg-slate-800 rounded px-2 py-1">
                                <span className="text-slate-500">M<sub>{i}</sub> = </span>
                                <span className="text-amber-300 font-mono">{M.toFixed(2)}</span>
                                <span className="text-slate-500"> kNm</span>
                            </div>
                        ))}
                    </div>
                    <div className="text-[10px] text-slate-400 mb-1">Tepki Kuvvetleri</div>
                    <div className="flex flex-wrap gap-2 mb-3">
                        {result.reactions.map((R, i) => (
                            <div key={i} className="bg-slate-800 rounded px-2 py-1">
                                <span className="text-slate-500">R<sub>{i}</sub> = </span>
                                <span className="text-sky-300 font-mono">{R.toFixed(2)}</span>
                                <span className="text-slate-500"> kN</span>
                            </div>
                        ))}
                    </div>
                    {renderDiagram()}
                </Card>
            )}
        </div>
    );
};
