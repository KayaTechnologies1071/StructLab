import React, { useRef, useState } from 'react';
import type { Truss, TrussAnalysisResult, TrussLoad } from './types';
import { Camera, EyeOff, Eye } from 'lucide-react';
import { exportSvgAsPng } from '../../utils/exportImage';
import { useLanguage } from '../../contexts/LanguageContext';

interface TrussVisualizerProps {
    truss: Truss;
    results?: TrussAnalysisResult | null;
    width?: number;
    height?: number;
}

export const TrussVisualizer: React.FC<TrussVisualizerProps> = ({ truss, results }) => {
    const { t } = useLanguage();
    const [overlay, setOverlay] = useState<'none' | 'axial' | 'shear' | 'moment'>('none');
    const [showLoads, setShowLoads] = useState(true);
    const [showReactions, setShowReactions] = useState(true);
    const [showNodes, setShowNodes] = useState(true);
    const [showDimensions, setShowDimensions] = useState(true);

    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    const handleExport = () => {
        if (svgRef.current) {
            exportSvgAsPng(svgRef.current, `frame_analysis_${overlay}`);
        }
    };

    const [dimensions, setDimensions] = useState({ width: 800, height: 400 });

    React.useEffect(() => {
        const updateDims = () => {
            if (containerRef.current) {
                setDimensions({
                    width: containerRef.current.clientWidth,
                    height: containerRef.current.clientHeight
                });
            }
        };
        updateDims();
        window.addEventListener('resize', updateDims);
        return () => window.removeEventListener('resize', updateDims);
    }, []);

    const { width, height } = dimensions;

    // 1. Calculate Bounding Box
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    if (truss.nodes.length === 0) {
        minX = 0; maxX = 10; minY = 0; maxY = 5;
    } else {
        truss.nodes.forEach(n => {
            if (n.x < minX) minX = n.x;
            if (n.x > maxX) maxX = n.x;
            if (n.y < minY) minY = n.y;
            if (n.y > maxY) maxY = n.y;
        });
    }

    const contentWidth = maxX - minX || 1;
    const contentHeight = maxY - minY || 1;

    // Generous padding to ensure forces and diagram peaks remain visible
    const paddingX = 140;
    const paddingY = 160;

    const scaleX = (width - 2 * paddingX) / contentWidth;
    const scaleY = (height - 2 * paddingY) / contentHeight;
    const scale = Math.min(scaleX, scaleY);

    const centerX = width / 2;
    const centerY = height / 2;
    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;

    const toSvgX = (x: number) => centerX + (x - contentCenterX) * scale;
    const toSvgY = (y: number) => centerY - (y - contentCenterY) * scale; // Flip Y

    const maxMag = Math.max(
        ...truss.loads.map(l => {
            if (l.type === 'point' || l.type === 'distributed') return Math.abs(l.magnitude || 0);
            if (l.type === 'nodal') return Math.max(Math.abs(l.fx || 0), Math.abs(l.fy || 0), Math.abs(l.m || 0));
            return 0;
        }),
        1
    );

    const renderArrowhead = () => (
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
        </marker>
    );

    const renderMomentArrowhead = () => (
        <marker id="moment-arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
            <polygon points="0 0, 6 3, 0 6" fill="#8b5cf6" />
        </marker>
    );

    const renderRxnArrowhead = () => (
        <marker id="rxnArrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#10b981" />
        </marker>
    );

    const renderRxnMomentArrowhead = () => (
        <marker id="rxn-moment-arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
            <polygon points="0 0, 6 3, 0 6" fill="#10b981" />
        </marker>
    );


    const renderMemberLoad = (m: any, load: TrussLoad) => {
        const start = truss.nodes.find(n => n.id === m.startNodeId)!;
        const end = truss.nodes.find(n => n.id === m.endNodeId)!;
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const L = Math.sqrt(dx * dx + dy * dy);
        if (L === 0) return null;

        const c = dx / L;
        const s = dy / L;

        // Base coordinate of the start node in SVG
        const sx = toSvgX(start.x);
        const sy = toSvgY(start.y);

        const mag = load.magnitude || 0;
        if (mag === 0) return null;

        const maxMag = Math.max(0.1, ...truss.loads.filter(l => l.type !== 'temperature' && l.type !== 'nodal').map(l => Math.abs(l.magnitude || 0)));
        const arrowLen = 20 + (Math.abs(mag) / maxMag) * 40;

        // Global angle in mathematically standard coordinate system
        const angleRad = ((load.angle !== undefined ? load.angle : 270) * Math.PI) / 180;
        const dirSign = mag >= 0 ? 1 : -1;

        // Physical X maps to SVG X straight. Physical Y maps to inverted SVG Y (-Y).
        const dirX = Math.cos(angleRad) * arrowLen * dirSign;
        const dirY = -Math.sin(angleRad) * arrowLen * dirSign;

        if (load.type === 'point') {
            const pos = load.position ?? (L / 2);
            const lx = sx + c * pos * scale;
            const ly = sy - s * pos * scale;

            return (
                <g key={`mload-${load.id}`}>
                    <line
                        x1={lx - dirX} y1={ly - dirY}
                        x2={lx} y2={ly}
                        stroke="#ef4444" strokeWidth="3" markerEnd="url(#arrowhead)"
                    />
                    <text x={lx - dirX * 1.25} y={ly - dirY * 1.25} fill="#ef4444" fontSize="11" fontWeight="bold" fontFamily="monospace" textAnchor="middle">{Math.abs(mag).toPrecision(3).replace(/\.0+$/, '')}kN</text>
                </g>
            );
        } else if (load.type === 'distributed') {
            const st = load.startPosition ?? 0;
            const en = load.endPosition ?? L;

            const lx1 = sx + c * st * scale;
            const ly1 = sy - s * st * scale;
            const lx2 = sx + c * en * scale;
            const ly2 = sy - s * en * scale;

            const numArrows = Math.max(3, Math.floor((en - st) / L * 10));
            const arrows = [];
            for (let i = 0; i <= numArrows; i++) {
                const t = i / numArrows;
                const ax = lx1 + (lx2 - lx1) * t;
                const ay = ly1 + (ly2 - ly1) * t;
                arrows.push(
                    <line key={`dist-${load.id}-${i}`}
                        x1={ax - dirX} y1={ay - dirY}
                        x2={ax} y2={ay}
                        stroke="#ef4444" strokeWidth="1.5" markerEnd="url(#arrowhead)" opacity={0.8}
                    />
                );
            }

            return (
                <g key={`mload-${load.id}`}>
                    <polygon
                        points={`${lx1},${ly1} ${lx1 - dirX},${ly1 - dirY} ${lx2 - dirX},${ly2 - dirY} ${lx2},${ly2}`}
                        fill="#ef4444" fillOpacity="0.1"
                    />
                    <line x1={lx1 - dirX} y1={ly1 - dirY} x2={lx2 - dirX} y2={ly2 - dirY} stroke="#ef4444" strokeWidth="2" />
                    {arrows}
                    <text x={lx1 - dirX * 1.2} y={ly1 - dirY * 1.2} fill="#ef4444" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle">{Math.abs(mag).toPrecision(3).replace(/\.0+$/, '')}kN/m</text>
                    <text x={lx2 - dirX * 1.2} y={ly2 - dirY * 1.2} fill="#ef4444" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle">{Math.abs(mag).toPrecision(3).replace(/\.0+$/, '')}kN/m</text>
                </g>
            );
        }
        return null;
    };

    const maxOverlayVal = Math.max(0.001, ...truss.members.map(m => {
        const res = results?.memberResults?.[m.id];
        if (!res?.diagrams) return 0;
        return Math.max(...res.diagrams.map(pt => Math.abs(overlay === 'axial' ? pt.n : overlay === 'shear' ? pt.v : pt.m)));
    }));
    const diagramScale = 45 / maxOverlayVal; // Max 45px offset for diagrams

    return (
        <div ref={containerRef} className="relative w-full h-full min-h-[400px]">
            <div className="absolute top-3 right-3 z-20 flex flex-col gap-2 items-end max-w-[calc(100%-24px)]">
                {results && (
                    <div className="flex gap-1 bg-slate-900/90 p-1.5 rounded-lg border border-slate-700/80 shadow-lg backdrop-blur">
                        {(['none', 'axial', 'shear', 'moment'] as const).map(mode => (
                            <button
                                key={mode}
                                onClick={() => setOverlay(mode)}
                                className={`px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase rounded transition-colors ${overlay === mode ? 'bg-blue-600 text-white shadow-inner' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>
                )}

                {/* View Controls */}
                <div className="flex items-center gap-1 bg-slate-800/60 rounded-md p-1 border border-slate-700/50 overflow-x-auto custom-scrollbar whitespace-nowrap max-w-full">
                    <button onClick={() => setShowLoads(!showLoads)} className={`p-1 rounded ${showLoads ? 'text-slate-200' : 'text-slate-500'} hover:bg-slate-700 transition-colors flex items-center`} title="Yükleri Göster/Gizle">
                        {showLoads ? <Eye size={12} /> : <EyeOff size={12} />}
                        <span className="text-[9px] ml-1 uppercase font-bold">{t('vis.loads')}</span>
                    </button>
                    <button onClick={() => setShowReactions(!showReactions)} className={`p-1 rounded ${showReactions ? 'text-slate-200' : 'text-slate-500'} hover:bg-slate-700 transition-colors flex items-center`} title="Tepkileri Göster/Gizle">
                        {showReactions ? <Eye size={12} /> : <EyeOff size={12} />}
                        <span className="text-[9px] ml-1 uppercase font-bold">{t('vis.reactions')}</span>
                    </button>
                    <button onClick={() => setShowNodes(!showNodes)} className={`p-1 rounded ${showNodes ? 'text-slate-200' : 'text-slate-500'} hover:bg-slate-700 transition-colors flex items-center`} title="Düğümleri Göster/Gizle">
                        {showNodes ? <Eye size={12} /> : <EyeOff size={12} />}
                        <span className="text-[9px] ml-1 uppercase font-bold">{t('panel.nodes')}</span>
                    </button>
                    <button onClick={() => setShowDimensions(!showDimensions)} className={`p-1 rounded ${showDimensions ? 'text-slate-200' : 'text-slate-500'} hover:bg-slate-700 transition-colors flex items-center`} title="Ölçüleri Göster/Gizle">
                        {showDimensions ? <Eye size={12} /> : <EyeOff size={12} />}
                        <span className="text-[9px] ml-1 uppercase font-bold">{t('vis.dimensions')}</span>
                    </button>
                    <div className="w-px h-3 bg-slate-600 mx-1"></div>
                    <button onClick={handleExport} className="p-1 rounded text-cyan-400 hover:bg-cyan-900/30 hover:text-cyan-300 transition-colors flex items-center gap-1" title="PNG Olarak Kaydet">
                        <Camera size={12} />
                        <span className="text-[9px] uppercase font-bold">{t('vis.png')}</span>
                    </button>
                </div>
            </div>

            <svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" className="bg-slate-900/50 rounded-lg w-full h-full">
                <defs>
                    <pattern id="grid-truss" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                    </pattern>
                    {renderArrowhead()}
                    {renderMomentArrowhead()}
                    {renderRxnArrowhead()}
                    {renderRxnMomentArrowhead()}
                </defs>
                <rect width="100%" height="100%" fill="url(#grid-truss)" />

                {/* Member Diagrams Overlay */}
                {overlay !== 'none' && truss.members.map(member => {
                    const res = results?.memberResults?.[member.id];
                    if (!res?.diagrams || res.diagrams.length === 0) return null;
                    const start = truss.nodes.find(n => n.id === member.startNodeId)!;
                    const end = truss.nodes.find(n => n.id === member.endNodeId)!;

                    const sx1 = toSvgX(start.x);
                    const sy1 = toSvgY(start.y);
                    const sx2 = toSvgX(end.x);
                    const sy2 = toSvgY(end.y);
                    const dx = sx2 - sx1;
                    const dy = sy2 - sy1;
                    const sL = Math.sqrt(dx * dx + dy * dy);
                    if (sL === 0) return null;

                    const ux = dx / sL;
                    const uy = dy / sL;
                    const px = -uy;
                    const py = ux;

                    let maxVal = -Infinity;
                    let maxDisplayVal = 0;
                    let maxIdx = 0;

                    let minVal = Infinity;
                    let minDisplayVal = 0;
                    let minIdx = 0;

                    const ptsInfo = res.diagrams.map((pt, i) => {
                        const L_phys = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
                        const bx = sx1 + (pt.x / L_phys) * dx;
                        const by = sy1 + (pt.x / L_phys) * dy;

                        let rawVal = overlay === 'axial' ? pt.n : overlay === 'shear' ? pt.v : pt.m;
                        let val = rawVal;
                        // Sign conventions for drawing: 
                        // Axial: + Tension (draw 'up') -> invert val so +val goes 'up' in our px/py rules
                        // Shear: + Down -> val goes 'down'
                        // Moment: + Sagging -> val goes 'down' on tension side
                        if (overlay === 'axial' || overlay === 'shear') val = -val;

                        if (val > maxVal) { maxVal = val; maxIdx = i; maxDisplayVal = rawVal; }
                        if (val < minVal) { minVal = val; minIdx = i; minDisplayVal = rawVal; }

                        const ox = bx + px * val * diagramScale;
                        const oy = by + py * val * diagramScale;
                        return { str: `${ox},${oy}`, ox, oy };
                    });

                    const polyPoints = [
                        `${sx1},${sy1}`,
                        ...ptsInfo.map(p => p.str),
                        `${sx2},${sy2}`
                    ].join(' ');

                    const dColor = overlay === 'axial' ? '#3b82f6' : overlay === 'shear' ? '#06b6d4' : '#ef4444';

                    // Hatching lines (optional, adds clarity like beam analysis standard)
                    const hatchLines = ptsInfo.map((p, i) => {
                        if (i % 2 !== 0) return null;
                        const pt = res.diagrams![i];
                        const L_phys = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
                        const bx = sx1 + (pt.x / L_phys) * dx;
                        const by = sy1 + (pt.x / L_phys) * dy;
                        return <line key={`hatch-${member.id}-${i}`} x1={bx} y1={by} x2={p.ox} y2={p.oy} stroke={dColor} strokeWidth="0.5" opacity="0.4" />;
                    });

                    // Draw max/min labels
                    const labels = [];
                    if (Math.abs(maxVal) > 0.01) {
                        const p = ptsInfo[maxIdx];
                        labels.push(
                            <g key="max-lbl">
                                <circle cx={p.ox} cy={p.oy} r={3} fill={dColor} />
                                <text x={p.ox + px * 8} y={p.oy + py * 8 + 4} fill={dColor} fontSize="11" fontWeight="bold" fontFamily="monospace" textAnchor="middle" style={{ textShadow: '1px 1px 2px #0f172a' }}>
                                    {maxDisplayVal.toPrecision(4).replace(/\.0+$/, '')}
                                </text>
                            </g>
                        );
                    }
                    if (Math.abs(minVal) > 0.01 && Math.abs(maxVal - minVal) > 0.01) {
                        const p = ptsInfo[minIdx];
                        labels.push(
                            <g key="min-lbl">
                                <circle cx={p.ox} cy={p.oy} r={3} fill={dColor} />
                                <text x={p.ox + px * 8} y={p.oy + py * 8 + 4} fill={dColor} fontSize="11" fontWeight="bold" fontFamily="monospace" textAnchor="middle" style={{ textShadow: '1px 1px 2px #0f172a' }}>
                                    {minDisplayVal.toPrecision(4).replace(/\.0+$/, '')}
                                </text>
                            </g>
                        );
                    }

                    return (
                        <g key={`diag-${member.id}`}>
                            <polygon points={polyPoints} fill={dColor} fillOpacity="0.15" />
                            {hatchLines}
                            <polyline points={polyPoints} fill="none" stroke={dColor} strokeWidth="2" />
                            {labels}
                        </g>
                    );
                })}

                {/* Members */}
                {truss.members.map(member => {
                    const start = truss.nodes.find(n => n.id === member.startNodeId);
                    const end = truss.nodes.find(n => n.id === member.endNodeId);
                    if (!start || !end) return null;

                    const result = results?.memberResults?.[member.id];
                    let color = "#94a3b8"; // Default Slate
                    let strokeWidth = 2;

                    if (result && overlay === 'none') {
                        // Color by axial force (N) by default if no overlay
                        const nForce = Math.abs(result.start.n) > Math.abs(result.end.n) ? result.start.n : result.end.n;
                        if (Math.abs(nForce) < 0.001) color = "#94a3b8";
                        else if (nForce > 0) { color = "#3b82f6"; strokeWidth = 3; } // Tension
                        else { color = "#ef4444"; strokeWidth = 3; } // Compression
                    } else if (overlay !== 'none') {
                        // Grey out members slightly when showing diagrams
                        color = "#475569";
                        strokeWidth = 2;
                    }

                    return (
                        <g key={`mem-wrapper-${member.id}`}>
                            <line
                                x1={toSvgX(start.x)} y1={toSvgY(start.y)}
                                x2={toSvgX(end.x)} y2={toSvgY(end.y)}
                                stroke={color}
                                strokeWidth={strokeWidth}
                                strokeLinecap="round"
                            />
                            {/* Member Dimensions */}
                            {showDimensions && (() => {
                                const dx = end.x - start.x;
                                const dy = end.y - start.y;
                                const rLen = Math.sqrt(dx * dx + dy * dy);
                                if (rLen === 0) return null;

                                const sx = toSvgX(start.x);
                                const sy = toSvgY(start.y);
                                const ex = toSvgX(end.x);
                                const ey = toSvgY(end.y);
                                const pdx = ex - sx;
                                const pdy = ey - sy;
                                const pLen = Math.sqrt(pdx * pdx + pdy * pdy);

                                const ux = pdx / pLen;
                                const uy = pdy / pLen;
                                const px = -uy;
                                const py = ux;

                                const offset = 35; // 35 pixels offset for dimension lines
                                const dsx = sx + px * offset;
                                const dsy = sy + py * offset;
                                const dex = ex + px * offset;
                                const dey = ey + py * offset;

                                const mx = (dsx + dex) / 2;
                                const my = (dsy + dey) / 2;

                                let rot = Math.atan2(pdy, pdx) * 180 / Math.PI;
                                if (rot > 90 || rot < -90) rot += 180;

                                return (
                                    <g className="opacity-40">
                                        <line x1={dsx} y1={dsy} x2={dex} y2={dey} stroke="#94a3b8" strokeWidth="1" />
                                        <line x1={dsx - px * 4} y1={dsy - py * 4} x2={dsx + px * 4} y2={dsy + py * 4} stroke="#94a3b8" strokeWidth="1.5" />
                                        <line x1={dex - px * 4} y1={dey - py * 4} x2={dex + px * 4} y2={dey + py * 4} stroke="#94a3b8" strokeWidth="1.5" />
                                        <rect x={mx - 15} y={my - 8} width="30" height="16" fill="#0f172a" rx="4" transform={`rotate(${rot}, ${mx}, ${my})`} />
                                        <text x={mx} y={my + 3} fill="#94a3b8" fontSize="9" fontFamily="monospace" textAnchor="middle" transform={`rotate(${rot}, ${mx}, ${my})`}>{rLen.toPrecision(3).replace(/\.0+$/, '')}m</text>
                                    </g>
                                );
                            })()}
                        </g>
                    );
                })}

                {/* Member Loads */}
                {showLoads && truss.members.map(member =>
                    truss.loads.filter(l => l.memberId === member.id && (l.type === 'point' || l.type === 'distributed'))
                        .map(load => renderMemberLoad(member, load))
                )}

                {/* Nodes */}
                {truss.nodes.map(node => (
                    <g key={node.id} transform={`translate(${toSvgX(node.x)}, ${toSvgY(node.y)})`}>
                        {/* Support Symbols */}
                        <g transform={`rotate(${-(node.supportAngle || 0)})`}>
                            {node.support === 'pinned' && (
                                <path d="M -8 10 L 0 0 L 8 10 Z M -12 10 L 12 10" fill="none" stroke="#60a5fa" strokeWidth="2" />
                            )}
                            {node.support === 'roller' && (
                                <g>
                                    <circle cx="-5" cy="14" r="3" fill="none" stroke="#60a5fa" />
                                    <circle cx="5" cy="14" r="3" fill="none" stroke="#60a5fa" />
                                    <path d="M -8 10 L 0 0 L 8 10 Z" fill="none" stroke="#60a5fa" strokeWidth="2" />
                                </g>
                            )}
                            {node.support === 'fixed' && (
                                <g>
                                    <rect x="-2" y="-12" width="4" height="24" fill="#60a5fa" />
                                    <path d="M -2 -10 L -8 -16 M -2 -2 L -8 -8 M -2 6 L -8 0 M -2 14 L -8 8 M -2 22 L -8 16" stroke="#60a5fa" strokeWidth="1" />
                                </g>
                            )}
                        </g>

                        {/* Node Circle */}
                        {showNodes && <circle r="4" fill="#f8fafc" stroke="#1e293b" strokeWidth="2" />}

                        {/* Nodal Loads */}
                        {showLoads && truss.loads.filter(l => l.type === 'nodal' && l.nodeId === node.id).map((load, idx) => {
                            const lenFy = 20 + (Math.abs(load.fy || 0) / maxMag) * 40;
                            const lenFx = 20 + (Math.abs(load.fx || 0) / maxMag) * 40;
                            return (
                                <g key={`nload-${load.id}-${idx}`}>
                                    {load.fy && load.fy < 0 && (
                                        <g>
                                            <line x1="0" y1={-lenFy} x2="0" y2="-5" stroke="#ef4444" strokeWidth="3" markerEnd="url(#arrowhead)" />
                                            <text x="0" y={-lenFy - 6} fill="#ef4444" fontSize="11" fontWeight="bold" fontFamily="monospace" textAnchor="middle">{Math.abs(load.fy)}kN</text>
                                        </g>
                                    )}
                                    {load.fy && load.fy > 0 && (
                                        <g>
                                            <line x1="0" y1={lenFy} x2="0" y2="5" stroke="#ef4444" strokeWidth="3" markerEnd="url(#arrowhead)" />
                                            <text x="0" y={lenFy + 12} fill="#ef4444" fontSize="11" fontWeight="bold" fontFamily="monospace" textAnchor="middle">{load.fy}kN</text>
                                        </g>
                                    )}
                                    {load.fx && load.fx > 0 && (
                                        <g>
                                            <line x1={-lenFx} y1="0" x2="-5" y2="0" stroke="#ef4444" strokeWidth="3" markerEnd="url(#arrowhead)" />
                                            <text x={-lenFx - 5} y="4" fill="#ef4444" fontSize="11" fontWeight="bold" fontFamily="monospace" textAnchor="end">{load.fx}kN</text>
                                        </g>
                                    )}
                                    {load.fx && load.fx < 0 && (
                                        <g>
                                            <line x1={lenFx} y1="0" x2="5" y2="0" stroke="#ef4444" strokeWidth="3" markerEnd="url(#arrowhead)" />
                                            <text x={lenFx + 5} y="4" fill="#ef4444" fontSize="11" fontWeight="bold" fontFamily="monospace" textAnchor="start">{Math.abs(load.fx)}kN</text>
                                        </g>
                                    )}
                                    {load.m && load.m !== 0 && (
                                        <g>
                                            <path
                                                d={load.m > 0 ? "M 15 0 A 15 15 0 0 1 -15 0" : "M -15 0 A 15 15 0 0 1 15 0"}
                                                fill="none" stroke="#8b5cf6" strokeWidth="2.5" markerEnd="url(#moment-arrow)"
                                            />
                                            <text x={load.m > 0 ? -12 : 20} y="-15" fill="#8b5cf6" fontSize="11" fontWeight="bold" fontFamily="monospace">{Math.abs(load.m)}kNm</text>
                                        </g>
                                    )}
                                </g>
                            )
                        })}

                        {/* Support Reactions */}
                        {showReactions && results?.reactions?.[node.id] && (() => {
                            const rxn = results.reactions[node.id];
                            return (
                                <g key={`rxn-${node.id}`}>
                                    {Math.abs(rxn.rx) > 0.001 && (() => {
                                        const dir = rxn.rx > 0 ? 1 : -1;
                                        const len = 35;
                                        const ox = dir > 0 ? -len - 15 : len + 15;
                                        return (
                                            <g>
                                                <line x1={ox} y1="0" x2={dir * 10} y2="0" stroke="#10b981" strokeWidth="3" markerEnd="url(#rxnArrow)" />
                                                <text x={ox - dir * 5} y="-5" fill="#10b981" fontSize="11" fontWeight="bold" fontFamily="monospace" textAnchor={dir > 0 ? 'end' : 'start'}>{Math.abs(rxn.rx).toFixed(3)}kN</text>
                                            </g>
                                        );
                                    })()}
                                    {Math.abs(rxn.ry) > 0.001 && (() => {
                                        const dir = rxn.ry > 0 ? 1 : -1;
                                        const len = 35;
                                        // Ry > 0 means support pushes UP. SVG up is -y.
                                        // line from below node, pointing to node (-10)
                                        const oy = dir > 0 ? len + 15 : -len - 15;
                                        return (
                                            <g>
                                                <line x1="0" y1={oy} x2="0" y2={dir > 0 ? 10 : -10} stroke="#10b981" strokeWidth="3" markerEnd="url(#rxnArrow)" />
                                                <text x="8" y={oy + (dir > 0 ? 10 : -5)} fill="#10b981" fontSize="11" fontWeight="bold" fontFamily="monospace" textAnchor="start">{Math.abs(rxn.ry).toFixed(3)}kN</text>
                                            </g>
                                        );
                                    })()}
                                    {Math.abs(rxn.rm) > 0.001 && (
                                        <g>
                                            <path
                                                d={rxn.rm > 0 ? "M 20 0 A 20 20 0 0 1 -20 0" : "M -20 0 A 20 20 0 0 1 20 0"}
                                                fill="none" stroke="#10b981" strokeWidth="2.5" markerEnd="url(#rxn-moment-arrow)"
                                            />
                                            <text x={rxn.rm > 0 ? -15 : 25} y="-20" fill="#10b981" fontSize="11" fontWeight="bold" fontFamily="monospace">{Math.abs(rxn.rm).toFixed(3)}kNm</text>
                                        </g>
                                    )}
                                </g>
                            );
                        })()}

                        <text x="8" y="-8" fill="rgba(255,255,255,0.7)" fontSize="11" fontWeight="bold" fontFamily="monospace">{node.id}</text>
                    </g>
                ))}
            </svg>
        </div>
    );
};
