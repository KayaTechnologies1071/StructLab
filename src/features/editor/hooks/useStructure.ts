import { useState, useCallback } from 'react';
import type { Structure, Node, Member, AnalysisResult, Load } from '../types';
import { FrameAnalyzer } from '../../../engine/FrameAnalyzer';

const INITIAL_STRUCTURE: Structure = {
    nodes: [],
    members: [],
    materials: [
        { id: 'mat1', name: 'Steel', E: 200, density: 7850 }
    ],
    sections: [
        { id: 'sec1', name: 'IPE 300', A: 53.8, I: 8360 }
    ],
    loads: []
};

export const useStructure = () => {
    const [structure, setStructure] = useState<Structure>(INITIAL_STRUCTURE);
    const [results, setResults] = useState<AnalysisResult | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const addNode = useCallback((x: number, y: number) => {
        const newNode: Node = {
            id: `n${structure.nodes.length + 1}`,
            x,
            y,
            restraints: { dx: false, dy: false, rz: false }
        };
        setStructure(prev => ({ ...prev, nodes: [...prev.nodes, newNode] }));
        return newNode;
    }, [structure.nodes]);

    const addMember = useCallback((startNodeId: string, endNodeId: string) => {
        const newMember: Member = {
            id: `m${structure.members.length + 1}`,
            startNodeId,
            endNodeId,
            materialId: 'mat1',
            sectionId: 'sec1',
            releases: { startMoment: false, endMoment: false }
        };
        setStructure(prev => ({ ...prev, members: [...prev.members, newMember] }));
        return newMember;
    }, [structure.members]);

    const updateNode = useCallback((id: string, updates: Partial<Node>) => {
        setStructure(prev => ({
            ...prev,
            nodes: prev.nodes.map(n => n.id === id ? { ...n, ...updates } : n)
        }));
    }, []);

    const updateMember = useCallback((id: string, updates: Partial<Member>) => {
        setStructure(prev => ({
            ...prev,
            members: prev.members.map(m => m.id === id ? { ...m, ...updates } : m)
        }));
    }, []);

    const analyze = useCallback(() => {
        try {
            const res = FrameAnalyzer.analyze(structure);
            setResults(res);
        } catch (e) {
            console.error("Analysis failed:", e);
        }
    }, [structure]);

    const updateNodeLoad = useCallback((nodeId: string, field: 'fx' | 'fy' | 'mz', value: number) => {
        setStructure(prev => {
            const existingLoadIndex = prev.loads.findIndex(l => l.targetId === nodeId && l.type === 'nodal');
            let newLoads = [...prev.loads];

            if (existingLoadIndex >= 0) {
                newLoads[existingLoadIndex] = { ...newLoads[existingLoadIndex], [field]: value };
            } else {
                newLoads.push({
                    id: `l${Date.now()}`,
                    type: 'nodal',
                    targetId: nodeId,
                    fx: field === 'fx' ? value : 0,
                    fy: field === 'fy' ? value : 0,
                    mz: field === 'mz' ? value : 0
                });
            }
            return { ...prev, loads: newLoads };
        });
    }, []);

    const updateLoad = useCallback((loadId: string, updates: Partial<Load>) => {
        setStructure(prev => ({
            ...prev,
            loads: prev.loads.map(l => l.id === loadId ? { ...l, ...updates } : l)
        }));
    }, []);

    const addLoad = useCallback((load: Omit<Load, 'id'>) => {
        setStructure(prev => ({
            ...prev,
            loads: [...prev.loads, { ...load, id: `l${Date.now()}` } as Load]
        }));
    }, []);

    const removeLoad = useCallback((loadId: string) => {
        setStructure(prev => ({
            ...prev,
            loads: prev.loads.filter(l => l.id !== loadId)
        }));
    }, []);

    const clearResults = useCallback(() => setResults(null), []);

    return {
        structure,
        results,
        selectedId,
        setSelectedId,
        addNode,
        addMember,
        updateNode,
        updateMember,
        updateNodeLoad,
        updateLoad,
        addLoad,
        removeLoad,
        analyze,
        clearResults,
        setStructure
    };
};
