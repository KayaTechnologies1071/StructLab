import type { Truss, TrussAnalysisResult, TrussLoad } from '../features/truss/types';

export class TrussAnalyzer {
    static analyze(truss: Truss): TrussAnalysisResult {
        const nodeCount = truss.nodes.length;
        const dof = nodeCount * 3; // 3 Degrees of Freedom per node (x, y, theta)

        const nodeIndexMap = new Map<string, number>();
        truss.nodes.forEach((n, i) => nodeIndexMap.set(n.id, i));

        const K = Array(dof).fill(0).map(() => Array(dof).fill(0));
        const F = Array(dof).fill(0);

        // Assemble Global K
        truss.members.forEach(member => {
            const startNode = truss.nodes.find(n => n.id === member.startNodeId);
            const endNode = truss.nodes.find(n => n.id === member.endNodeId);
            if (!startNode || !endNode) return;

            const i = nodeIndexMap.get(startNode.id)!;
            const j = nodeIndexMap.get(endNode.id)!;

            const kGlobal = this.getElementStiffnessMatrix(startNode, endNode, member);

            const indices = [
                3 * i, 3 * i + 1, 3 * i + 2,
                3 * j, 3 * j + 1, 3 * j + 2
            ];

            for (let r = 0; r < 6; r++) {
                for (let c = 0; c < 6; c++) {
                    K[indices[r]][indices[c]] += kGlobal[r][c];
                }
            }
        });

        // Assemble Load Vector
        truss.loads.forEach(load => {
            if (load.type === 'nodal' && load.nodeId) {
                const i = nodeIndexMap.get(load.nodeId);
                if (i !== undefined) {
                    if (load.fx) F[3 * i] += load.fx;
                    if (load.fy) F[3 * i + 1] += load.fy;
                    if (load.m) F[3 * i + 2] += load.m;
                }
            } else if ((load.type === 'point' || load.type === 'distributed') && load.memberId) {
                const member = truss.members.find(m => m.id === load.memberId);
                if (!member) return;
                const startNode = truss.nodes.find(n => n.id === member.startNodeId)!;
                const endNode = truss.nodes.find(n => n.id === member.endNodeId)!;

                const eqLoads = this.calculateEquivalentNodalLoads(startNode, endNode, load);

                const i = nodeIndexMap.get(startNode.id)!;
                const j = nodeIndexMap.get(endNode.id)!;
                const indices = [3 * i, 3 * i + 1, 3 * i + 2, 3 * j, 3 * j + 1, 3 * j + 2];

                for (let k = 0; k < 6; k++) {
                    F[indices[k]] += eqLoads[k]; // eqLoads are the equivalent nodal actions
                }
            } else if (load.type === 'temperature' && load.memberId) {
                const member = truss.members.find(m => m.id === load.memberId);
                if (!member) return;
                const startNode = truss.nodes.find(n => n.id === member.startNodeId)!;
                const endNode = truss.nodes.find(n => n.id === member.endNodeId)!;

                const dx = endNode.x - startNode.x;
                const dy = endNode.y - startNode.y;
                const L = Math.sqrt(dx * dx + dy * dy);
                if (L === 0) return;

                const c = dx / L;
                const s = dy / L;

                const E = member.elasticModulus * 1e6; // kN/m2
                const A = member.area * 1e-4; // m2
                const alpha = load.thermalAlpha ?? 0;
                const deltaT = load.deltaT ?? 0;

                // N_T = E * A * alpha * deltaT
                const NT = E * A * alpha * deltaT;

                const i = nodeIndexMap.get(startNode.id)!;
                const j = nodeIndexMap.get(endNode.id)!;

                // Thermal expansion creates internal compression if restrained.
                // Equivalent fixed end forces to prevent expansion:
                // Start: Fx_local = +NT, End: Fx_local = -NT
                // Nodal loads (to apply to structure) = -Fixed End Forces
                // Start Node applied = -NT, End Node applied = +NT (local)

                F[3 * i] -= NT * c;
                F[3 * i + 1] -= NT * s;
                F[3 * j] += NT * c;
                F[3 * j + 1] += NT * s;
            }
        });

        // Store original un-restrained stiffness and loads for reaction calculations
        const Korig = K.map(row => [...row]);
        const Forig = [...F];

        // Apply Boundary Conditions
        const PENALTY = 1e15;
        truss.nodes.forEach((n, i) => {
            const dx_i = 3 * i;
            const dy_i = 3 * i + 1;
            const rz_i = 3 * i + 2;

            if (n.support === 'pinned' || n.support === 'fixed') {
                K[dx_i][dx_i] += PENALTY;
                K[dy_i][dy_i] += PENALTY;
                F[dx_i] = 0;
                F[dy_i] = 0;
            }
            if (n.support === 'roller') {
                K[dy_i][dy_i] += PENALTY;
                F[dy_i] = 0;
            }
            if (n.support === 'fixed') {
                K[rz_i][rz_i] += PENALTY;
                F[rz_i] = 0;
            }
        });

        // Solve K * d = F
        const d = this.solveLinearSystem(K, F);

        const nodeDisplacements: Record<string, { dx: number, dy: number, theta: number }> = {};
        const memberResults: TrussAnalysisResult['memberResults'] = {};
        const reactions: Record<string, { rx: number, ry: number, rm: number }> = {};

        truss.nodes.forEach((n, i) => {
            const dx_i = 3 * i;
            const dy_i = 3 * i + 1;
            const rz_i = 3 * i + 2;

            nodeDisplacements[n.id] = { dx: d[dx_i], dy: d[dy_i], theta: d[rz_i] };

            let rx = 0, ry = 0, rm = 0;
            if (n.support === 'pinned' || n.support === 'fixed') {
                for (let c = 0; c < dof; c++) {
                    rx += Korig[dx_i][c] * d[c];
                    ry += Korig[dy_i][c] * d[c];
                }
                rx -= Forig[dx_i];
                ry -= Forig[dy_i];
            } else if (n.support === 'roller') {
                for (let c = 0; c < dof; c++) ry += Korig[dy_i][c] * d[c];
                ry -= Forig[dy_i];
            }

            if (n.support === 'fixed') {
                for (let c = 0; c < dof; c++) rm += Korig[rz_i][c] * d[c];
                rm -= Forig[rz_i];
            }

            reactions[n.id] = { rx, ry, rm };
        });

        truss.members.forEach(member => {
            const startNode = truss.nodes.find(n => n.id === member.startNodeId)!;
            const endNode = truss.nodes.find(n => n.id === member.endNodeId)!;
            const i = nodeIndexMap.get(startNode.id)!;
            const j = nodeIndexMap.get(endNode.id)!;

            const globalDisp = [
                d[3 * i], d[3 * i + 1], d[3 * i + 2],
                d[3 * j], d[3 * j + 1], d[3 * j + 2]
            ];

            const memberLoads = truss.loads.filter(l => l.memberId === member.id && (l.type === 'point' || l.type === 'distributed' || l.type === 'temperature'));
            const forces = this.calculateMemberForces(startNode, endNode, member, globalDisp, memberLoads);
            memberResults[member.id] = forces;
        });

        return { nodeDisplacements, memberResults, reactions };
    }

