import React, { useRef, useState } from 'react';
import type { Structure, Node, AnalysisResult } from '../types';

interface StructureCanvasProps {
    structure: Structure;
    results: AnalysisResult | null;
    tool: 'select' | 'node' | 'member';
    onAddNode: (x: number, y: number) => Node;
    onAddMember: (startId: string, endId: string) => void;
    onSelect: (id: string | null) => void;
    onUpdateNode: (id: string, x: number, y: number) => void;
    selectedId: string | null;
    activeDiagram: 'none' | 'N' | 'V' | 'M' | 'D'; // D for Deflection (Deformed Shape)
}

export const StructureCanvas: React.FC<StructureCanvasProps> = ({
    structure, results, tool, onAddNode, onAddMember, onSelect, onUpdateNode, selectedId, activeDiagram
}) => {
    // ... (existing state) ...

    // Diagram Rendering
    const renderDiagrams = () => {
        if (!results || activeDiagram === 'none') return null;

        return (
            <g>
                {structure.members.map(m => {
                    const res = results.memberForces[m.id];
                    if (!res) return null;

                    const startNode = structure.nodes.find(n => n.id === m.startNodeId);
                    const endNode = structure.nodes.find(n => n.id === m.endNodeId);
                    if (!startNode || endNode === undefined) return null; // Logic fix: endNode check

                    const p1 = worldToScreen(startNode.x, startNode.y); // Use original coords for diagrams (except Deflection)
                    const p2 = worldToScreen(endNode.x, endNode.y);

                    // Local coordinate system calculations
                    const dx = p2.x - p1.x;
                    const dy = p2.y - p1.y;
                    // const L_screen = Math.sqrt(dx * dx + dy * dy);
                    const angle = Math.atan2(dy, dx); // Screen angle

                    // Values
                    let vStart = 0, vEnd = 0;
                    let scale = 0.5; // Scale factor for diagrams

                    if (activeDiagram === 'N') { // Axial
                        vStart = res.startForce.N;
                        vEnd = res.endForce.N; // Note: Check sign convention. Tension usually positive?
                    } else if (activeDiagram === 'V') { // Shear
                        vStart = res.startForce.V;
                        vEnd = res.endForce.V; // Local y
                    } else if (activeDiagram === 'M') { // Moment
                        vStart = res.startForce.M;
                        vEnd = -res.endForce.M; // Moment sign convention often flips at end?
                        scale = 1.0;
                    }

                    // For now, draw simple trapezoid
                    // Normal vector (perpendicular to member)
                    const nx = -Math.sin(angle);
                    const ny = Math.cos(angle);

                    // Points offset by value * scale
                    const p1_top = { x: p1.x + nx * vStart * scale, y: p1.y + ny * vStart * scale };
                    const p2_top = { x: p2.x + nx * vEnd * scale, y: p2.y + ny * vEnd * scale };

                    return (
                        <g key={m.id}>
                            <path
                                d={`M ${p1.x} ${p1.y} L ${p1_top.x} ${p1_top.y} L ${p2_top.x} ${p2_top.y} L ${p2.x} ${p2.y} Z`}
                                fill={activeDiagram === 'M' ? "rgba(255, 100, 100, 0.3)" : "rgba(100, 200, 255, 0.3)"}
                                stroke={activeDiagram === 'M' ? "rgba(255, 100, 100, 0.8)" : "rgba(100, 200, 255, 0.8)"}
                                strokeWidth="1"
                            />
                            {/* Value Labels */}
                            <text x={p1_top.x} y={p1_top.y} fill="white" fontSize="9">{vStart.toFixed(1)}</text>
                            <text x={p2_top.x} y={p2_top.y} fill="white" fontSize="9">{vEnd.toFixed(1)}</text>
                        </g>
                    );
                })}
            </g>
        );
    };
    const containerRef = useRef<HTMLDivElement>(null);
    const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
    const [isDragging, setIsDragging] = useState(false);
    const [/* dragStartPos */, setDragStartPos] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
    const [dragNodeId, setDragNodeId] = useState<string | null>(null);

    // Interaction State
    const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);
    const [memberStartNodeId, setMemberStartNodeId] = useState<string | null>(null);
    const [mouseWorldPos, setMouseWorldPos] = useState({ x: 0, y: 0 });

    // Constants
    const GRID_SIZE = 1; // meter

    const screenToWorld = (sx: number, sy: number) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        // SVG Coord system: x right, y down. But we want structural Y up?
        // Let's stick to SVG standard (y down) for canvas logic, but display standard coordinates?
        // Actually, structural analysis usually Y is UP. 
        // Let's implement Y-UP for World.

        const cx = rect.width / 2;
        const cy = rect.height / 2;

        const wx = (sx - rect.left - cx - view.x) / (50 * view.zoom);
        const wy = -(sy - rect.top - cy - view.y) / (50 * view.zoom); // Negative for Y-UP
        return { x: wx, y: wy };
    };

    const worldToScreen = (wx: number, wy: number) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;

        const sx = cx + view.x + wx * 50 * view.zoom;
        const sy = cy + view.y - wy * 50 * view.zoom; // Negative for Y-UP
        return { x: sx, y: sy };
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault(); // Prevent page scrolling
        const scale = e.deltaY > 0 ? 0.9 : 1.1;
        setView(v => ({ ...v, zoom: v.zoom * scale }));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 1 || (e.button === 0 && e.altKey)) { // Middle click or Alt + Left click for pan
            setIsPanning(true);
            setLastMousePos({ x: e.clientX, y: e.clientY });
            return;
        }

        if (e.button === 0) { // Left click
            const { x, y } = screenToWorld(e.clientX, e.clientY);

            // Snap to Grid
            let snappedX = Math.round(x / GRID_SIZE) * GRID_SIZE;
            let snappedY = Math.round(y / GRID_SIZE) * GRID_SIZE;

            // Snap to Node (priority)
            if (hoverNodeId) {
                const node = structure.nodes.find(n => n.id === hoverNodeId);
                if (node) {
                    snappedX = node.x;
                    snappedY = node.y;
                }
            }

            if (tool === 'node') {
                if (!hoverNodeId) { // Only add node if not hovering over an existing one
                    onAddNode(snappedX, snappedY);
                }
            } else if (tool === 'member') {
                if (hoverNodeId) {
                    if (!memberStartNodeId) {
                        setMemberStartNodeId(hoverNodeId);
                    } else {
                        // Complete member
                        if (hoverNodeId !== memberStartNodeId) {
                            onAddMember(memberStartNodeId, hoverNodeId);
                            setMemberStartNodeId(hoverNodeId); // Chain
                        } else {
                            setMemberStartNodeId(null); // Clicked same node, cancel
                        }
                    }
                } else {
                    // Clicked empty space for member? Auto-create node?
                    const newNode = onAddNode(snappedX, snappedY);
                    if (!memberStartNodeId) {
                        setMemberStartNodeId(newNode.id);
                    } else {
                        onAddMember(memberStartNodeId, newNode.id);
                        setMemberStartNodeId(newNode.id);
                    }
                }
            } else if (tool === 'select') {
                if (hoverNodeId) {
                    onSelect(hoverNodeId);
                    // Start Node Dragging
                    setIsDragging(true);
                    setDragNodeId(hoverNodeId);
                    setDragStartPos({ x: snappedX, y: snappedY }); // Store node's world position
                } else {
                    // Check member click (simplified: checking closest distance to line segment)
                    let clickedMemberId: string | null = null;
                    let minDist = 0.5; // World units threshold for clicking a member

                    structure.members.forEach(m => {
                        const n1 = structure.nodes.find(n => n.id === m.startNodeId);
                        const n2 = structure.nodes.find(n => n.id === m.endNodeId);
                        if (n1 && n2) {
                            const dist = pointToSegmentDistance(x, y, n1.x, n1.y, n2.x, n2.y);
                            if (dist < minDist) {
                                minDist = dist;
                                clickedMemberId = m.id;
                            }
                        }
                    });

                    onSelect(clickedMemberId);
                }
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const { x, y } = screenToWorld(e.clientX, e.clientY);
        setMouseWorldPos({ x, y });

        if (isPanning) {
            const dx = e.clientX - lastMousePos.x;
            const dy = e.clientY - lastMousePos.y;
            // Adjust view.x and view.y based on mouse movement, scaled by zoom
            setView(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
            setLastMousePos({ x: e.clientX, y: e.clientY });
            return;
        }

        // Node Dragging Logic
        if (isDragging && dragNodeId && tool === 'select') {
            let snappedX = Math.round(x / GRID_SIZE) * GRID_SIZE;
            let snappedY = Math.round(y / GRID_SIZE) * GRID_SIZE;

            // Dynamic Dragging
            onUpdateNode(dragNodeId, snappedX, snappedY);
        }

        // Hover Check (Nodes)
        let foundNodeId: string | null = null;
        // Check nodes (reverse order to prioritize nodes drawn later, i.e., "on top")
        for (let i = structure.nodes.length - 1; i >= 0; i--) {
            const node = structure.nodes[i];
            const screenPos = worldToScreen(node.x, node.y);
            const dist = Math.hypot(screenPos.x - e.clientX, screenPos.y - e.clientY);
            if (dist < 15) { // 15px radius interaction
                foundNodeId = node.id;
                break;
            }
        }
        setHoverNodeId(foundNodeId);
    };

    const handleMouseUp = () => {
        setIsPanning(false);
        setIsDragging(false);
        setDragNodeId(null);
        // Do not reset memberStartNodeId here, right click handles that.
    };

    // Right click to cancel tool or chain
    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        setMemberStartNodeId(null);
        setIsDragging(false); // Also cancel dragging on right click
        setDragNodeId(null);
    };

    // Load Rendering Logic
    const renderLoads = () => {
        return (
            <g>
                {structure.loads.map(load => {
                    if (load.type === 'nodal') {
                        const node = structure.nodes.find(n => n.id === load.targetId);
                        if (!node) return null;
                        const p = worldToScreen(node.x, node.y);
                        const arrowSize = 40; // Fixed pixel size on screen

                        return (
                            <g key={load.id} transform={`translate(${p.x}, ${p.y})`}>
                                {/* FX Load */}
                                {load.fx && (
                                    <g transform={`rotate(${load.fx > 0 ? 0 : 180}) translate(-${arrowSize}, 0)`}>
                                        <line x1="0" y1="0" x2={arrowSize} y2="0" stroke="#fbbf24" strokeWidth="2" markerEnd="url(#arrowhead)" />
                                        <text x="-5" y="-5" fill="#fbbf24" fontSize="10">{Math.abs(load.fx)} kN</text>
                                    </g>
                                )}
                                {/* FY Load (Y-Up in structure, so Fy > 0 is Up, but SVG Y is down) --> Screen Y = -World Y */}
                                {/* Wait, worldToScreen handles the flip. If Fy is positive (UP), we want arrow pointing UP. */}
                                {/* SVG Coords: Up is -y. So we want arrow pointing to -y. */}
                                {load.fy && (
                                    <g transform={`rotate(${load.fy > 0 ? -90 : 90}) translate(-${arrowSize}, 0)`}>
                                        <line x1="0" y1="0" x2={arrowSize} y2="0" stroke="#fbbf24" strokeWidth="2" markerEnd="url(#arrowhead)" />
                                        <text x="-5" y="-5" fill="#fbbf24" fontSize="10" transform="rotate(-90)">{Math.abs(load.fy)} kN</text>
                                    </g>
                                )}
                                {/* Mz Moment */}
                                {load.mz && (
                                    <g>
                                        <path d={`M -15 0 A 15 15 0 1 ${load.mz > 0 ? 0 : 1} 0 15`} fill="none" stroke="#fbbf24" strokeWidth="2" markerEnd="url(#arrowhead)" />
                                        <text x="20" y="-10" fill="#fbbf24" fontSize="10">{Math.abs(load.mz)} kNm</text>
                                    </g>
                                )}
                            </g>
                        );
                    } else if (load.type === 'member_point') {
                        const member = structure.members.find(m => m.id === load.targetId);
                        if (!member || !load.P) return null;
                        const n1 = structure.nodes.find(n => n.id === member.startNodeId);
                        const n2 = structure.nodes.find(n => n.id === member.endNodeId);
                        if (!n1 || !n2) return null;

                        const L_total = Math.hypot(n2.x - n1.x, n2.y - n1.y);
                        const ratio = (load.L || 0) / L_total;
                        const clampedRatio = Math.max(0, Math.min(1, ratio));

                        const worldX = n1.x + (n2.x - n1.x) * clampedRatio;
                        const worldY = n1.y + (n2.y - n1.y) * clampedRatio;
                        const p = worldToScreen(worldX, worldY);

                        // Arrow pointing down (gravity)
                        const arrowSize = 30;
                        return (
                            <g key={load.id} transform={`translate(${p.x}, ${p.y})`}>
                                <line x1="0" y1={-arrowSize} x2="0" y2="0" stroke="#f43f5e" strokeWidth="2" markerEnd="url(#arrowhead)" />
                                <text x="5" y={-arrowSize / 2} fill="#f43f5e" fontSize="9">{load.P} kN</text>
                            </g>
                        );
                    } else if (load.type === 'member_distributed') {
                        const member = structure.members.find(m => m.id === load.targetId);
                        if (!member || !load.wStart) return null;
                        const n1 = structure.nodes.find(n => n.id === member.startNodeId);
                        const n2 = structure.nodes.find(n => n.id === member.endNodeId);
                        if (!n1 || !n2) return null;

                        const p1 = worldToScreen(n1.x, n1.y);
                        const p2 = worldToScreen(n2.x, n2.y);

                        // Draw a rectangle over the member with some downward arrows
                        const arrowHeight = 20;

                        // A simple path for the distributed load
                        return (
                            <g key={load.id}>
                                <path d={`M ${p1.x} ${p1.y - arrowHeight} L ${p2.x} ${p2.y - arrowHeight}`} stroke="#f43f5e" strokeWidth="1" strokeDasharray="4 2" />
                                {/* Draw 3 arrows */}
                                {[0.25, 0.5, 0.75].map(ratio => {
                                    const x = p1.x + (p2.x - p1.x) * ratio;
                                    const y = p1.y + (p2.y - p1.y) * ratio;
                                    return (
                                        <line key={ratio} x1={x} y1={y - arrowHeight} x2={x} y2={y - 2} stroke="#f43f5e" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
                                    );
                                })}
                                <text x={p1.x + (p2.x - p1.x) / 2} y={p1.y + (p2.y - p1.y) / 2 - arrowHeight - 5} fill="#f43f5e" fontSize="9" textAnchor="middle">{load.wStart} kN/m</text>
                            </g>
                        );
                    }
                    return null;
                })}
            </g>
        );
    };

    // Grid Rendering Logic
    const renderGrid = () => {
        const gridSize = 50 * view.zoom; // Pixels per meter
        const offsetX = view.x % gridSize;
        const offsetY = view.y % gridSize;

        // Calculate visible range to optimize or just use a large pattern?
        // Pattern approach is best for infinite grid
        return (
            <defs>
                <pattern id="smallGrid" width={gridSize / 10} height={gridSize / 10} patternUnits="userSpaceOnUse">
                    <path d={`M ${gridSize / 10} 0 L 0 0 0 ${gridSize / 10}`} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                </pattern>
                <pattern id="grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse" x={offsetX} y={offsetY}>
                    <rect width={gridSize} height={gridSize} fill="url(#smallGrid)" />
                    <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                </pattern>
            </defs>
        );
    };

    // Auxiliary math for member selection
    const pointToSegmentDistance = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        const dot = A * C + B * D;
        const len_sq = C * C + D * D;
        let param = -1;
        if (len_sq !== 0) param = dot / len_sq;
        let xx, yy;
        if (param < 0) { xx = x1; yy = y1; }
        else if (param > 1) { xx = x2; yy = y2; }
        else { xx = x1 + param * C; yy = y1 + param * D; }
        const dx = px - xx;
        const dy = py - yy;
        return Math.sqrt(dx * dx + dy * dy);
    };

    return (
        <div
            ref={containerRef}
            className="w-full h-full bg-[#1e1e1e] overflow-hidden relative cursor-crosshair font-mono" // Darker CAD background
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onContextMenu={handleContextMenu}
        >
            {/* HUD / Info Overlay */}
            <div className="absolute top-4 left-4 pointer-events-none select-none text-[#00ffcc] text-xs space-y-1 z-10 bg-black/40 p-2 rounded border border-[#00ffcc]/20 backdrop-blur-sm">
                <div>COORD: {mouseWorldPos.x.toFixed(3)}, {mouseWorldPos.y.toFixed(3)}</div>
                <div>TOOL:  <span className="font-bold text-white">{tool.toUpperCase()}</span></div>
                <div>ZOOM:  {(view.zoom * 100).toFixed(0)}%</div>
                <div className="text-slate-500 mt-2 border-t border-slate-700 pt-1">
                    [L-Click] Select/Place<br />
                    [M-Click/Alt+L-Click] Pan<br />
                    [Wheel] Zoom<br />
                    [R-Click] Cancel
                </div>
            </div>

            <svg className="w-full h-full pointer-events-none">
                <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#fbbf24" />
                    </marker>
                </defs>
                {renderGrid()}
                <rect width="100%" height="100%" fill="url(#grid)" />
                {renderDiagrams()}
                {renderLoads()}

                {/* Origin Marker */}
                <g transform={`translate(${worldToScreen(0, 0).x}, ${worldToScreen(0, 0).y})`}>
                    <line x1="-10" y1="0" x2="10" y2="0" stroke="#ef4444" strokeWidth="2" opacity="0.5" />
                    <line x1="0" y1="-10" x2="0" y2="10" stroke="#22c55e" strokeWidth="2" opacity="0.5" />
                </g>

                {/* Main Content Group */}
                <g>
                    {/* Members */}
                    {structure.members.map(m => {
                        const start = structure.nodes.find(n => n.id === m.startNodeId);
                        const end = structure.nodes.find(n => n.id === m.endNodeId);
                        if (!start || !end) return null;

                        const p1 = worldToScreen(start.x, start.y);
                        const p2 = worldToScreen(end.x, end.y);
                        const isSelected = selectedId === m.id;

                        return (
                            <g key={m.id}>
                                <line
                                    x1={p1.x} y1={p1.y}
                                    x2={p2.x} y2={p2.y}
                                    stroke={isSelected ? "#00ffcc" : "#e2e8f0"}
                                    strokeWidth={isSelected ? 4 : 2} // Thicker members
                                    className="transition-colors duration-200"
                                />
                                {/* Member Label */}
                                <rect x={(p1.x + p2.x) / 2 - 12} y={(p1.y + p2.y) / 2 - 8} width="24" height="16" fill="#18181b" rx="2" stroke={isSelected ? "#00ffcc" : "#3f3f46"} strokeWidth="1" />
                                <text x={(p1.x + p2.x) / 2} y={(p1.y + p2.y) / 2} fill="#e2e8f0" fontSize="10" fontWeight="bold" textAnchor="middle" dominantBaseline="central">{m.id}</text>
                            </g>
                        );
                    })}

                    {/* Rubber Band */}
                    {tool === 'member' && memberStartNodeId && (
                        <line
                            x1={worldToScreen(structure.nodes.find(n => n.id === memberStartNodeId)!.x, structure.nodes.find(n => n.id === memberStartNodeId)!.y).x}
                            y1={worldToScreen(structure.nodes.find(n => n.id === memberStartNodeId)!.x, structure.nodes.find(n => n.id === memberStartNodeId)!.y).y}
                            x2={worldToScreen(mouseWorldPos.x, mouseWorldPos.y).x}
                            y2={worldToScreen(mouseWorldPos.x, mouseWorldPos.y).y}
                            stroke="#f59e0b"
                            strokeWidth="2"
                            strokeDasharray="5,5"
                        />
                    )}

                    {/* Nodes & Supports - SCALE UP 3X */}
                    {structure.nodes.map(n => {
                        const p = worldToScreen(n.x, n.y);
                        const isHover = n.id === hoverNodeId;
                        const isSelected = n.id === selectedId;

                        // Support Visuals (Scaled Up)
                        const supportScale = 1.5; // Scale factor for visuals

                        return (
                            <g key={n.id} transform={`translate(${p.x}, ${p.y})`}>
                                {/* Fixed Support */}
                                {n.restraints.dx && n.restraints.dy && n.restraints.rz && (
                                    <g transform={`scale(${supportScale}) translate(0, 8)`}>
                                        <rect x="-12" y="0" width="24" height="6" fill="#ef4444" stroke="#7f1d1d" strokeWidth="1" />
                                        <line x1="-12" y1="6" x2="-14" y2="10" stroke="#7f1d1d" strokeWidth="1" />
                                        <line x1="-6" y1="6" x2="-8" y2="10" stroke="#7f1d1d" strokeWidth="1" />
                                        <line x1="0" y1="6" x2="-2" y2="10" stroke="#7f1d1d" strokeWidth="1" />
                                        <line x1="6" y1="6" x2="4" y2="10" stroke="#7f1d1d" strokeWidth="1" />
                                        <line x1="12" y1="6" x2="10" y2="10" stroke="#7f1d1d" strokeWidth="1" />
                                    </g>
                                )}
                                {/* Pin Support */}
                                {n.restraints.dx && n.restraints.dy && !n.restraints.rz && (
                                    <g transform={`scale(${supportScale}) translate(0, 8)`}>
                                        <path d="M 0 0 L -10 14 L 10 14 Z" fill="#3b82f6" stroke="#1e3a8a" strokeWidth="1" />
                                        <line x1="-14" y1="14" x2="14" y2="14" stroke="#1e3a8a" strokeWidth="2" />
                                    </g>
                                )}
                                {/* Roller Support */}
                                {(!n.restraints.dx && n.restraints.dy && !n.restraints.rz) && (
                                    <g transform={`scale(${supportScale}) translate(0, 8)`}>
                                        <circle cx="0" cy="6" r="6" fill="#f59e0b" stroke="#78350f" strokeWidth="1" />
                                        <line x1="-12" y1="13" x2="12" y2="13" stroke="#78350f" strokeWidth="2" />
                                    </g>
                                )}

                                {/* Node Point */}
                                <circle
                                    r={isHover ? 8 : 6}
                                    fill={isSelected ? "#00ffcc" : (isHover ? "#fff" : "#3b82f6")}
                                    stroke="#0f172a"
                                    strokeWidth="2"
                                    className="transition-all duration-150"
                                />
                                <text x="10" y="-10" fill="#94a3b8" fontSize="12" fontWeight="bold" style={{ textShadow: '0px 1px 2px #000' }}>{n.id}</text>
                            </g>
                        );
                    })}
                </g>
            </svg>
        </div>
    );
};
