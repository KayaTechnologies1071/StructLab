import { useState } from 'react';
import { StructureCanvas } from './components/StructureCanvas';
import { useStructure } from './hooks/useStructure';
import { FrameResults } from './FrameResults';
import { Button } from '../../components/ui/Button';
import { MousePointer2, Circle, PenTool, Play, Trash2 } from 'lucide-react';

export const FrameEditor = () => {
    const {
        structure,
        results,
        selectedId,
        setSelectedId,
        addNode,
        addMember,
        updateNode,
        updateNodeLoad,
        updateLoad,
        addLoad,
        analyze,
        setStructure
    } = useStructure();

    const [tool, setTool] = useState<'select' | 'node' | 'member'>('select');
    const [activeDiagram, setActiveDiagram] = useState<'none' | 'N' | 'V' | 'M' | 'D'>('none');
    const [rightTab, setRightTab] = useState<'inspector' | 'results'>('inspector');
    const handleSelect = (id: string | null) => {
        setSelectedId(id);
    };

    const selectedNode = structure.nodes.find(n => n.id === selectedId);
    const selectedMember = structure.members.find(m => m.id === selectedId);

    return (
        <div className="flex h-full w-full bg-[#0a0e1a]">
            {/* Toolbar (CAD Style) */}
            <div className="w-12 flex flex-col items-center gap-2 py-3 border-r border-slate-800 bg-[#18181b] z-20">
                <ToolButton icon={<MousePointer2 size={18} />} active={tool === 'select'} onClick={() => setTool('select')} label="Select Object" />
                <div className="w-8 h-px bg-slate-800 my-1" />
                <ToolButton icon={<Circle size={18} />} active={tool === 'node'} onClick={() => setTool('node')} label="Draw Node" />
                <ToolButton icon={<PenTool size={18} />} active={tool === 'member'} onClick={() => setTool('member')} label="Draw Frame" />

                <div className="flex-1" />

                {/* Diagram Toggles */}
                <div className="flex flex-col gap-1 mb-2">
                    <DiagramButton label="N" active={activeDiagram === 'N'} onClick={() => setActiveDiagram(activeDiagram === 'N' ? 'none' : 'N')} />
                    <DiagramButton label="V" active={activeDiagram === 'V'} onClick={() => setActiveDiagram(activeDiagram === 'V' ? 'none' : 'V')} />
                    <DiagramButton label="M" active={activeDiagram === 'M'} onClick={() => setActiveDiagram(activeDiagram === 'M' ? 'none' : 'M')} />
                </div>

                <ToolButton
                    icon={<Play size={18} className="text-green-500 fill-green-500/20" />}
                    active={false}
                    onClick={analyze}
                    label="Run Analysis"
                />
            </div>

            {/* Canvas */}
            <div className="flex-1 relative bg-[#09090b]">
                <StructureCanvas
                    structure={structure}
                    results={results}
                    tool={tool}
                    onAddNode={addNode}
                    onAddMember={addMember}
                    onSelect={handleSelect}
                    onUpdateNode={(id, x, y) => updateNode(id, { x, y })}
                    selectedId={selectedId}
                    activeDiagram={activeDiagram}
                />
            </div>

            {/* Properties Inspector + Results (Right) */}
            <div className="w-80 bg-[#18181b] border-l border-slate-800 flex flex-col text-slate-300 z-20">
                <div className="p-2 border-b border-slate-800 bg-[#27272a] flex items-center gap-1">
                    <button
                        onClick={() => setRightTab('inspector')}
                        className={`flex-1 py-1 text-[10px] font-bold uppercase rounded transition-all ${rightTab === 'inspector' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        Inspector
                    </button>
                    <button
                        onClick={() => { setRightTab('results'); if (!results) analyze(); }}
                        className={`flex-1 py-1 text-[10px] font-bold uppercase rounded transition-all ${rightTab === 'results' ? 'bg-indigo-700 text-white' : 'text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        📊 Sonuçlar
                    </button>
                </div>

                {rightTab === 'results' && (
                    <div className="flex-1 overflow-hidden">
                        <FrameResults results={results} structure={structure} />
                    </div>
                )}

                <div className={`flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar ${rightTab === 'results' ? 'hidden' : ''}`}>
                    {selectedNode ? (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Coordinates</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <InputBox label="X" value={selectedNode.x.toFixed(3)} />
                                    <InputBox label="Y" value={selectedNode.y.toFixed(3)} />
                                    <InputBox label="Z" value="0.000" disabled />
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-2">
                                <Label>Restraints (Supports)</Label>
                                <div className="grid grid-cols-3 gap-1">
                                    <SupportButton
                                        active={selectedNode.restraints.dx && selectedNode.restraints.dy && selectedNode.restraints.rz}
                                        label="Fixed"
                                        onClick={() => updateNode(selectedNode.id, { restraints: { dx: true, dy: true, rz: true } })}
                                    />
                                    <SupportButton
                                        active={selectedNode.restraints.dx && selectedNode.restraints.dy && !selectedNode.restraints.rz}
                                        label="Pinned"
                                        onClick={() => updateNode(selectedNode.id, { restraints: { dx: true, dy: true, rz: false } })}
                                    />
                                    <SupportButton
                                        active={!selectedNode.restraints.dx && selectedNode.restraints.dy && !selectedNode.restraints.rz}
                                        label="Roller"
                                        onClick={() => updateNode(selectedNode.id, { restraints: { dx: false, dy: true, rz: false } })}
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-1 mt-1">
                                    <SupportButton
                                        active={!selectedNode.restraints.dx && !selectedNode.restraints.dy && !selectedNode.restraints.rz}
                                        label="Free"
                                        onClick={() => updateNode(selectedNode.id, { restraints: { dx: false, dy: false, rz: false } })}
                                    />
                                </div>
                            </div>

                            <Separator />

                            {/* Elastic Spring Support */}
                            <div className="space-y-2">
                                <Label>Elastik Yay Mesnet (kN/m)</Label>
                                <div className="grid grid-cols-3 gap-1">
                                    <div className="bg-slate-900 border border-slate-800 rounded p-1.5">
                                        <div className="text-[9px] text-purple-400 font-bold mb-1">kx</div>
                                        <input
                                            type="number"
                                            step={100}
                                            value={selectedNode.elasticSupport?.kx ?? 0}
                                            onChange={e => updateNode(selectedNode.id, {
                                                elasticSupport: { ...selectedNode.elasticSupport, kx: Number(e.target.value) }
                                            })}
                                            className="w-full bg-transparent border-0 text-[10px] text-purple-200 font-mono text-right focus:outline-none"
                                        />
                                    </div>
                                    <div className="bg-slate-900 border border-slate-800 rounded p-1.5">
                                        <div className="text-[9px] text-purple-400 font-bold mb-1">ky</div>
                                        <input
                                            type="number"
                                            step={100}
                                            value={selectedNode.elasticSupport?.ky ?? 0}
                                            onChange={e => updateNode(selectedNode.id, {
                                                elasticSupport: { ...selectedNode.elasticSupport, ky: Number(e.target.value) }
                                            })}
                                            className="w-full bg-transparent border-0 text-[10px] text-purple-200 font-mono text-right focus:outline-none"
                                        />
                                    </div>
                                    <div className="bg-slate-900 border border-slate-800 rounded p-1.5">
                                        <div className="text-[9px] text-purple-400 font-bold mb-1">krz</div>
                                        <input
                                            type="number"
                                            step={100}
                                            value={selectedNode.elasticSupport?.krz ?? 0}
                                            onChange={e => updateNode(selectedNode.id, {
                                                elasticSupport: { ...selectedNode.elasticSupport, krz: Number(e.target.value) }
                                            })}
                                            className="w-full bg-transparent border-0 text-[10px] text-purple-200 font-mono text-right focus:outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="text-[9px] text-slate-600 italic">0 = Mesnet yok. Değer gir = Yay eklenir (kN/m veya kNm/rad)</div>
                            </div>

                            <Separator />

                            {/* Settlement */}
                            <div className="space-y-2">
                                <Label>Mesnet Çökmesi</Label>
                                <div className="grid grid-cols-2 gap-1">
                                    <div className="bg-slate-900 border border-amber-900/30 rounded p-1.5">
                                        <div className="text-[9px] text-amber-500 font-bold mb-1">ux (m)</div>
                                        <input
                                            type="number"
                                            step={0.001}
                                            value={selectedNode.prescribedDx ?? 0}
                                            onChange={e => updateNode(selectedNode.id, { prescribedDx: Number(e.target.value) })}
                                            className="w-full bg-transparent border-0 text-[10px] text-amber-200 font-mono text-right focus:outline-none"
                                        />
                                    </div>
                                    <div className="bg-slate-900 border border-amber-900/30 rounded p-1.5">
                                        <div className="text-[9px] text-amber-500 font-bold mb-1">uy (m) ↓</div>
                                        <input
                                            type="number"
                                            step={0.001}
                                            value={selectedNode.prescribedDy ?? 0}
                                            onChange={e => updateNode(selectedNode.id, { prescribedDy: Number(e.target.value) })}
                                            className="w-full bg-transparent border-0 text-[10px] text-amber-200 font-mono text-right focus:outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="text-[9px] text-slate-600 italic">Sabitlenmiş DOF'lara uygulanır. Aşağı = pozitif.</div>
                            </div>

                            <Separator />

                            <div className="space-y-2">
                                <Label>Loads (Nodal)</Label>
                                <div className="grid grid-cols-3 gap-1 mb-2">
                                    <InputBox
                                        label="Fx"
                                        value={structure.loads.find(l => l.targetId === selectedNode.id && l.fx)?.fx || 0}
                                        onChange={(val: string) => updateNodeLoad(selectedNode.id, 'fx', parseFloat(val))}
                                    />
                                    <InputBox
                                        label="Fy"
                                        value={structure.loads.find(l => l.targetId === selectedNode.id && l.fy)?.fy || 0}
                                        onChange={(val: string) => updateNodeLoad(selectedNode.id, 'fy', parseFloat(val))}
                                    />
                                    <InputBox
                                        label="Mz"
                                        value={structure.loads.find(l => l.targetId === selectedNode.id && l.mz)?.mz || 0}
                                        onChange={(val: string) => updateNodeLoad(selectedNode.id, 'mz', parseFloat(val))}
                                    />
                                </div>
                            </div>

                            <Button
                                variant="secondary"
                                size="xs"
                                className="w-full text-red-400 hover:text-red-300 border-red-900/30 hover:bg-red-900/10 mt-4"
                                icon={<Trash2 size={12} />}
                                onClick={() => {
                                    setStructure(prev => ({
                                        ...prev,
                                        nodes: prev.nodes.filter(n => n.id !== selectedNode.id),
                                        members: prev.members.filter(m => m.startNodeId !== selectedNode.id && m.endNodeId !== selectedNode.id)
                                    }));
                                    setSelectedId(null);
                                }}
                            >
                                Delete Node
                            </Button>
                        </div>
                    ) : selectedMember ? (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Connectivity</Label>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="bg-slate-900 p-2 rounded border border-slate-800">Start: <span className="text-white">{selectedMember.startNodeId}</span></div>
                                    <div className="bg-slate-900 p-2 rounded border border-slate-800">End: <span className="text-white">{selectedMember.endNodeId}</span></div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Assignments</Label>
                                <div className="space-y-2">
                                    <PropertyRow label="Section" value="IPE 300" />
                                    <PropertyRow label="Material" value="S235" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Releases (Hinges)</Label>
                                <div className="flex gap-2">
                                    <Toggle label="Start M33" checked={selectedMember.releases?.startMoment || false} />
                                    <Toggle label="End M33" checked={selectedMember.releases?.endMoment || false} />
                                </div>
                            </div>

                            <Separator />

                            {/* Distributed Load */}
                            <div className="space-y-2">
                                <Label>Yayılı Yük (w)</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <InputBox
                                        label="w (kN/m) ↓"
                                        value={structure.loads.find(l => l.type === 'member_distributed' && l.targetId === selectedMember.id)?.wStart || 0}
                                        onChange={(val: string) => {
                                            const v = parseFloat(val);
                                            const existing = structure.loads.find(l => l.type === 'member_distributed' && l.targetId === selectedMember.id);
                                            if (existing) {
                                                updateLoad(existing.id, { wStart: v, wEnd: v });
                                            } else if (v !== 0) {
                                                addLoad({ type: 'member_distributed', targetId: selectedMember.id, wStart: v, wEnd: v });
                                            }
                                        }}
                                    />
                                    <div className="flex items-center text-[9px] text-slate-500 italic pb-1">
                                        Perpendicular gravity load
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Point Load */}
                            <div className="space-y-2">
                                <Label>Tekil Yük (P)</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <InputBox
                                        label="P (kN) ↓"
                                        value={structure.loads.find(l => l.type === 'member_point' && l.targetId === selectedMember.id)?.P || 0}
                                        onChange={(val: string) => {
                                            const v = parseFloat(val);
                                            const existing = structure.loads.find(l => l.type === 'member_point' && l.targetId === selectedMember.id);
                                            if (existing) {
                                                updateLoad(existing.id, { P: v });
                                            } else if (v !== 0) {
                                                addLoad({ type: 'member_point', targetId: selectedMember.id, P: v, L: 0 }); // Default L=0 if newly created
                                            }
                                        }}
                                    />
                                    <InputBox
                                        label="Konum L (m)"
                                        value={structure.loads.find(l => l.type === 'member_point' && l.targetId === selectedMember.id)?.L || 0}
                                        onChange={(val: string) => {
                                            const existing = structure.loads.find(l => l.type === 'member_point' && l.targetId === selectedMember.id);
                                            if (existing) {
                                                updateLoad(existing.id, { L: parseFloat(val) });
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            <Separator />

                            {/* Temperature Load */}
                            {(() => {
                                const tempLoad = structure.loads.find(l => l.type === 'temperature' && l.targetId === selectedMember.id);
                                const hasTempLoad = !!tempLoad;
                                const updateTempLoad = (patch: Record<string, number>) => {
                                    setStructure(prev => {
                                        const existingIdx = prev.loads.findIndex(l => l.type === 'temperature' && l.targetId === selectedMember.id);
                                        const newLoad = {
                                            id: tempLoad?.id ?? `t${Date.now()}`,
                                            type: 'temperature' as const,
                                            targetId: selectedMember.id,
                                            deltaT: tempLoad?.deltaT ?? 0,
                                            gradient: tempLoad?.gradient ?? 0,
                                            alpha: tempLoad?.alpha ?? 1.2e-5,
                                            depth: tempLoad?.depth ?? 0.3,
                                            ...patch
                                        };
                                        const newLoads = existingIdx >= 0
                                            ? prev.loads.map((l, i) => i === existingIdx ? newLoad : l)
                                            : [...prev.loads, newLoad];
                                        return { ...prev, loads: newLoads };
                                    });
                                };
                                const removeTempLoad = () => {
                                    setStructure(prev => ({
                                        ...prev,
                                        loads: prev.loads.filter(l => !(l.type === 'temperature' && l.targetId === selectedMember.id))
                                    }));
                                };
                                return (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label>Sıcaklık Yükü</Label>
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                <input type="checkbox" checked={hasTempLoad}
                                                    onChange={e => e.target.checked ? updateTempLoad({}) : removeTempLoad()}
                                                    className="rounded bg-slate-800 border-slate-600 text-orange-500 focus:ring-orange-500" />
                                                <span className="text-[10px] text-slate-400">Aktif</span>
                                            </label>
                                        </div>
                                        {hasTempLoad && (
                                            <div className="grid grid-cols-2 gap-1">
                                                <div className="bg-slate-900 border border-orange-900/30 rounded p-1.5">
                                                    <div className="text-[9px] text-orange-400 font-bold mb-1">ΔT (°C)</div>
                                                    <input type="number" step={5} value={tempLoad?.deltaT ?? 0}
                                                        onChange={e => updateTempLoad({ deltaT: Number(e.target.value) })}
                                                        className="w-full bg-transparent border-0 text-[10px] text-orange-200 font-mono text-right focus:outline-none" />
                                                </div>
                                                <div className="bg-slate-900 border border-orange-900/30 rounded p-1.5">
                                                    <div className="text-[9px] text-orange-400 font-bold mb-1">α (1/°C)</div>
                                                    <input type="number" step={1e-6} value={tempLoad?.alpha ?? 1.2e-5}
                                                        onChange={e => updateTempLoad({ alpha: Number(e.target.value) })}
                                                        className="w-full bg-transparent border-0 text-[10px] text-orange-200 font-mono text-right focus:outline-none" />
                                                </div>
                                                <div className="bg-slate-900 border border-orange-900/30 rounded p-1.5">
                                                    <div className="text-[9px] text-orange-400 font-bold mb-1">Grad (°C/m)</div>
                                                    <input type="number" step={1} value={tempLoad?.gradient ?? 0}
                                                        onChange={e => updateTempLoad({ gradient: Number(e.target.value) })}
                                                        className="w-full bg-transparent border-0 text-[10px] text-orange-200 font-mono text-right focus:outline-none" />
                                                </div>
                                                <div className="bg-slate-900 border border-orange-900/30 rounded p-1.5">
                                                    <div className="text-[9px] text-orange-400 font-bold mb-1">h (m)</div>
                                                    <input type="number" step={0.05} value={tempLoad?.depth ?? 0.3}
                                                        onChange={e => updateTempLoad({ depth: Number(e.target.value) })}
                                                        className="w-full bg-transparent border-0 text-[10px] text-orange-200 font-mono text-right focus:outline-none" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            <Button
                                variant="secondary"
                                size="xs"
                                className="w-full text-red-400 hover:text-red-300 border-red-900/30 hover:bg-red-900/10 mt-4"
                                icon={<Trash2 size={12} />}
                                onClick={() => {
                                    setStructure(prev => ({
                                        ...prev,
                                        members: prev.members.filter(m => m.id !== selectedMember.id)
                                    }));
                                    setSelectedId(null);
                                }}
                            >
                                Delete Member
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-600 gap-2">
                            <MousePointer2 size={24} opacity={0.2} />
                            <span className="text-xs">Select an element to view properties</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// UI Components for Inspector
const Label = ({ children }: { children: React.ReactNode }) => (
    <div className="text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-1">{children}</div>
);

const Separator = () => <div className="h-px bg-slate-800 my-2" />;

const InputBox = ({ label, value, disabled }: any) => (
    <div className="bg-slate-900 px-2 py-1.5 rounded border border-slate-800 flex items-center justify-between">
        <span className="text-slate-500 text-[10px] mr-2">{label}</span>
        <span className={`text-xs font-mono ${disabled ? 'text-slate-600' : 'text-slate-300'}`}>{value}</span>
    </div>
);

const PropertyRow = ({ label, value }: any) => (
    <div className="flex items-center justify-between text-xs bg-slate-900/50 p-2 rounded border border-slate-800/50 hover:border-slate-700 cursor-pointer">
        <span className="text-slate-400">{label}</span>
        <span className="text-blue-400 font-medium">{value}</span>
    </div>
);

const Toggle = ({ label, checked }: any) => (
    <div className={`flex-1 px-2 py-1.5 rounded border text-xs cursor-pointer flex items-center justify-center transition-all ${checked ? 'bg-blue-900/30 border-blue-500/50 text-blue-300' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'}`}>
        {label}
    </div>
);

const SupportButton = ({ active, label, onClick }: any) => (
    <button
        onClick={onClick}
        className={`px-1 py-1.5 rounded text-[10px] font-bold uppercase transition-all border ${active ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`}
    >
        {label}
    </button>
);

const DiagramButton = ({ label, active, onClick }: any) => (
    <button
        onClick={onClick}
        className={`w-8 h-8 flex items-center justify-center rounded text-[10px] font-bold transition-all ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 ring-1 ring-indigo-400' : 'bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-slate-300'}`}
    >
        {label}
    </button>
);

const ToolButton = ({ icon, active, onClick, label }: any) => (
    <button
        onClick={onClick}
        title={label}
        className={`w-8 h-8 flex items-center justify-center rounded transition-all ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 ring-1 ring-blue-400' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}
    >
        {icon}
    </button>
);