    private static getElementStiffnessMatrix(n1: { x: number, y: number }, n2: { x: number, y: number }, member: { area: number, momentOfInertia: number, elasticModulus: number }): number[][] {
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const L = Math.sqrt(dx * dx + dy * dy);
        const c = dx / L;
        const s = dy / L;

        const E = member.elasticModulus * 1e6; // GPa -> kN/m2
        const A = member.area * 1e-4; // cm2 -> m2
        const I = (member.momentOfInertia || 5000) * 1e-8; // cm4 -> m4

        const k1 = (E * A) / L;
        const k2 = (12 * E * I) / (L * L * L);
        const k3 = (6 * E * I) / (L * L);
        const k4 = (4 * E * I) / L;
        const k5 = (2 * E * I) / L;

        const k_local = [
            [k1, 0, 0, -k1, 0, 0],
            [0, k2, k3, 0, -k2, k3],
            [0, k3, k4, 0, -k3, k5],
            [-k1, 0, 0, k1, 0, 0],
            [0, -k2, -k3, 0, k2, -k3],
            [0, k3, k5, 0, -k3, k4]
        ];

        return this.transformMatrix(k_local, c, s);
    }

    private static transformMatrix(kLocal: number[][], c: number, s: number): number[][] {
        const T = [
            [c, s, 0, 0, 0, 0],
            [-s, c, 0, 0, 0, 0],
            [0, 0, 1, 0, 0, 0],
            [0, 0, 0, c, s, 0],
            [0, 0, 0, -s, c, 0],
            [0, 0, 0, 0, 0, 1]
        ];

        const TT = T[0].map((_, colIndex) => T.map(row => row[colIndex]));
        const temp = this.multiplyMatrices(TT, kLocal);
        return this.multiplyMatrices(temp, T);
    }

