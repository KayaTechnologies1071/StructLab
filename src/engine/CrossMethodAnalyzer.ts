/**
 * CrossMethodAnalyzer — Hardy Cross Moment Dağıtım Yöntemi
 * 
 * Adımlar:
 * 1. Mesnetlere yakın elemanların dağıtım faktörlerini hesapla (Dağıtım Faktörü = K / ΣK)
 * 2. Dünye mesnetli kiriş uçlarında Sabit Uç Momentlerini (FEM) hesapla
 * 3. Her düğümde moment dengesizliğini dağıt (Balance)
 * 4. Aktarım faktörü (0.5) ile komşu uca aktar (CarryOver)
 * 5. Yakınsayana kadar tekrar et
 */

export interface CrossNode {
    id: string;
    isFixed: boolean; // True = ankastre (sonsuz rijitlik, DF = 0)
    isPinned: boolean; // True = mafsallı (DF = 1 for far end, carry-over = 0)
}

export interface CrossMember {
    id: string;
    startNodeId: string;
    endNodeId: string;
    EI: number;      // kN·m²
    length: number;  // m
    /** Relative stiffness K = EI/L (or 3EI/4L for far-end pinned) */
}

export interface CrossLoad {
    memberId: string;
    type: 'point' | 'udl';
    magnitude: number; // kN or kN/m
    position?: number; // distance from start for point load (m)
}

export interface CrossIteration {
    iterationNumber: number;
    nodeId: string;
    unbalancedMoment: number;  // kNm — before distribution
    distributed: Record<string, number>; // memberId → distributed moment
    carryOver: Record<string, number>;   // memberId → carry-over moment to far end
}

export interface CrossResult {
    /** Final end moments for each member [start, end] in kNm */
    endMoments: Record<string, { start: number; end: number }>;
    iterations: CrossIteration[];
    /** Number of iterations until convergence */
    convergedAt: number;
}

export class CrossMethodAnalyzer {

    static analyze(
        nodes: CrossNode[],
        members: CrossMember[],
        loads: CrossLoad[],
        maxIterations = 50,
        tolerance = 0.001
    ): CrossResult {
        const nodeMap = new Map<string, CrossNode>(nodes.map(n => [n.id, n]));

        // --- Step 1: Stiffness and Distribution Factors ---
        // K_ij: stiffness of member from node i to node j
        // If far end j is PINNED: K = 3EI/4L (modified stiffness, carry-over = 0)
        // If far end j is FIXED (or intermediate): K = EI/L, carry-over = 0.5
        const memberStiffness = new Map<string, { K_start: number; K_end: number; co_start: number; co_end: number }>();
        for (const m of members) {
            const startNode = nodeMap.get(m.startNodeId)!;
            const endNode = nodeMap.get(m.endNodeId)!;
            const baseK = m.EI / m.length;
            // Far-end modifications
            const K_start = endNode.isPinned ? 0.75 * baseK : baseK;
            const K_end = startNode.isPinned ? 0.75 * baseK : baseK;
            const co_start = endNode.isPinned ? 0 : 0.5;
            const co_end = startNode.isPinned ? 0 : 0.5;
            memberStiffness.set(m.id, { K_start, K_end, co_start, co_end });
        }

        // Distribution factors for each member end at each node
        // DF_{ij} = K_{ij} / sum_k(K_{ik})  (for non-fixed nodes)
        const DF = new Map<string, number>(); // key: `${nodeId}:${memberId}`
        for (const node of nodes) {
            if (node.isFixed) continue; // no distribution at fixed nodes
            const connectedMembers = members.filter(m => m.startNodeId === node.id || m.endNodeId === node.id);
            const totalK = connectedMembers.reduce((sum, m) => {
                const stiff = memberStiffness.get(m.id)!;
                return sum + (m.startNodeId === node.id ? stiff.K_start : stiff.K_end);
            }, 0);
            for (const m of connectedMembers) {
                const stiff = memberStiffness.get(m.id)!;
                const K = m.startNodeId === node.id ? stiff.K_start : stiff.K_end;
                DF.set(`${node.id}:${m.id}`, totalK > 0 ? K / totalK : 0);
            }
        }

        // --- Step 2: Fixed-End Moments (FEM) ---
        // Sign convention: clockwise = positive
        const FEM = new Map<string, { start: number; end: number }>(); // memberId → {start, end}
        for (const m of members) {
            FEM.set(m.id, { start: 0, end: 0 });
        }
        for (const load of loads) {
            const m = members.find(mb => mb.id === load.memberId);
            if (!m) continue;
            const fem = FEM.get(m.id)!;
            const L = m.length;

            if (load.type === 'udl') {
                const w = load.magnitude;
                // FEM for fixed-fixed: +wL²/12 at start (near), -wL²/12 at end (far)
                fem.start += w * L * L / 12;
                fem.end -= w * L * L / 12;
            } else if (load.type === 'point' && load.position !== undefined) {
                const P = load.magnitude;
                const a = load.position;
                const b = L - a;
                fem.start += P * a * b * b / (L * L);
                fem.end -= P * a * a * b / (L * L);
            }
        }

        // --- Step 3: Moment Distribution Loop ---
        // Accumulated moments at each member end
        const moments = new Map<string, { start: number; end: number }>(
            members.map(m => {
                const fem = FEM.get(m.id)!;
                return [m.id, { start: fem.start, end: fem.end }];
            })
        );

        const iterations: CrossIteration[] = [];
        let convergedAt = 0;

        for (let iter = 0; iter < maxIterations; iter++) {
            let maxUnbalance = 0;

            for (const node of nodes) {
                if (node.isFixed) continue;

                // Unbalanced moment at this node = sum of all member-end moments at this node
                const connectedMembers = members.filter(m => m.startNodeId === node.id || m.endNodeId === node.id);
                const unbalanced = connectedMembers.reduce((sum, m) => {
                    const mo = moments.get(m.id)!;
                    return sum + (m.startNodeId === node.id ? mo.start : mo.end);
                }, 0);

                if (Math.abs(unbalanced) < 1e-8) continue;
                maxUnbalance = Math.max(maxUnbalance, Math.abs(unbalanced));

                const distributed: Record<string, number> = {};
                const carryOver: Record<string, number> = {};

                // Distribute the negative unbalanced moment
                for (const m of connectedMembers) {
                    const df = DF.get(`${node.id}:${m.id}`) ?? 0;
                    const distrib = -unbalanced * df;
                    distributed[m.id] = distrib;

                    const mo = moments.get(m.id)!;
                    if (m.startNodeId === node.id) {
                        mo.start += distrib;
                        // Carry over to far end
                        const co = memberStiffness.get(m.id)!.co_start;
                        const coMoment = distrib * co;
                        mo.end += coMoment;
                        carryOver[m.id] = coMoment;
                    } else {
                        mo.end += distrib;
                        const co = memberStiffness.get(m.id)!.co_end;
                        const coMoment = distrib * co;
                        mo.start += coMoment;
                        carryOver[m.id] = coMoment;
                    }
                }

                iterations.push({
                    iterationNumber: iter + 1,
                    nodeId: node.id,
                    unbalancedMoment: unbalanced,
                    distributed,
                    carryOver
                });
            }

            if (maxUnbalance < tolerance) {
                convergedAt = iter + 1;
                break;
            }
        }

        if (convergedAt === 0) convergedAt = maxIterations;

        // Build result
        const endMoments: CrossResult['endMoments'] = {};
        for (const m of members) {
            endMoments[m.id] = { ...moments.get(m.id)! };
        }

        return { endMoments, iterations, convergedAt };
    }
}
