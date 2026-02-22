import React from 'react';
import { Card } from '../../components/ui/Card';
import { Slider } from '../../components/ui/Slider';
import { Button } from '../../components/ui/Button';
import type { Beam, SupportType } from './types';
import { Plus, Trash2 } from 'lucide-react';

interface BeamEditorProps {
    beam: Beam;
    onChange: (beam: Beam) => void;
}

export const BeamEditor: React.FC<BeamEditorProps> = ({ beam, onChange }) => {

    const updateLength = (len: number) => {
        // Constraint: loads/supports must be within new length
        onChange({ ...beam, length: len });
    };

    const updateSupport = (id: string, updates: Partial<{ type: SupportType, position: number, settlement: number }>) => {
        const newSupports = beam.supports.map(s => s.id === id ? { ...s, ...updates } : s);
        onChange({ ...beam, supports: newSupports });
    };

    const updateLoad = (id: string, mag: number) => {
        const newLoads = beam.loads.map(l => l.id === id ? { ...l, magnitude: mag } : l);
        onChange({ ...beam, loads: newLoads });
    };

    const updateLoadPos = (id: string, pos: number) => {
        const newLoads = beam.loads.map(l => l.id === id ? { ...l, position: pos } : l);
        onChange({ ...beam, loads: newLoads });
    };

    return (
        <div className="space-y-4">
            <Card title="Geometry">
                <Slider
                    label="Beam Length"
                    value={beam.length}
                    min={1}
                    max={50}
                    unit="m"
                    onChange={(e) => updateLength(Number(e.target.value))}
                />
                <div className="mt-2 text-[10px] text-slate-500">
                    Elastic Modulus (E): {beam.elasticModulus} GPa
                    <br />
                    Inertia (I): {beam.momentOfInertia} cm⁴
                </div>
            </Card>

            <Card title="Supports" action={
                <Button
                    size="sm"
                    variant="ghost"
                    icon={<Plus size={12} />}
                    onClick={() => {
                        const newSupport = {
                            id: `S${Math.floor(Math.random() * 10000)}`,
                            type: 'pinned',
                            position: beam.length
                        } as const;
                        onChange({ ...beam, supports: [...beam.supports, newSupport] });
                    }}
                />
            }>
                {beam.supports.map((s, index) => (
                    <div key={s.id} className="mb-3 border-b border-slate-700/30 pb-3 last:border-0 last:pb-0">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-semibold text-blue-300">Support {index + 1} ({s.type})</span>
                            <div className="flex items-center gap-2">
                                <select
                                    value={s.type}
                                    onChange={(e) => updateSupport(s.id, { type: e.target.value as SupportType })}
                                    className="bg-slate-800 text-xs border border-slate-700 rounded px-1 py-0.5 text-slate-300"
                                >
                                    <option value="pinned">Pinned</option>
                                    <option value="roller">Roller</option>
                                    <option value="fixed">Fixed</option>
                                </select>
                                <button
                                    className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => {
                                        const newSupports = beam.supports.filter(sup => sup.id !== s.id);
                                        onChange({ ...beam, supports: newSupports });
                                    }}
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        </div>
                        <Slider
                            label="Position"
                            value={s.position}
                            min={0}
                            max={beam.length}
                            unit="m"
                            step={0.1}
                            onChange={(e) => updateSupport(s.id, { position: Number(e.target.value) })}
                        />
                        {/* Settlement Input */}
                        <div className="mt-2 flex items-center gap-2">
                            <label className="text-[10px] uppercase tracking-wider text-amber-500 font-bold w-20 shrink-0">
                                Settlement
                            </label>
                            <input
                                type="number"
                                step={0.001}
                                value={s.settlement ?? 0}
                                onChange={(e) => updateSupport(s.id, { settlement: Number(e.target.value) })}
                                className="w-20 bg-slate-800 border border-amber-700/40 rounded px-1 py-0.5 text-xs text-right text-amber-200 focus:outline-none focus:border-amber-500"
                            />
                            <span className="text-[10px] text-slate-500">m ↓</span>
                        </div>
                    </div>
                ))}
            </Card>

            <Card title="Hinges (Gerber)" action={
                <Button
                    size="sm"
                    variant="ghost"
                    icon={<Plus size={12} />}
                    onClick={() => {
                        const newHinge = {
                            id: `h${Math.floor(Math.random() * 10000)}`,
                            position: beam.length / 2
                        };
                        onChange({ ...beam, hinges: [...(beam.hinges || []), newHinge] });
                    }}
                />
            }>
                {(beam.hinges || []).map((h, index) => (
                    <div key={h.id} className="mb-3 border-b border-slate-700/30 pb-3 last:border-0 last:pb-0">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-semibold text-purple-300">Hinge {index + 1}</span>
                            <button
                                className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => {
                                    const newHinges = beam.hinges.filter(hinge => hinge.id !== h.id);
                                    onChange({ ...beam, hinges: newHinges });
                                }}
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                        <Slider
                            label="Position"
                            value={h.position}
                            min={0}
                            max={beam.length}
                            unit="m"
                            step={0.1}
                            onChange={(e) => {
                                const val = Number(e.target.value);
                                const newHinges = beam.hinges.map(hinge => hinge.id === h.id ? { ...hinge, position: val } : hinge);
                                onChange({ ...beam, hinges: newHinges });
                            }}
                        />
                    </div>
                ))}
            </Card>

            {/* Temperature Load Card */}
            <Card title="Temperature Load">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                        <input
                            type="checkbox"
                            checked={!!beam.temperatureLoad}
                            onChange={(e) => {
                                if (e.target.checked) {
                                    onChange({ ...beam, temperatureLoad: { deltaT: 20, alpha: 1.2e-5, gradient: 0, depth: 0.3 } });
                                } else {
                                    const { temperatureLoad: _, ...rest } = beam;
                                    onChange(rest as typeof beam);
                                }
                            }}
                            className="rounded bg-slate-800 border-slate-600 text-orange-500"
                        />
                        <span className="text-xs text-slate-400">Enable temperature loading</span>
                    </div>
                    {beam.temperatureLoad && (
                        <div className="space-y-2 pl-1">
                            <div className="flex items-center gap-2">
                                <label className="text-[10px] uppercase text-orange-400 font-bold w-16 shrink-0">ΔT (°C)</label>
                                <input type="number" value={beam.temperatureLoad.deltaT}
                                    onChange={(e) => onChange({ ...beam, temperatureLoad: { ...beam.temperatureLoad!, deltaT: Number(e.target.value) } })}
                                    className="w-20 bg-slate-800 border border-orange-700/40 rounded px-1 py-0.5 text-xs text-right text-orange-200 focus:outline-none focus:border-orange-500"
                                />
                                <span className="text-[10px] text-slate-500">°C</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-[10px] uppercase text-orange-400 font-bold w-16 shrink-0">α (1/°C)</label>
                                <input type="number" step={1e-6} value={beam.temperatureLoad.alpha}
                                    onChange={(e) => onChange({ ...beam, temperatureLoad: { ...beam.temperatureLoad!, alpha: Number(e.target.value) } })}
                                    className="w-24 bg-slate-800 border border-orange-700/40 rounded px-1 py-0.5 text-xs text-right text-orange-200 focus:outline-none focus:border-orange-500"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-[10px] uppercase text-orange-400 font-bold w-16 shrink-0">Grad (°C/m)</label>
                                <input type="number" step={0.1} value={beam.temperatureLoad.gradient ?? 0}
                                    onChange={(e) => onChange({ ...beam, temperatureLoad: { ...beam.temperatureLoad!, gradient: Number(e.target.value) } })}
                                    className="w-20 bg-slate-800 border border-orange-700/40 rounded px-1 py-0.5 text-xs text-right text-orange-200 focus:outline-none focus:border-orange-500"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-[10px] uppercase text-orange-400 font-bold w-16 shrink-0">Depth (m)</label>
                                <input type="number" step={0.01} value={beam.temperatureLoad.depth ?? 0.3}
                                    onChange={(e) => onChange({ ...beam, temperatureLoad: { ...beam.temperatureLoad!, depth: Number(e.target.value) } })}
                                    className="w-20 bg-slate-800 border border-orange-700/40 rounded px-1 py-0.5 text-xs text-right text-orange-200 focus:outline-none focus:border-orange-500"
                                />
                            </div>
                            <p className="text-[9px] text-slate-500 italic">ΔT: uniform warming. Gradient: sıcaklık farkı kesit boyunca (°C/m) → eğilme etkisi.</p>
                        </div>
                    )}
                </div>
            </Card>

            <Card title="Loads" action={
                <Button
                    size="sm"
                    variant="ghost"
                    icon={<Plus size={12} />}
                    onClick={() => {
                        const newLoad = {
                            id: `l${beam.loads.length + 1}`,
                            type: 'point',
                            magnitude: 10,
                            position: beam.length / 2,
                            angle: 90
                        } as const;
                        onChange({ ...beam, loads: [...beam.loads, newLoad] });
                    }}
                />
            }>
                {beam.loads.map((l, idx) => (
                    <div key={l.id} className="mb-3 border-b border-slate-700/30 pb-3 last:border-0 last:pb-0 relative group">
                        <div className="flex justify-between items-center mb-1">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-red-300">Load {idx + 1}</span>
                                <select
                                    value={l.type}
                                    onChange={(e) => {
                                        const newType = e.target.value as any;
                                        const newLoads = beam.loads.map(load => {
                                            if (load.id === l.id) {
                                                if (newType === 'distributed') {
                                                    return { ...load, type: newType, startPosition: load.position, endPosition: Math.min(load.position + 2, beam.length) };
                                                }
                                                return { ...load, type: newType };
                                            }
                                            return load;
                                        });
                                        onChange({ ...beam, loads: newLoads });
                                    }}
                                    className="bg-slate-800 text-[10px] border border-slate-700 rounded px-1 py-0.5 text-slate-300"
                                >
                                    <option value="point">Point</option>
                                    <option value="distributed">Dist</option>
                                    <option value="moment">Moment</option>
                                </select>
                            </div>
                            <button
                                className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => {
                                    const newLoads = beam.loads.filter(load => load.id !== l.id);
                                    onChange({ ...beam, loads: newLoads });
                                }}
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                        <div className="mb-2">
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Magnitude</label>
                                <span className="text-xs text-slate-300 font-mono">
                                    {l.magnitude} {l.type === 'distributed' ? 'kN/m' : 'kN'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="range"
                                    min={0}
                                    max={100} // Slider range for convenience
                                    step={1}
                                    value={Math.min(l.magnitude, 100)}
                                    onChange={(e) => updateLoad(l.id, Number(e.target.value))}
                                    className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                />
                                <input
                                    type="number"
                                    value={l.magnitude}
                                    onChange={(e) => updateLoad(l.id, Number(e.target.value))}
                                    className="w-16 bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-xs text-right text-white focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>

                        {l.type === 'distributed' && (
                            <div className="mb-2">
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">End Magnitude</label>
                                    <span className="text-xs text-slate-300 font-mono">
                                        {l.endMagnitude ?? l.magnitude} kN/m
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        step={1}
                                        value={Math.min(l.endMagnitude ?? l.magnitude, 100)}
                                        onChange={(e) => {
                                            const val = Number(e.target.value);
                                            const newLoads = beam.loads.map(load => load.id === l.id ? { ...load, endMagnitude: val } : load);
                                            onChange({ ...beam, loads: newLoads });
                                        }}
                                        className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    />
                                    <input
                                        type="number"
                                        value={l.endMagnitude ?? l.magnitude}
                                        onChange={(e) => {
                                            const val = Number(e.target.value);
                                            const newLoads = beam.loads.map(load => load.id === l.id ? { ...load, endMagnitude: val } : load);
                                            onChange({ ...beam, loads: newLoads });
                                        }}
                                        className="w-16 bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-xs text-right text-white focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>
                        )}
                        {(l.type === 'point' || l.type === 'moment') && (
                            <>
                                <Slider
                                    label="Position"
                                    value={l.position}
                                    min={0}
                                    max={beam.length}
                                    step={0.1}
                                    unit="m"
                                    className="mt-2"
                                    onChange={(e) => updateLoadPos(l.id, Number(e.target.value))}
                                />
                                {l.type === 'point' && (
                                    <Slider
                                        label="Angle"
                                        value={l.angle ?? 90}
                                        min={0}
                                        max={180}
                                        step={1}
                                        unit="°"
                                        className="mt-2"
                                        onChange={(e) => {
                                            const newLoads = beam.loads.map(load => load.id === l.id ? { ...load, angle: Number(e.target.value) } : load);
                                            onChange({ ...beam, loads: newLoads });
                                        }}
                                    />
                                )}
                            </>
                        )}
                        {l.type === 'distributed' && (
                            <div className="mt-2 grid grid-cols-2 gap-2">
                                <Slider
                                    label="Start"
                                    value={l.startPosition || 0}
                                    min={0}
                                    max={beam.length}
                                    step={0.1}
                                    unit="m"
                                    onChange={(e) => {
                                        const start = Number(e.target.value);
                                        const end = l.endPosition || 0;
                                        const newLoads = beam.loads.map(load => load.id === l.id ? { ...load, startPosition: start, endPosition: Math.max(start, end) } : load);
                                        onChange({ ...beam, loads: newLoads });
                                    }}
                                />
                                <Slider
                                    label="End"
                                    value={l.endPosition || 0}
                                    min={0}
                                    max={beam.length}
                                    step={0.1}
                                    unit="m"
                                    onChange={(e) => {
                                        const end = Number(e.target.value);
                                        const start = l.startPosition || 0;
                                        const newLoads = beam.loads.map(load => load.id === l.id ? { ...load, endPosition: end, startPosition: Math.min(start, end) } : load);
                                        onChange({ ...beam, loads: newLoads });
                                    }}
                                />
                            </div>
                        )}
                    </div>
                ))}
            </Card>
        </div>
    );
};