    private static multiplyMatrices(A: number[][], B: number[][]): number[][] {
        const rA = A.length;
        const cA = A[0].length;
        const cB = B[0].length;
        const C = Array(rA).fill(0).map(() => Array(cB).fill(0));

        for (let i = 0; i < rA; i++) {
            for (let j = 0; j < cB; j++) {
                let sum = 0;
                for (let k = 0; k < cA; k++) {
                    sum += A[i][k] * B[k][j];
                }
                C[i][j] = sum;
            }
        }
        return C;
    }

    private static calculateEquivalentNodalLoads(n1: { x: number, y: number }, n2: { x: number, y: number }, load: TrussLoad): number[] {
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const L = Math.sqrt(dx * dx + dy * dy);
        const c = dx / L;
        const s = dy / L;

        const fea_local = Array(6).fill(0);
        const P = load.magnitude || 0;

        // Force vector in global coordinates
        const angleRad = ((load.angle !== undefined ? load.angle : 270) * Math.PI) / 180;
        const Fx = P * Math.cos(angleRad);
        const Fy = P * Math.sin(angleRad);

        // Project global force to local member axes
        const pParallel = Fx * c + Fy * s;
        const pPerpendicular = -Fx * s + Fy * c;

        if (load.type === 'point') {
            const a = load.position ?? L / 2;
            const b = L - a;

            if (a >= 0 && a <= L) {
                // Perpendicular point load Fixed End Actions
                if (Math.abs(pPerpendicular) > 1e-8) {
                    fea_local[1] = -(pPerpendicular * b * b * (3 * a + b)) / (L * L * L);
                    fea_local[2] = -(pPerpendicular * a * b * b) / (L * L);
                    fea_local[4] = -(pPerpendicular * a * a * (a + 3 * b)) / (L * L * L);
                    fea_local[5] = (pPerpendicular * a * a * b) / (L * L);
                }

                // Parallel point load FEA
                if (Math.abs(pParallel) > 1e-8) {
                    fea_local[0] = -(pParallel * b) / L;
                    fea_local[3] = -(pParallel * a) / L;
                }
            }
        } else if (load.type === 'distributed') {
            // Simplified for full uniform distributed load
            const wParallel = pParallel;
            const wPerp = pPerpendicular;

            if (Math.abs(wPerp) > 1e-8) {
                const V = (wPerp * L) / 2;
                const M = (wPerp * L * L) / 12;
                fea_local[1] = -V;
                fea_local[2] = -M;
                fea_local[4] = -V;
                fea_local[5] = M;
            }

            if (Math.abs(wParallel) > 1e-8) {
                const N = (wParallel * L) / 2;
                fea_local[0] = -N;
                fea_local[3] = -N;
            }
        }

        // Equivalent nodal actions are opposite to Fixed End forces
        const fn_local = fea_local.map(val => -val);

        const TT = [
            [c, -s, 0, 0, 0, 0],
            [s, c, 0, 0, 0, 0],
            [0, 0, 1, 0, 0, 0],
            [0, 0, 0, c, -s, 0],
            [0, 0, 0, s, c, 0],
            [0, 0, 0, 0, 0, 1]
        ];

        const f_global = Array(6).fill(0);
        for (let i = 0; i < 6; i++) {
            for (let j = 0; j < 6; j++) {
                f_global[i] += TT[i][j] * fn_local[j];
            }
        }

        return f_global;
    }

