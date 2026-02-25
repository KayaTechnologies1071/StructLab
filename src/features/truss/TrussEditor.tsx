import React from 'react';
import type { Truss, Node, Member, SupportType, TrussLoad } from './types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Plus, Trash2 } from 'lucide-react';

const SliderInput = ({ label, value, min, max, step, unit, onChange }: { label: string, value: number, min: number, max: number, step: number, unit: string, onChange: (v: number) => void }) => {
    return (
        <div className="mb-4">
            <div className="flex justify-between items-center mb-1.5">
                <label className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">{label}</label>
                <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-200">{value}</span>
                    <span className="text-[10px] font-bold text-slate-500 lowercase">{unit}</span>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <input
                    type="range"
                    min={min} max={max} step={step}
                    value={value}
                    onChange={e => onChange(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="relative w-16 shrink-0 flex items-center bg-slate-800/80 border border-slate-700/50 rounded-md overflow-hidden focus-within:border-blue-500/50 transition-colors">
                    <input
                        type="number"
                        min={min} max={max} step={step}
                        value={value}
                        onChange={e => onChange(Number(e.target.value))}
                        className="w-full bg-transparent px-1 py-1.5 text-xs text-center text-white font-mono focus:outline-none appearance-none"
                    />
                    <span className="absolute right-1 text-[9px] text-cyan-600 font-bold select-none pointer-events-none">{unit}</span>
                </div>
            </div>
        </div>
    );
};

interface TrussEditorProps {
    truss: Truss;
    onChange: (truss: Truss) => void;
}

export const TrussEditor: React.FC<TrussEditorProps> = ({ truss, onChange }) => {

    const addNode = () => {
        const id = (truss.nodes.length + 1).toString();
        const newNode: Node = { id, x: 0, y: 0, support: 'none' };
        onChange({ ...truss, nodes: [...truss.nodes, newNode] });
    };

    const updateNode = (id: string, updates: Partial<Node>) => {
        onChange({ ...truss, nodes: truss.nodes.map(n => n.id === id ? { ...n, ...updates } : n) });
    };

    const removeNode = (id: string) => {
        onChange({
            nodes: truss.nodes.filter(n => n.id !== id),
            members: truss.members.filter(m => m.startNodeId !== id && m.endNodeId !== id),
            loads: (truss.loads || []).filter(l => l.nodeId !== id)
        });
    };

    const addMember = () => {
        if (truss.nodes.length < 2) return;
        const id = `m${truss.members.length + 1}`;
        const newMember: Member = {
            id,
            startNodeId: truss.nodes[0]?.id || '',
            endNodeId: truss.nodes[1]?.id || truss.nodes[0]?.id || '',
            area: 10,
            momentOfInertia: 5000,
            elasticModulus: 200
        };
        onChange({ ...truss, members: [...truss.members, newMember] });
    };

    const updateMember = (id: string, updates: Partial<Member>) => {
        onChange({ ...truss, members: truss.members.map(m => m.id === id ? { ...m, ...updates } : m) });
    };

    const removeMember = (id: string) => {
        onChange({
            ...truss,
            members: truss.members.filter(m => m.id !== id),
            loads: (truss.loads || []).filter(l => l.memberId !== id)
        });
    };

    const addLoad = () => {
        const id = `l${(truss.loads?.length || 0) + 1}`;
        const newLoad: TrussLoad = {
            id,
            type: 'nodal',
            nodeId: truss.nodes[0]?.id || '',
            fx: 0,
            fy: 0
        };
        onChange({ ...truss, loads: [...(truss.loads || []), newLoad] });
    };

    const updateLoad = (id: string, updates: Partial<TrussLoad>) => {
        onChange({ ...truss, loads: truss.loads?.map(l => l.id === id ? { ...l, ...updates } : l) || [] });
    };

    const removeLoad = (id: string) => {
        onChange({ ...truss, loads: truss.loads?.filter(l => l.id !== id) || [] });
    };

    return (
        <div className="space-y-4 h-full overflow-y-auto pr-2 custom-scrollbar">
            <Card title="Nodes" action={<Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={addNode} />}>
                <div className="space-y-2">
                    {truss.nodes.map(node => (
                        <div key={node.id} className="bg-slate-800/50 p-2 rounded border border-slate-700/50">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold text-blue-400">Node {node.id}</span>
                                <div className="flex gap-1">
                                    <button onClick={() => removeNode(node.id)} className="text-red-400 hover:text-red-300"><Trash2 size={12} /></button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <label className="text-[10px] text-slate-400">X: <input className="w-12 bg-slate-900 border border-slate-700 rounded px-1" type="number" value={node.x} onChange={e => updateNode(node.id, { x: Number(e.target.value) })} /></label>
                                <label className="text-[10px] text-slate-400">Y: <input className="w-12 bg-slate-900 border border-slate-700 rounded px-1" type="number" value={node.y} onChange={e => updateNode(node.id, { y: Number(e.target.value) })} /></label>
                            </div>
                            <div className="mb-2">
                                <label className="text-[10px] block text-slate-400">Support</label>
                                <select className="w-full bg-slate-900 border border-slate-700 rounded text-xs p-1" value={node.support} onChange={e => updateNode(node.id, { support: e.target.value as SupportType })}>
                                    <option value="none">None</option>
                                    <option value="pinned">Pinned</option>
                                    <option value="roller">Roller</option>
                                    <option value="fixed">Fixed</option>
                                </select>
                            </div>
                            {node.support !== 'none' && (
                                <div className="mb-2">
                                    <label className="text-[10px] block text-slate-400">Support Angle (°)</label>
                                    <input
                                        className="w-full bg-slate-900 border border-slate-700 rounded text-xs p-1"
                                        type="number"
                                        value={node.supportAngle || 0}
                                        onChange={e => updateNode(node.id, { supportAngle: Number(e.target.value) })}
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </Card>

            <Card title="Members" action={<Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={addMember} />}>
                <div className="space-y-2">
                    {truss.members.map(member => (
                        <div key={member.id} className="bg-slate-800/50 p-2 rounded border border-slate-700/50 flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-emerald-400">Member {member.id}</span>
                                <button onClick={() => removeMember(member.id)} className="text-red-400 hover:text-red-300"><Trash2 size={12} /></button>
                            </div>
                            <div className="flex items-center gap-2">
                                <select className="bg-slate-900 border border-slate-700 rounded text-xs p-1 w-1/2" value={member.startNodeId} onChange={e => updateMember(member.id, { startNodeId: e.target.value })}>
                                    {truss.nodes.map(n => <option key={n.id} value={n.id}>{n.id}</option>)}
                                </select>
                                <span className="text-slate-500">-&gt;</span>
                                <select className="bg-slate-900 border border-slate-700 rounded text-xs p-1 w-1/2" value={member.endNodeId} onChange={e => updateMember(member.id, { endNodeId: e.target.value })}>
                                    {truss.nodes.map(n => <option key={n.id} value={n.id}>{n.id}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-1">
                                <div className="flex flex-col">
                                    <label className="text-[9px] text-slate-500 mb-0.5">Area (cm²)</label>
                                    <input className="bg-slate-900 border border-slate-700 rounded px-1 py-1 text-[10px] text-emerald-200 font-mono" type="number" value={member.area} onChange={e => updateMember(member.id, { area: Number(e.target.value) })} />
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-[9px] text-slate-500 mb-0.5">Inertia (cm⁴)</label>
                                    <input className="bg-slate-900 border border-slate-700 rounded px-1 py-1 text-[10px] text-emerald-200 font-mono" type="number" value={member.momentOfInertia || 5000} onChange={e => updateMember(member.id, { momentOfInertia: Number(e.target.value) })} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            <Card title="Loads" action={<Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={addLoad} />}>
                <div className="space-y-4">
                    {(truss.loads || []).map((load, idx) => {
                        // Helper to find member length for position sliders
                        let maxL = 10;
                        if (load.memberId) {
                            const mem = truss.members.find(m => m.id === load.memberId);
                            if (mem) {
                                const st = truss.nodes.find(n => n.id === mem.startNodeId);
                                const en = truss.nodes.find(n => n.id === mem.endNodeId);
                                if (st && en) maxL = Math.hypot(en.x - st.x, en.y - st.y);
                            }
                        }

                        return (
                            <div key={load.id} className="mb-4 border-b border-slate-700/30 pb-4 last:border-0 last:pb-0 relative group">
                                <div className="flex justify-between items-center mb-3">
                                    <div className="flex items-center gap-2 w-full pr-4">
                                        <span className="text-xs font-bold text-red-300 whitespace-nowrap">Load {idx + 1}</span>
                                        <select
                                            className="bg-slate-800 border min-w-0 flex-1 border-slate-700 rounded-md px-2 py-1 text-xs text-slate-200 outline-none"
                                            value={load.type}
                                            onChange={e => updateLoad(load.id, { type: e.target.value as TrussLoad['type'] })}
                                        >
                                            <option value="nodal">Nodal (F/M)</option>
                                            <option value="point">Point (Member)</option>
                                            <option value="distributed">Distributed (Member)</option>
                                            <option value="temperature">Temperature</option>
                                        </select>
                                    </div>
                                    <button onClick={() => removeLoad(load.id)} className="text-slate-600 hover:text-red-400 absolute right-0 transition-colors">
                                        <Trash2 size={14} />
                                    </button>
                                </div>

                                {/* Target Selection */}
                                <div className="mb-4 flex items-center gap-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">{load.type === 'nodal' ? 'Target Node' : 'Target Member'}</label>
                                    <select
                                        className="bg-slate-900 border border-slate-700/80 rounded px-2 py-1 text-[11px] text-blue-300 outline-none flex-1"
                                        value={load.type === 'nodal' ? (load.nodeId || '') : (load.memberId || '')}
                                        onChange={e => load.type === 'nodal' ? updateLoad(load.id, { nodeId: e.target.value }) : updateLoad(load.id, { memberId: e.target.value })}
                                    >
                                        <option value="">Select Target...</option>
                                        {load.type === 'nodal'
                                            ? truss.nodes.map(n => <option key={n.id} value={n.id}>Node {n.id}</option>)
                                            : truss.members.map(m => <option key={m.id} value={m.id}>Member {m.id}</option>)
                                        }
                                    </select>
                                </div>

                                {/* Sub-parameters */}
                                {load.type === 'nodal' && (
                                    <>
                                        <SliderInput label="Fx Force" value={load.fx ?? 0} min={-200} max={200} step={1} unit="kN" onChange={v => updateLoad(load.id, { fx: v })} />
                                        <SliderInput label="Fy Force" value={load.fy ?? 0} min={-200} max={200} step={1} unit="kN" onChange={v => updateLoad(load.id, { fy: v })} />
                                        <SliderInput label="Moment" value={load.m ?? 0} min={-500} max={500} step={5} unit="kNm" onChange={v => updateLoad(load.id, { m: v })} />
                                    </>
                                )}

                                {(load.type === 'point' || load.type === 'distributed') && (
                                    <>
                                        <SliderInput label="Magnitude" value={load.magnitude ?? 0} min={-200} max={200} step={1} unit={load.type === 'point' ? 'kN' : 'kN/m'} onChange={v => updateLoad(load.id, { magnitude: v })} />
                                        <SliderInput label="Angle" value={load.angle ?? 90} min={0} max={360} step={5} unit="°" onChange={v => updateLoad(load.id, { angle: v })} />
                                        {load.type === 'point' && (
                                            <SliderInput label="Position" value={load.position ?? 0} min={0} max={Math.max(0.1, maxL)} step={0.1} unit="m" onChange={v => updateLoad(load.id, { position: v })} />
                                        )}
                                        {load.type === 'distributed' && (
                                            <>
                                                <SliderInput label="Start Pos" value={load.startPosition ?? 0} min={0} max={Math.max(0.1, maxL)} step={0.1} unit="m" onChange={v => updateLoad(load.id, { startPosition: v })} />
                                                <SliderInput label="End Pos" value={load.endPosition ?? maxL} min={0} max={Math.max(0.1, maxL)} step={0.1} unit="m" onChange={v => updateLoad(load.id, { endPosition: v })} />
                                            </>
                                        )}
                                    </>
                                )}

                                {load.type === 'temperature' && (
                                    <>
                                        <SliderInput label="Delta Temp" value={load.deltaT ?? 0} min={-100} max={100} step={1} unit="°C" onChange={v => updateLoad(load.id, { deltaT: v })} />
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </Card>
        </div>
    );
};
