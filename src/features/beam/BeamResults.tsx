import React, { useEffect, useRef, useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { AnalysisResult, Beam } from './types';
import { Card } from '../../components/ui/Card';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

/** Step-by-step equilibrium equations display */
const EquilibriumSteps: React.FC<{ beam: Beam; result: AnalysisResult }> = ({ beam, result }) => {
    const [open, setOpen] = useState(false);

    const L = beam.length;
    const reactionEntries = Object.entries(result.reactions);

    // Build load description lines
    const loadLines: string[] = [];
    beam.loads.forEach((ld, i) => {
        if (ld.type === 'point') {
            loadLines.push(`P${i + 1} = ${ld.magnitude} kN @ x=${ld.position}m`);
        } else if (ld.type === 'distributed') {
            const w = ld.magnitude;
            const a = ld.startPosition ?? ld.position;
            const b = ld.endPosition ?? L;
            loadLines.push(`w${i + 1} = ${w} kN/m, x=[${a}m–${b}m], ResultantF=${(w * (b - a)).toFixed(2)} kN @ x=${((a + b) / 2).toFixed(2)}m`);
        } else if (ld.type === 'moment') {
            loadLines.push(`M${i + 1} = ${ld.magnitude} kNm @ x=${ld.position}m`);
        }
    });

    // ΣFy = 0: sum reactions = sum of vertical loads
    const totalLoads = beam.loads.reduce((sum, ld) => {
        if (ld.type === 'point') return sum + ld.magnitude;
        if (ld.type === 'distributed') {
            const a = ld.startPosition ?? ld.position;
            const b = ld.endPosition ?? L;
            return sum + ld.magnitude * (b - a);
        }
        return sum;
    }, 0);

    // ΣM@A = 0 for each support
    const refSupport = beam.supports[0];
    const refPos = refSupport?.position ?? 0;

    return (
        <div className="bg-slate-900/50 border border-slate-700/30 rounded overflow-hidden">
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors"
            >
                {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                <span className="font-bold">📐 Adım Adım Denge Denklemleri</span>
            </button>
            {open && (
                <div className="px-3 pb-3 space-y-2 text-[10px] font-mono">
                    {/* Applied Loads */}
                    <div className="text-slate-600 uppercase text-[9px] font-bold tracking-wider pt-1">1. Uygulanan Yükler</div>
                    {loadLines.length > 0 ? loadLines.map((l, i) => (
                        <div key={i} className="text-slate-400 pl-2 border-l border-slate-700">→ {l}</div>
                    )) : <div className="text-slate-600 pl-2">Yük tanımlanmamış</div>}

                    {/* ΣFy = 0 */}
                    <div className="text-slate-600 uppercase text-[9px] font-bold tracking-wider pt-1">2. ΣFy = 0</div>
                    <div className="pl-2 border-l border-slate-700 text-slate-400">
                        {reactionEntries.map(([id]) => `R_${id}`).join(' + ')} = {totalLoads.toFixed(3)} kN
                    </div>
                    <div className="pl-2 border-l border-slate-700 text-emerald-400">
                        → {reactionEntries.map(([id, v]) => `R_${id}=${v.toFixed(3)}`).join(', ')} kN
                    </div>

                    {/* ΣM@A = 0 */}
                    <div className="text-slate-600 uppercase text-[9px] font-bold tracking-wider pt-1">3. ΣM @ x={refPos}m = 0</div>
                    {beam.loads.map((ld, i) => {
                        let arm = 0, force = 0;
                        if (ld.type === 'point') { force = ld.magnitude; arm = ld.position - refPos; }
                        else if (ld.type === 'distributed') {
                            const a = ld.startPosition ?? ld.position;
                            const b = ld.endPosition ?? L;
                            force = ld.magnitude * (b - a);
                            arm = (a + b) / 2 - refPos;
                        } else if (ld.type === 'moment') { force = 0; arm = 0; }
                        if (force === 0) return null;
                        return (
                            <div key={i} className="pl-2 border-l border-slate-700 text-slate-400">
                                {force.toFixed(2)} × {arm.toFixed(2)} = {(force * arm).toFixed(2)} kNm
                            </div>
                        );
                    })}
                    {reactionEntries.length > 1 && (
                        <div className="pl-2 border-l border-emerald-900/50 text-emerald-500">
                            → Çözüm: {reactionEntries.map(([id, v]) => `R_${id}=${v.toFixed(3)}`).join(', ')} kN
                        </div>
                    )}
                    {result.momentReaction && Object.entries(result.momentReaction).length > 0 && (
                        <div className="pl-2 border-l border-purple-900/50 text-purple-400">
                            → Mesnet momentleri: {Object.entries(result.momentReaction).map(([id, v]) => `M_${id}=${v.toFixed(3)}`).join(', ')} kNm
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

interface BeamResultsProps {
    result: AnalysisResult | null;
    beam?: Beam;
}


export const BeamResults: React.FC<BeamResultsProps> = ({ result, beam }) => {
    const [animPhase, setAnimPhase] = useState(0);
    const animRef = useRef<number | null>(null);

    // Animate deflection shape
    useEffect(() => {
        let start: number | null = null;
        const animate = (ts: number) => {
            if (!start) start = ts;
            setAnimPhase(((ts - start) / 1500) % (2 * Math.PI));
            animRef.current = requestAnimationFrame(animate);
        };
        animRef.current = requestAnimationFrame(animate);
        return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
    }, []);

    if (!result) return (
        <div className="p-6 text-center text-slate-500 text-sm space-y-2">
            <div className="text-2xl opacity-20">📊</div>
            <div>Analizi çalıştırın</div>
        </div>
    );

    const L = beam?.length ?? result.diagrams[result.diagrams.length - 1]?.x ?? 1;
    const labels = result.diagrams.map(p => p.x.toFixed(2));

    // Max positions
    const maxShearPt = result.diagrams.reduce((a, b) => Math.abs(b.shear) > Math.abs(a.shear) ? b : a, result.diagrams[0]);
    const maxMomPt = result.diagrams.reduce((a, b) => Math.abs(b.moment) > Math.abs(a.moment) ? b : a, result.diagrams[0]);
    const maxDefPt = result.diagrams.reduce((a, b) => Math.abs(b.deflection) > Math.abs(a.deflection) ? b : a, result.diagrams[0]);

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: false as const,
        plugins: {
            legend: { display: false },
            tooltip: {
                mode: 'index' as const,
                intersect: false,
                callbacks: {
                    label: (ctx: any) => `${ctx.parsed.y.toFixed(3)}`
                }
            },
        },
        scales: {
            x: {
                display: true,
                ticks: { color: '#475569', font: { size: 8 }, maxTicksLimit: 8 },
                grid: { color: 'rgba(255,255,255,0.04)' }
            },
            y: {
                grid: { color: 'rgba(255, 255, 255, 0.06)' },
                ticks: { color: '#94a3b8', font: { size: 9, family: 'monospace' } }
            }
        }
    };

    const makeDataset = (data: number[], color: string, label: string) => ({
        labels,
        datasets: [{
            label,
            data,
            borderColor: color,
            backgroundColor: color.replace(')', ', 0.15)').replace('rgb', 'rgba'),
            borderWidth: 1.5,
            fill: true,
            pointRadius: 0,
            tension: 0.1,
        }]
    });

    // Animated deflection SVG
    const renderDeflectionShape = () => {
        if (!result.diagrams || result.diagrams.length === 0) return null;
        const W = 560, H = 90;
        const padX = 30, padY = 20;
        const drawW = W - 2 * padX;
        const drawH = H - 2 * padY;

        const maxDef = Math.max(...result.diagrams.map(p => Math.abs(p.deflection)));
        const scale = maxDef > 0 ? (drawH / 2 - 4) / maxDef : 1;

        const baseY = padY + drawH / 2;
        // Animate amplitude with sine wave
        const amp = Math.sin(animPhase);

        const pts = result.diagrams.map(p => {
            const x = padX + (p.x / L) * drawW;
            const y = baseY - p.deflection * scale * amp;
            return `${x},${y}`;
        }).join(' ');

        return (
            <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="bg-slate-900/40 rounded">
                {/* Neutral axis */}
                <line x1={padX} y1={baseY} x2={W - padX} y2={baseY} stroke="#334155" strokeWidth="1.5" strokeDasharray="6 3" />
                {/* Deflected shape */}
                <polyline points={pts} fill="none" stroke="#06b6d4" strokeWidth="2" opacity={0.8 + 0.2 * Math.abs(Math.sin(animPhase))} />
                {/* Max deflection marker */}
                {maxDefPt && (() => {
                    const mx = padX + (maxDefPt.x / L) * drawW;
                    const my = baseY - maxDefPt.deflection * scale * amp;
                    return (
                        <g>
                            <circle cx={mx} cy={my} r={3} fill="#06b6d4" opacity={0.9} />
                            <text x={mx + 5} y={my - 4} fill="#67e8f9" fontSize="7" fontFamily="monospace">
                                {(maxDefPt.deflection * 1000).toFixed(3)} mm
                            </text>
                        </g>
                    );
                })()}
                <text x={padX} y={padY - 5} fill="#475569" fontSize="8">Eğilme Şekli (animasyonlu)</text>
            </svg>
        );
    };

    // Equilibrium summary
    const reactions = Object.entries(result.reactions);
    const totalV = reactions.reduce((s, [, v]) => s + v, 0);

    return (
        <div className="space-y-3">
            {/* Reactions table */}
            <Card title="Mesnet Tepkileri">
                <div className="space-y-1">
                    {reactions.map(([id, val]) => (
                        <div key={id} className="flex justify-between items-center text-xs border-b border-slate-800/50 last:border-0 py-1">
                            <span className="text-slate-400 font-mono">R<sub>{id}</sub></span>
                            <div className="flex items-center gap-2">
                                <div className="h-1 rounded-full bg-emerald-500/30" style={{ width: `${Math.min(60, Math.abs(val) / Math.max(...reactions.map(([, v]) => Math.abs(v))) * 60)}px` }} />
                                <span className="font-mono text-emerald-400 w-24 text-right">{val.toFixed(3)} kN</span>
                            </div>
                        </div>
                    ))}
                    {result.momentReaction && Object.entries(result.momentReaction).map(([id, val]) => (
                        <div key={id} className="flex justify-between items-center text-xs border-b border-slate-800/50 last:border-0 py-1">
                            <span className="text-slate-400 font-mono">M<sub>{id}</sub></span>
                            <span className="font-mono text-purple-400 w-24 text-right">{val.toFixed(3)} kNm</span>
                        </div>
                    ))}
                </div>
            </Card>

            {/* Step-by-Step Equilibrium */}
            {beam && <EquilibriumSteps beam={beam} result={result} />}

            {/* Equilibrium check */}
            <div className="bg-slate-900/60 border border-slate-700/30 rounded p-2 text-[10px]">
                <div className="text-[9px] uppercase tracking-wider text-slate-600 font-bold mb-1.5">⚖️ Denge Kontrolü</div>
                <div className="flex justify-between">
                    <span className="text-slate-500">ΣFy = 0</span>
                    <span className={`font-mono ${Math.abs(totalV) < 0.1 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {totalV.toFixed(4)} kN {Math.abs(totalV) < 0.1 ? '✓' : '✗'}
                    </span>
                </div>
            </div>

            {/* Max values */}
            <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                <div className="bg-slate-900/60 border border-cyan-900/30 rounded p-2">
                    <div className="text-slate-500 mb-0.5">Max V</div>
                    <div className="font-mono text-cyan-400 font-bold text-xs">{Math.abs(result.maxShear).toFixed(2)}<span className="text-slate-600 text-[8px]"> kN</span></div>
                    <div className="text-[8px] text-slate-600 mt-0.5">x={maxShearPt?.x.toFixed(2)}m</div>
                </div>
                <div className="bg-slate-900/60 border border-red-900/30 rounded p-2">
                    <div className="text-slate-500 mb-0.5">Max M</div>
                    <div className="font-mono text-red-400 font-bold text-xs">{Math.abs(result.maxMoment).toFixed(2)}<span className="text-slate-600 text-[8px]"> kNm</span></div>
                    <div className="text-[8px] text-slate-600 mt-0.5">x={maxMomPt?.x.toFixed(2)}m</div>
                </div>
                <div className="bg-slate-900/60 border border-blue-900/30 rounded p-2">
                    <div className="text-slate-500 mb-0.5">Max δ</div>
                    <div className="font-mono text-blue-400 font-bold text-xs">{(Math.abs(result.maxDeflection) * 1000).toFixed(3)}<span className="text-slate-600 text-[8px]"> mm</span></div>
                    <div className="text-[8px] text-slate-600 mt-0.5">x={maxDefPt?.x.toFixed(2)}m</div>
                </div>
            </div>

            {/* Animated deflection shape */}
            <Card title="Eğilme Şekli">
                {renderDeflectionShape()}
            </Card>

            {/* V diagram */}
            <Card title="Kesme Kuvveti (V)">
                <div className="h-28 w-full">
                    <Line
                        data={makeDataset(result.diagrams.map(p => p.shear), 'rgb(6, 182, 212)', 'V')}
                        options={chartOptions}
                    />
                </div>
                <div className="flex justify-between text-[9px] text-slate-600 mt-1 px-1">
                    <span>0</span>
                    <span className="text-cyan-600">Kesme Kuvveti (kN)</span>
                    <span>{L}m</span>
                </div>
            </Card>

            {/* M diagram */}
            <Card title="Eğilme Momenti (M)">
                <div className="h-28 w-full">
                    <Line
                        data={makeDataset(result.diagrams.map(p => p.moment), 'rgb(239, 68, 68)', 'M')}
                        options={chartOptions}
                    />
                </div>
                <div className="flex justify-between text-[9px] text-slate-600 mt-1 px-1">
                    <span>0</span>
                    <span className="text-red-600">Eğilme Momenti (kNm)</span>
                    <span>{L}m</span>
                </div>
            </Card>

            {/* Deflection diagram */}
            <Card title="Deplasman Diyagramı (δ)">
                <div className="h-28 w-full">
                    <Line
                        data={makeDataset(result.diagrams.map(p => p.deflection * 1000), 'rgb(59, 130, 246)', 'δ')}
                        options={chartOptions}
                    />
                </div>
                <div className="flex justify-between text-[9px] text-slate-600 mt-1 px-1">
                    <span>0</span>
                    <span className="text-blue-600">Deplasman (mm)</span>
                    <span>{L}m</span>
                </div>
            </Card>
        </div>
    );
};