    private static calculateMemberForces(n1: { x: number, y: number }, n2: { x: number, y: number }, member: any, globalDisp: number[], loads: TrussLoad[]) {
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const L = Math.sqrt(dx * dx + dy * dy);
        const c = dx / L;
        const s = dy / L;

        const T = [
            [c, s, 0, 0, 0, 0],
            [-s, c, 0, 0, 0, 0],
            [0, 0, 1, 0, 0, 0],
            [0, 0, 0, c, s, 0],
            [0, 0, 0, -s, c, 0],
            [0, 0, 0, 0, 0, 1]
        ];

        const locDisp = Array(6).fill(0);
        for (let i = 0; i < 6; i++) {
            for (let j = 0; j < 6; j++) locDisp[i] += T[i][j] * globalDisp[j];
        }

        const E = member.elasticModulus * 1e6;
        const A = member.area * 1e-4;
        const I = (member.momentOfInertia || 5000) * 1e-8;

        const k1 = (E * A) / L;
        const k2 = (12 * E * I) / (L * L * L);
        const k3 = (6 * E * I) / (L * L);
        const k4 = (4 * E * I) / L;
        const k5 = (2 * E * I) / L;

        const k_local = [
            [k1, 0, 0, -k1, 0, 0],
            [0, k2, k3, 0, -k2, k3],
            [0, k3, k4, 0, -k3, k5],
            [-k1, 0, 0, k1, 0, 0],
            [0, -k2, -k3, 0, k2, -k3],
            [0, k3, k5, 0, -k3, k4]
        ];

        let forces = Array(6).fill(0);
        for (let i = 0; i < 6; i++) {
            for (let j = 0; j < 6; j++) {
                forces[i] += k_local[i][j] * locDisp[j];
            }
        }

        // Add Fixed End Actions back to internal forces (Actual internal force = k*d + FEA)
        loads.forEach(load => {
            if (load.type === 'temperature') {
                const alpha = load.thermalAlpha ?? 0;
                const deltaT = load.deltaT ?? 0;
                const NT = E * A * alpha * deltaT;
                forces[0] -= NT;
                forces[3] += NT; // Axial forces
            } else if (load.type === 'point' || load.type === 'distributed') {
                // Calculate fixed end local forces the same as we did for assembly, but these are positive FEA:
                const p = load.magnitude || 0;
                const angleRad = ((load.angle !== undefined ? load.angle : 270) * Math.PI) / 180;
                const Fx = p * Math.cos(angleRad);
                const Fy = p * Math.sin(angleRad);
                const pParallel = Fx * c + Fy * s;
                const pPerpendicular = -Fx * s + Fy * c;

                if (load.type === 'point') {
                    const a = load.position ?? L / 2;
                    const b = L - a;
                    if (a >= 0 && a <= L) {
                        if (Math.abs(pPerpendicular) > 1e-8) {
                            forces[1] += -(pPerpendicular * b * b * (3 * a + b)) / (L * L * L);
                            forces[2] += -(pPerpendicular * a * b * b) / (L * L);
                            forces[4] += -(pPerpendicular * a * a * (a + 3 * b)) / (L * L * L);
                            forces[5] += (pPerpendicular * a * a * b) / (L * L);
                        }
                        if (Math.abs(pParallel) > 1e-8) {
                            forces[0] += -(pParallel * b) / L;
                            forces[3] += -(pParallel * a) / L;
                        }
                    }
                } else if (load.type === 'distributed') {
                    if (Math.abs(pPerpendicular) > 1e-8) {
                        forces[1] += -(pPerpendicular * L) / 2;
                        forces[2] += -(pPerpendicular * L * L) / 12;
                        forces[4] += -(pPerpendicular * L) / 2;
                        forces[5] += (pPerpendicular * L * L) / 12;
                    }
                    if (Math.abs(pParallel) > 1e-8) {
                        forces[0] += -(pParallel * L) / 2;
                        forces[3] += -(pParallel * L) / 2;
                    }
                }
            }
        });

        // Generate internal diagrams by sampling along member length
        const STEPS = 20;
        const diagrams: { x: number, n: number, v: number, m: number, d: number }[] = [];
        for (let idx = 0; idx <= STEPS; idx++) {
            const x = (idx / STEPS) * L;
            let n_x = -forces[0];
            let v_x = forces[1];
            let m_x = -forces[2] + forces[1] * x;

            loads.forEach(load => {
                if (load.type === 'point' && load.memberId === member.id) {
                    const p = load.magnitude || 0;
                    const angleRad = ((load.angle !== undefined ? load.angle : 270) * Math.PI) / 180;
                    const Fx = p * Math.cos(angleRad);
                    const Fy = p * Math.sin(angleRad);
                    const pParallel = Fx * c + Fy * s;
                    const pPerpendicular = -Fx * s + Fy * c;
                    const a = load.position ?? L / 2;
                    if (x > a) {
                        n_x -= pParallel;
                        v_x += pPerpendicular;
                        m_x += pPerpendicular * (x - a);
                    }
                } else if (load.type === 'distributed' && load.memberId === member.id) {
                    const p = load.magnitude || 0;
                    const angleRad = ((load.angle !== undefined ? load.angle : 270) * Math.PI) / 180;
                    const Fx = p * Math.cos(angleRad);
                    const Fy = p * Math.sin(angleRad);
                    const pParallel = Fx * c + Fy * s;
                    const pPerpendicular = -Fx * s + Fy * c;
                    const st = load.startPosition ?? 0;
                    const en = load.endPosition ?? L;

                    if (x > st) {
                        const loadedLen = Math.min(x, en) - st;
                        n_x -= pParallel * loadedLen;
                        v_x += pPerpendicular * loadedLen;
                        m_x += pPerpendicular * loadedLen * (x - (st + loadedLen / 2));
                    }
                }
            });
            diagrams.push({ x, n: n_x, v: v_x, m: m_x, d: 0 }); // Note: 'd' (deflection) is set to 0 as internal transverse deflection takes more complex shape function integration, sticking to internal forces for diagrams
        }

        return {
            start: { n: -forces[0], v: forces[1], m: forces[2] },
            end: { n: forces[3], v: forces[4], m: forces[5] },
            diagrams
        };
    }

    private static solveLinearSystem(A: number[][], b: number[]): number[] {
        const n = A.length;
        const M = A.map(row => [...row]);
        const x = [...b];

        for (let i = 0; i < n; i++) {
            let maxRow = i;
            for (let k = i + 1; k < n; k++) {
                if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k;
            }

            if (Math.abs(M[maxRow][i]) < 1e-12) return Array(n).fill(0);

            [M[i], M[maxRow]] = [M[maxRow], M[i]];
            [x[i], x[maxRow]] = [x[maxRow], x[i]];

            for (let k = i + 1; k < n; k++) {
                const factor = M[k][i] / M[i][i];
                x[k] -= factor * x[i];
                for (let j = i; j < n; j++) M[k][j] -= factor * M[i][j];
            }
        }

        const solution = Array(n).fill(0);
        for (let i = n - 1; i >= 0; i--) {
            let sum = 0;
            for (let j = i + 1; j < n; j++) sum += M[i][j] * solution[j];
            solution[i] = (x[i] - sum) / M[i][i];
        }
        return solution;
    }
}
