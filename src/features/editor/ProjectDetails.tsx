import React from 'react';
import type { Beam, AnalysisResult } from '../beam/types';
import type { Truss, TrussAnalysisResult } from '../truss/types';
import { Layers, Activity, Maximize2, GitCommit, Link, Crosshair } from 'lucide-react';

interface ProjectDetailsProps {
    activeModule: 'beam' | 'truss';
    beam: Beam;
    truss: Truss;
    beamResults?: AnalysisResult | null;
    trussResults?: TrussAnalysisResult | null;
}

export const ProjectDetails: React.FC<ProjectDetailsProps> = ({ activeModule, beam, truss, beamResults, trussResults }) => {

    if (activeModule === 'beam') {
        const supportCount = beam.supports.length;
        const loadCount = beam.loads.length;
        const hingeCount = beam.hinges?.length || 0;
        const totalLength = beam.length;

        let maxM = 0;
        let maxV = 0;
        let maxD = 0;

        if (beamResults && beamResults.diagrams) {
            maxM = Math.max(...beamResults.diagrams.map(p => Math.abs(p.moment)));
            maxV = Math.max(...beamResults.diagrams.map(p => Math.abs(p.shear)));
            maxD = Math.max(...beamResults.diagrams.map(p => Math.abs(p.deflection))) * 1000;
        }

        return (
            <div className="space-y-4 animate-in fade-in duration-300">
                <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2 border-b border-slate-800 pb-2">
                    <Activity size={16} className="text-blue-500" />
                    Sürekli Kiriş (Beam) Özellikleri
                </h3>

                <div className="grid grid-cols-2 gap-2">
                    <StatCard icon={<Maximize2 size={14} />} label="Toplam Boy" value={`${totalLength.toFixed(2)} m`} />
                    <StatCard icon={<Layers size={14} />} label="Kesit (I)" value={`${beam.momentOfInertia} cm⁴`} />
                    <StatCard icon={<Link size={14} />} label="Mesnet Sayısı" value={supportCount} />
                    <StatCard icon={<Crosshair size={14} />} label="Yük Sayısı" value={loadCount} />
                    <StatCard icon={<GitCommit size={14} />} label="Mafsal (Hinge)" value={hingeCount} />
                    <StatCard icon={<Layers size={14} />} label="Malzeme (E)" value={`${beam.elasticModulus} GPa`} />
                </div>

                {beamResults && (
                    <div className="mt-6">
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Maksimum Ekstremler (Mutlak)</h3>
                        <div className="space-y-2 bg-slate-900/50 p-3 rounded-lg border border-slate-800/80 mt-2">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 text-xs text-red-400/80">Max Moment:</span>
                                <span className="font-mono text-sm text-red-400 font-bold">{maxM.toFixed(2)} kNm</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 text-xs text-cyan-400/80">Max Kesme:</span>
                                <span className="font-mono text-sm text-cyan-400 font-bold">{maxV.toFixed(2)} kN</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 text-xs text-blue-400/80">Max Çökme:</span>
                                <span className="font-mono text-sm text-blue-400 font-bold">{maxD.toFixed(3)} mm</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Frame (Truss) Module
    const nodesCount = truss.nodes.length;
    const membersCount = truss.members.length;
    const supportsCount = truss.nodes.filter(n => n.support !== 'none').length;
    const loadsCount = truss.loads.length;

    let maxN = 0, maxVFrame = 0, maxMFrame = 0, maxDisp = 0;

    if (trussResults && trussResults.memberResults) {
        Object.values(trussResults.memberResults).forEach(res => {
            if (res.diagrams) {
                const mM = Math.max(...res.diagrams.map(p => Math.abs(p.m)));
                if (mM > maxMFrame) maxMFrame = mM;
                const mV = Math.max(...res.diagrams.map(p => Math.abs(p.v)));
                if (mV > maxVFrame) maxVFrame = mV;
                const mN = Math.max(...res.diagrams.map(p => Math.abs(p.n)));
                if (mN > maxN) maxN = mN;
            }
        });

        if (trussResults.nodeDisplacements) {
            Object.values(trussResults.nodeDisplacements).forEach(d => {
                const disp = Math.sqrt(d.dx * d.dx + d.dy * d.dy) * 1000; // mm
                if (disp > maxDisp) maxDisp = disp;
            });
        }
    }

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2 border-b border-slate-800 pb-2">
                <Activity size={16} className="text-indigo-500" />
                2D Çerçeve (Frame) Özellikleri
            </h3>

            <div className="grid grid-cols-2 gap-2">
                <StatCard icon={<GitCommit size={14} />} label="Düğüm Sayısı" value={nodesCount} />
                <StatCard icon={<Maximize2 size={14} />} label="Çubuk Sayısı" value={membersCount} />
                <StatCard icon={<Link size={14} />} label="Mesnet Sayısı" value={supportsCount} />
                <StatCard icon={<Crosshair size={14} />} label="Sistem Yükleri" value={loadsCount} />
            </div>

            {trussResults && (
                <div className="mt-6">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Maksimum Ekstremler (Mutlak)</h3>
                    <div className="space-y-2 bg-slate-900/50 p-3 rounded-lg border border-slate-800/80 mt-2">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400 text-xs text-blue-400/80">Max Eksenel Kuvvet:</span>
                            <span className="font-mono text-sm text-blue-400 font-bold">{maxN.toFixed(2)} kN</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400 text-xs text-cyan-400/80">Max Kesme:</span>
                            <span className="font-mono text-sm text-cyan-400 font-bold">{maxVFrame.toFixed(2)} kN</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400 text-xs text-red-400/80">Max Moment:</span>
                            <span className="font-mono text-sm text-red-400 font-bold">{maxMFrame.toFixed(2)} kNm</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-slate-800/80 mt-1">
                            <span className="text-slate-400 text-xs text-purple-400/80">Max Deplasman:</span>
                            <span className="font-mono text-sm text-purple-400 font-bold">{maxDisp.toFixed(3)} mm</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const StatCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) => (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-2.5 flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-semibold">
            {icon}
            {label}
        </div>
        <div className="text-sm font-mono font-bold text-slate-200">
            {value}
        </div>
    </div>
);
