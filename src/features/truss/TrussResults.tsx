import React from 'react';
import type { TrussAnalysisResult, Truss } from './types';
import { Card } from '../../components/ui/Card';

interface TrussResultsProps {
    truss: Truss;
    results: TrussAnalysisResult | null;
}

export const TrussResults: React.FC<TrussResultsProps> = ({ results }) => {
    if (!results) {
        return (
            <div className="text-center text-slate-500 py-10">
                Run analysis to see results
            </div>
        );
    }

    return (
        <div className="space-y-4 h-full overflow-y-auto custom-scrollbar">
            <Card title="Member Internal Forces (Max Abs)">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead className="text-slate-400 border-b border-slate-700">
                            <tr>
                                <th className="py-2">Member</th>
                                <th className="py-2 text-right">N (kN)</th>
                                <th className="py-2 text-right">V (kN)</th>
                                <th className="py-2 text-right">M (kNm)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {Object.entries(results.memberResults || {}).map(([id, forces]) => {
                                // For simple summary, show the maximum absolute value between start and end
                                const maxN = Math.abs(forces.start.n) > Math.abs(forces.end.n) ? forces.start.n : forces.end.n;
                                const maxV = Math.abs(forces.start.v) > Math.abs(forces.end.v) ? forces.start.v : forces.end.v;
                                const maxM = Math.abs(forces.start.m) > Math.abs(forces.end.m) ? forces.start.m : forces.end.m;

                                return (
                                    <tr key={id}>
                                        <td className="py-2 font-mono text-slate-300">M{id}</td>
                                        <td className={`py-2 text-right font-mono ${maxN > 0 ? 'text-blue-400' : maxN < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                                            {maxN.toFixed(3)}
                                        </td>
                                        <td className="py-2 text-right font-mono text-amber-200">
                                            {Math.abs(maxV) < 0.001 ? '0.000' : maxV.toFixed(3)}
                                        </td>
                                        <td className="py-2 text-right font-mono text-purple-300">
                                            {Math.abs(maxM) < 0.001 ? '0.000' : maxM.toFixed(3)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Card title="Nodal Displacements">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead className="text-slate-400 border-b border-slate-700">
                            <tr>
                                <th className="py-2">Node</th>
                                <th className="py-2 text-right">dx (mm)</th>
                                <th className="py-2 text-right">dy (mm)</th>
                                <th className="py-2 text-right">rad (°)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {Object.entries(results.nodeDisplacements || {}).map(([id, disp]) => (
                                <tr key={id}>
                                    <td className="py-2 font-mono text-slate-300">N{id}</td>
                                    <td className="py-2 text-right font-mono">{(disp.dx * 1000).toFixed(3)}</td>
                                    <td className="py-2 text-right font-mono">{(disp.dy * 1000).toFixed(3)}</td>
                                    <td className="py-2 text-right font-mono">{((disp.theta * 180) / Math.PI).toFixed(3)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};
