import React, { useState, useRef, useCallback } from 'react';
import type { Beam, AnalysisResult, AnalysisPoint } from './types';
import { Camera, EyeOff, Eye } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { exportSvgAsPng } from '../../utils/exportImage';

interface BeamVisualizerProps {
    beam: Beam;
    results?: AnalysisResult | null;
    /** 0='none' | 1='shear' | 2='moment' | 3='deflection' */
    overlay?: 'none' | 'shear' | 'moment' | 'deflection';
}

const W = 860, H = 470;
const PAD_X = 60, PAD_Y = 20;
const BEAM_Y = 160; // vertical center of beam bar
const BEAM_H = 10;

export const BeamVisualizer: React.FC<BeamVisualizerProps> = ({
    beam,
    results,
    overlay = 'moment',
}) => {
    const { t } = useLanguage();
    const [hoverX, setHoverX] = useState<number | null>(null);
    const [showLoads, setShowLoads] = useState(true);
    const [showReactions, setShowReactions] = useState(true);
    const [showDimensions, setShowDimensions] = useState(true);

    const handleExport = () => {
        if (svgRef.current) {
            exportSvgAsPng(svgRef.current, `beam_analysis_${overlay} `);
        }
    };
    const svgRef = useRef<SVGSVGElement>(null);

    const drawW = W - PAD_X * 2;
    const toSvgX = useCallback((x: number) => PAD_X + (x / beam.length) * drawW, [beam.length, drawW]);
    const beamTop = BEAM_Y - BEAM_H / 2;
    const beamBot = BEAM_Y + BEAM_H / 2;

    // Mouse move handler for hover crosshair
    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return;
        const svgX = (e.clientX - rect.left) / rect.width * W;
        const beamX = (svgX - PAD_X) / drawW * beam.length;
        if (beamX >= 0 && beamX <= beam.length) setHoverX(beamX);
        else setHoverX(null);
    };

    // Get diagram value at hover x
    const getDiagramAtX = (bx: number) => {
        if (!results || !results.diagrams.length) return null;
        let closest = results.diagrams[0];
        let minDist = Math.abs(closest.x - bx);
        for (const pt of results.diagrams) {
            const d = Math.abs(pt.x - bx);
            if (d < minDist) { minDist = d; closest = pt; }
        }
        return closest;
    };

    // Overlay diagram rendering
    const renderOverlay = () => {
        if (!results || overlay === 'none') return null;
        const pts = results.diagrams;
        if (!pts.length) return null;

        const diagramBaseY = BEAM_Y + 98; // start of diagram area (below support symbols + reaction labels)
        const diagramH = 110;

        let values: number[];
        let color: string;
        let unit: string;
        let label: string;

        if (overlay === 'shear') {
            values = pts.map(p => p.shear);
            color = '#06b6d4'; unit = 'kN'; label = 'V(x)';
        } else if (overlay === 'moment') {
            values = pts.map(p => p.moment);
            color = '#ef4444'; unit = 'kNm'; label = 'M(x)';
        } else {
            values = pts.map(p => p.deflection * 1000); // mm
            color = '#3b82f6'; unit = 'mm'; label = 'δ(x)';
        }

        const maxAbs = Math.max(...values.map(Math.abs), 0.001);
        const baseY = diagramBaseY + diagramH / 2;

        const toY = (v: number) => baseY - (v / maxAbs) * (diagramH / 2 - 4);

        const polyPoints = pts.map(p => `${toSvgX(p.x)},${toY(values[pts.indexOf(p)])} `).join(' ');

        return (
            <g>
                {/* Diagram baseline */}
                <line x1={PAD_X} y1={baseY} x2={W - PAD_X} y2={baseY}
                    stroke="#334155" strokeWidth="1" strokeDasharray="5 3" />
                {/* Shading */}
                <defs>
                    <linearGradient id="dg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.35" />
                        <stop offset="100%" stopColor={color} stopOpacity="0.05" />
                    </linearGradient>
                </defs>
                <polygon
                    points={`${toSvgX(pts[0].x)},${baseY} ${polyPoints} ${toSvgX(pts[pts.length - 1].x)},${baseY} `}
                    fill={`url(#dg)`}
                    stroke="none"
                />
                {/* Line */}
                <polyline points={polyPoints} fill="none" stroke={color} strokeWidth="2" />
                {/* Label left */}
                <text x={PAD_X - 5} y={diagramBaseY} fill={color} fontSize="9"
                    fontFamily="monospace" textAnchor="end">
                    {label}
                </text>
                <text x={PAD_X - 5} y={diagramBaseY + 11} fill={color} fontSize="8"
                    fontFamily="monospace" textAnchor="end" opacity={0.6}>
                    [{unit}]
                </text>
                {/* Max label */}
                {(() => {
                    const maxIdx = values.reduce((mi, v, i, arr) => Math.abs(v) > Math.abs(arr[mi]) ? i : mi, 0);
                    const mx = toSvgX(pts[maxIdx].x);
                    const my = toY(values[maxIdx]);
                    return (
                        <g>
                            <circle cx={mx} cy={my} r={3} fill={color} />
                            <text x={mx + 5} y={my - 4} fill={color} fontSize="9" fontFamily="monospace">
                                {values[maxIdx].toFixed(2)}
                            </text>
                        </g>
                    );
                })()}
                {/* Zero markers */}
                <text x={PAD_X - 3} y={baseY + 3} fill="#475569" fontSize="7" textAnchor="end">0</text>
                <text x={PAD_X - 3} y={diagramBaseY + 3} fill="#475569" fontSize="7" textAnchor="end">
                    +{maxAbs.toFixed(1)}
                </text>
                <text x={PAD_X - 3} y={diagramBaseY + diagramH - 2} fill="#475569" fontSize="7" textAnchor="end">
                    -{maxAbs.toFixed(1)}
                </text>
            </g>
        );
    };

    // Reaction labels – shown as clean text badges WELL BELOW the support symbols.
    // Support symbols (pinned ~30px, roller ~32px, fixed ~30px) end at roughly beamBot+35.
    // We place labels at a fixed Y = beamBot + 52, safely below all support graphics.
    // No arrows crossing into the support zone.
    const RXNLABEL_Y = beamBot + 52;

    const renderReactions = () => {
        if (!results) return null;
        return beam.supports.map(s => {
            const ry = results.reactions[s.id];
            const mx = results.momentReaction?.[s.id];
            if (ry === undefined && !mx) return null;
            const x = toSvgX(s.position);
            return (
                <g key={`rxn - ${s.id} `}>
                    {/* Small upward arrow indicator */}
                    <polygon
                        points={`${x},${RXNLABEL_Y - 8} ${x - 5},${RXNLABEL_Y - 2} ${x + 5},${RXNLABEL_Y - 2} `}
                        fill="#10b981"
                    />
                    {/* Reaction value */}
                    <text x={x} y={RXNLABEL_Y + 9}
                        textAnchor="middle"
                        fill="#10b981" fontSize="10" fontFamily="monospace" fontWeight="bold">
                        R{s.id}={(ry ?? 0).toFixed(3)} kN
                    </text>
                    {/* Moment reaction (if any) */}
                    {mx !== undefined && Math.abs(mx) > 0.001 && (
                        <text x={x} y={RXNLABEL_Y + 22}
                            textAnchor="middle"
                            fill="#a78bfa" fontSize="9" fontFamily="monospace">
                            M={(mx).toFixed(3)} kNm
                        </text>
                    )}
                </g>
            );
        });
    };



    const hoverPt = hoverX !== null ? getDiagramAtX(hoverX) : null;

    return (
        <div className="flex flex-col w-full gap-1">
            {/* Overlay selector & Controls */}
            <div className="flex items-center gap-2 px-2 pb-1 min-h-[36px] z-10 overflow-x-auto custom-scrollbar whitespace-nowrap">
                <div className="flex items-center gap-1 bg-slate-800/60 rounded-md p-1 border border-slate-700/50">
                    <button onClick={() => setShowLoads(!showLoads)} className={`p - 1 rounded ${showLoads ? 'text-slate-200' : 'text-slate-500'} hover: bg - slate - 700 transition - colors`} title="Yükleri Göster/Gizle">
                        {showLoads ? <Eye size={12} /> : <EyeOff size={12} />}
                        <span className="text-[9px] ml-1 uppercase font-bold">{t('vis.loads')}</span>
                    </button>
                    <button onClick={() => setShowReactions(!showReactions)} className={`p - 1 rounded ${showReactions ? 'text-slate-200' : 'text-slate-500'} hover: bg - slate - 700 transition - colors`} title="Tepkileri Göster/Gizle">
                        {showReactions ? <Eye size={12} /> : <EyeOff size={12} />}
                        <span className="text-[9px] ml-1 uppercase font-bold">{t('vis.reactions')}</span>
                    </button>
                    <button onClick={() => setShowDimensions(!showDimensions)} className={`p - 1 rounded ${showDimensions ? 'text-slate-200' : 'text-slate-500'} hover: bg - slate - 700 transition - colors`} title="Ölçüleri Göster/Gizle">
                        {showDimensions ? <Eye size={12} /> : <EyeOff size={12} />}
                        <span className="text-[9px] ml-1 uppercase font-bold">{t('vis.dimensions')}</span>
                    </button>
                    <div className="w-px h-3 bg-slate-600 mx-1"></div>
                    <button onClick={handleExport} className="p-1 rounded text-cyan-400 hover:bg-cyan-900/30 hover:text-cyan-300 transition-colors flex items-center gap-1" title="PNG Olarak Kaydet">
                        <Camera size={12} />
                        <span className="text-[9px] uppercase font-bold">{t('vis.png')}</span>
                    </button>
                </div>

                {hoverPt && overlay !== 'none' && (
                    <div className="ml-auto text-[10px] font-mono text-slate-300 bg-slate-900/80 rounded px-2 py-1 border border-slate-700/50 shadow-sm backdrop-blur-sm">
                        x={hoverX?.toFixed(3)}m
                        {overlay === 'moment' && <span className="text-red-400"> | M={hoverPt.moment.toFixed(3)} kNm</span>}
                        {overlay === 'shear' && <span className="text-cyan-400"> | V={hoverPt.shear.toFixed(3)} kN</span>}
                        {overlay === 'deflection' && <span className="text-blue-400"> | δ={(hoverPt.deflection * 1000).toFixed(3)} mm</span>}
                    </div>
                )}
            </div>

            <svg
                ref={svgRef}
                width="100%"
                viewBox={`0 0 ${W} ${H} `}
                className="overflow-visible"
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoverX(null)}
            >
                <defs>
                    {/* Grid */}
                    <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                        <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                    </pattern>
                    {/* Load arrow (red, points down to beam) */}
                    <marker id="arrowLoad" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto">
                        <polygon points="0 0, 8 3, 0 6" fill="#ef4444" />
                    </marker>
                    {/* Reaction arrow (green, points up) */}
                    <marker id="rxnArrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                        <polygon points="8 0, 0 3, 8 6" fill="#10b981" />
                    </marker>
                    {/* Moment arrow (purple) */}
                    <marker id="arrowMoment" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto">
                        <polygon points="0 0, 8 3, 0 6" fill="#8b5cf6" />
                    </marker>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />

                {/* === DIAGRAM OVERLAY (below beam) === */}
                {renderOverlay()}

                {/* === REACTION ARROWS (just below supports) === */}
                {showReactions && renderReactions()}

                {/* === BEAM BODY === */}
                <g>
                    <rect
                        x={toSvgX(0)}
                        y={beamTop}
                        width={beam.length * (drawW / beam.length)}
                        height={BEAM_H}
                        fill="#94a3b8"
                        stroke="#475569"
                        strokeWidth="1.5"
                        rx={2}
                    />
                </g>

                {/* === DYNAMIC DIMENSION CHAIN (below beam) === */}
                {showDimensions && (() => {
                    // Gather all critical x positions: beam ends + supports + load positions
                    const keyXSet = new Set<number>();
                    keyXSet.add(0);
                    keyXSet.add(beam.length);
                    beam.supports.forEach(s => keyXSet.add(s.position));
                    beam.loads.forEach(ld => {
                        if (ld.type === 'point' || ld.type === 'moment') {
                            keyXSet.add(ld.position);
                        }
                        if (ld.type === 'distributed') {
                            if (ld.startPosition !== undefined) keyXSet.add(ld.startPosition);
                            if (ld.endPosition !== undefined) keyXSet.add(ld.endPosition);
                        }
                    });

                    const sorted = Array.from(keyXSet).sort((a, b) => a - b);

                    // Dimension line sits at a fixed y below the beam
                    // Must clear support symbols (~beamBot+35) and reaction labels (~+52)
                    // So we place the dim chain at beamBot+14 — just poking out below beam, above supports
                    // Actually: we place it AFTER supports & reactions.
                    // Let's place it between beam and supports — at beamBot+4 (tiny gap below beam bar)
                    // And draw tick marks going DOWN from beam axis, labels just under them
                    // This avoids the support zone entirely since ticks are short (8px).
                    // WAIT: supports start at beamBot and go down ~32px.
                    // So any ticks below beamBot will clash with support symbols.
                    // Better: place dim chain just ABOVE beam at beamTop-2 going UP 10px,
                    // but that was the original issue (labels above).
                    // Cleanest: place dim chain at a FIXED y BELOW all support+reaction content.
                    // beamBot + 52 (reaction labels) + 20px gap = beamBot + 72
                    const DIM_Y = beamBot + 72;   // horizontal dim line y
                    const TICK_H = 7;              // tick height

                    return (
                        <g>
                            {/* Overall span line */}
                            <line
                                x1={toSvgX(0)} y1={DIM_Y}
                                x2={toSvgX(beam.length)} y2={DIM_Y}
                                stroke="#1e3a5f" strokeWidth="1"
                            />

                            {/* Segment dimension lines */}
                            {sorted.map((x, i) => {
                                if (i === sorted.length - 1) return null;
                                const x2 = sorted[i + 1];
                                const svgX1 = toSvgX(x);
                                const svgX2 = toSvgX(x2);
                                const midX = (svgX1 + svgX2) / 2;
                                const seg = (x2 - x).toFixed(2).replace(/\.?0+$/, '');
                                const segLabel = `${seg} m`;
                                return (
                                    <g key={`dim - ${i} `}>
                                        {/* Segment line */}
                                        <line x1={svgX1 + 1} y1={DIM_Y}
                                            x2={svgX2 - 1} y2={DIM_Y}
                                            stroke="#334155" strokeWidth="1.5"
                                        />
                                        {/* Left tick */}
                                        <line x1={svgX1} y1={DIM_Y - TICK_H}
                                            x2={svgX1} y2={DIM_Y + TICK_H}
                                            stroke="#475569" strokeWidth="1.5"
                                        />
                                        {/* Right tick */}
                                        <line x1={svgX2} y1={DIM_Y - TICK_H}
                                            x2={svgX2} y2={DIM_Y + TICK_H}
                                            stroke="#475569" strokeWidth="1.5"
                                        />
                                        {/* Distance label */}
                                        <text
                                            x={midX} y={DIM_Y - TICK_H - 3}
                                            textAnchor="middle"
                                            fill="#94a3b8" fontSize="9"
                                            fontFamily="monospace"
                                        >
                                            {segLabel}
                                        </text>
                                    </g>
                                );
                            })}

                            {/* Absolute position labels at each key x */}
                            {sorted.map(x => (
                                <text
                                    key={`pos - ${x} `}
                                    x={toSvgX(x)} y={DIM_Y + TICK_H + 10}
                                    textAnchor="middle"
                                    fill="#334155" fontSize="8"
                                    fontFamily="monospace"
                                >
                                    {x === 0 || x === beam.length ? `${x} m` : ''}
                                </text>
                            ))}
                        </g>
                    );
                })()}

                {/* === SUPPORTS === */}
                {beam.supports.map(s => {
                    const x = toSvgX(s.position);
                    return (
                        <g key={s.id} transform={`translate(${x}, ${beamBot})`}>
                            <g transform={`rotate(${- (s.supportAngle || 0)})`}>
                                {s.type === 'pinned' && (
                                    <>
                                        <polygon points="0,0 -12,18 12,18" fill="#1d4ed8" stroke="#3b82f6" strokeWidth="1.5" />
                                        <circle cx="0" cy="0" r="3.5" fill="#93c5fd" stroke="#3b82f6" strokeWidth="1" />
                                        <line x1="-14" y1="20" x2="14" y2="20" stroke="#3b82f6" strokeWidth="2" />
                                        {/* Hatch */}
                                        {[-10, -5, 0, 5, 10].map(i => (
                                            <line key={i} x1={i} y1={20} x2={i - 5} y2={26}
                                                stroke="#1e3a5f" strokeWidth="1" />
                                        ))}
                                    </>
                                )}
                                {s.type === 'roller' && (
                                    <>
                                        <polygon points="0,0 -12,16 12,16" fill="#1d4ed8" stroke="#3b82f6" strokeWidth="1.5" opacity={0.7} />
                                        <circle cx="0" cy="21" r="5" fill="#1d4ed8" stroke="#3b82f6" strokeWidth="1.5" />
                                        <line x1="-14" y1="27" x2="14" y2="27" stroke="#3b82f6" strokeWidth="1.5" />
                                    </>
                                )}
                                {s.type === 'fixed' && (
                                    <>
                                        <rect x="-4" y="0" width="8" height="30" fill="#1d4ed8" stroke="#3b82f6" strokeWidth="1" />
                                        {[-12, -6, 0, 6, 12].map((i, idx) => (
                                            <line key={idx} x1={i} y1={0} x2={i - 6} y2={8}
                                                stroke="#3b82f6" strokeWidth="1" opacity={0.7} />
                                        ))}
                                    </>
                                )}
                            </g>
                            {/* Settlement indicator */}
                            {(s as any).settlement && Math.abs((s as any).settlement) > 0 && (
                                <text x={0} y={35} textAnchor="middle" fill="#f59e0b" fontSize="9">
                                    Δ={(s as any).settlement}m
                                </text>
                            )}
                            <text x={0} y={s.type === 'fixed' ? -5 : -6} textAnchor="middle"
                                fill="#60a5fa" fontSize="10" fontWeight="bold" fontFamily="monospace">
                                {s.id}
                            </text>
                        </g>
                    );
                })}

                {/* === HINGES === */}
                {(beam.hinges || []).map(h => (
                    <g key={h.id} transform={`translate(${toSvgX(h.position)}, ${BEAM_Y})`}>
                        <circle r="5" fill="#0f172a" stroke="#a78bfa" strokeWidth="2" />
                        <text y="-12" textAnchor="middle" fill="#a78bfa" fontSize="9" fontWeight="bold">G</text>
                    </g>
                ))}

                {/* === LOADS === */}
                {showLoads && beam.loads.map(load => {
                    // Max magnitude for proportional arrow scaling
                    const maxMag = Math.max(...beam.loads.map(l => Math.abs(l.magnitude)), 1);

                    if (load.type === 'point') {
                        const x = toSvgX(load.position);
                        const angle = load.angle ?? 90;
                        const arrowLen = 20 + (Math.abs(load.magnitude) / maxMag) * 40;
                        const rot = 90 - angle;
                        return (
                            <g key={load.id} transform={`translate(${x}, ${beamTop})`}>
                                <g transform={`rotate(${rot})`}>
                                    <line x1="0" y1={-arrowLen} x2="0" y2={-1}
                                        stroke="#ef4444" strokeWidth="3"
                                        markerEnd="url(#arrowLoad)" />
                                    <text x="0" y={-arrowLen - 6} textAnchor="middle"
                                        transform={`rotate(${- rot} 0 ${- arrowLen - 6})`}
                                        fill="#ef4444" fontSize="11" fontWeight="bold" fontFamily="monospace">
                                        {load.magnitude}kN
                                    </text>
                                </g>
                            </g>
                        );
                    }

                    if (load.type === 'distributed' && load.startPosition !== undefined && load.endPosition !== undefined) {
                        const sx = toSvgX(load.startPosition);
                        const ex = toSvgX(load.endPosition);
                        const w1 = load.magnitude;
                        const w2 = load.endMagnitude ?? w1;
                        const h1 = 15 + (Math.abs(w1) / maxMag) * 45;
                        const h2 = 15 + (Math.abs(w2) / maxMag) * 45;
                        const len = ex - sx;
                        const numArrows = Math.max(2, Math.floor(len / 30));
                        const arrows = Array.from({ length: numArrows + 1 }, (_, i) => {
                            const frac = numArrows === 0 ? 0 : i / numArrows;
                            const ax = sx + frac * len;
                            const ah = h1 + (h2 - h1) * frac;
                            return { ax, ah };
                        });
                        return (
                            <g key={load.id}>
                                <polygon
                                    points={`${sx},${beamTop} ${sx},${beamTop - h1} ${ex},${beamTop - h2} ${ex},${beamTop} `}
                                    fill="#ef4444" fillOpacity="0.1" />
                                <line x1={sx} y1={beamTop - h1} x2={ex} y2={beamTop - h2}
                                    stroke="#ef4444" strokeWidth="2" />
                                {arrows.map(({ ax, ah }, i) => (
                                    <line key={i} x1={ax} y1={beamTop - ah} x2={ax} y2={beamTop - 1}
                                        stroke="#ef4444" strokeWidth="1.5"
                                        markerEnd="url(#arrowLoad)" opacity={0.8} />
                                ))}
                                <text x={sx} y={beamTop - h1 - 6} textAnchor="middle"
                                    fill="#ef4444" fontSize="10" fontFamily="monospace">{w1}kN/m</text>
                                {Math.abs(w2 - w1) > 0.01 && (
                                    <text x={ex} y={beamTop - h2 - 6} textAnchor="middle"
                                        fill="#ef4444" fontSize="10" fontFamily="monospace">{w2}kN/m</text>
                                )}
                            </g>
                        );
                    }

                    if (load.type === 'moment') {
                        const x = toSvgX(load.position);
                        const cw = load.magnitude > 0; // positive = CW
                        return (
                            <g key={load.id} transform={`translate(${x}, ${beamTop})`}>
                                <path
                                    d={cw
                                        ? "M -16 -16 A 16 16 0 1 1 0 -32"
                                        : "M 16 -16 A 16 16 0 1 0 0 -32"}
                                    fill="none" stroke="#8b5cf6" strokeWidth="2.5"
                                    markerEnd="url(#arrowMoment)" />
                                <text x="0" y="-38" textAnchor="middle"
                                    fill="#8b5cf6" fontSize="11" fontWeight="bold" fontFamily="monospace">
                                    {load.magnitude}kNm
                                </text>
                            </g>
                        );
                    }

                    return null;
                })}

                {/* === HOVER CROSSHAIR === */}
                {hoverX !== null && (
                    <line
                        x1={toSvgX(hoverX)} y1={PAD_Y}
                        x2={toSvgX(hoverX)} y2={H - PAD_Y}
                        stroke="#475569" strokeWidth="1" strokeDasharray="4 3"
                        pointerEvents="none"
                    />
                )}
            </svg>
        </div>
    );
};
