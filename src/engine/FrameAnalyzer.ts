import type { Structure, AnalysisResult, Node, Load } from '../features/editor/types';

export class FrameAnalyzer {
    static analyze(structure: Structure): AnalysisResult {
        const nodeCount = structure.nodes.length;
        const dofPerNode = 3;
        const systemDof = nodeCount * dofPerNode;

        // 1. Map Node IDs to Indices
        const nodeIndexMap = new Map<string, number>();
        structure.nodes.forEach((n, i) => nodeIndexMap.set(n.id, i));

        // 2. Initialize Global Stiffness Matrix (K) and Force Vector (F)
        const K = Array(systemDof).fill(0).map(() => Array(systemDof).fill(0));
        const F = Array(systemDof).fill(0);

        // 3. Assemble Stiffness Matrix
        structure.members.forEach(member => {
            const startNode = structure.nodes.find(n => n.id === member.startNodeId)!;
            const endNode = structure.nodes.find(n => n.id === member.endNodeId)!;
            const mat = structure.materials.find(m => m.id === member.materialId)!;
            const sec = structure.sections.find(s => s.id === member.sectionId)!;

            const i = nodeIndexMap.get(startNode.id)!;
            const j = nodeIndexMap.get(endNode.id)!;

            const k_global = this.getElementStiffnessMatrix(startNode, endNode, mat, sec);

            // Add to Global K
            const indices = [
                3 * i, 3 * i + 1, 3 * i + 2,
                3 * j, 3 * j + 1, 3 * j + 2
            ];

            for (let r = 0; r < 6; r++) {
                for (let c = 0; c < 6; c++) {
                    K[indices[r]][indices[c]] += k_global[r][c];
                }
            }
        });

        // 4. Assemble Load Vector (Nodal Loads + Equivalent Member Loads)

        // Nodal Loads
        structure.loads.filter(l => l.type === 'nodal').forEach(load => {
            const nIdx = nodeIndexMap.get(load.targetId);
            if (nIdx !== undefined) {
                F[3 * nIdx] += load.fx || 0;
                F[3 * nIdx + 1] += load.fy || 0;
                F[3 * nIdx + 2] += load.mz || 0;
            }
        });

        // Distributed / Point Loads on Members -> Equivalent Nodal Loads (FEM)
        structure.loads.filter(l => l.type === 'member_distributed' || l.type === 'member_point').forEach(load => {
            const member = structure.members.find(m => m.id === load.targetId);
            if (!member) return;

            const startNode = structure.nodes.find(n => n.id === member.startNodeId)!;
            const endNode = structure.nodes.find(n => n.id === member.endNodeId)!;
            const i = nodeIndexMap.get(startNode.id)!;
            const j = nodeIndexMap.get(endNode.id)!;

            const indices = [3 * i, 3 * i + 1, 3 * i + 2, 3 * j, 3 * j + 1, 3 * j + 2];
            const eqLoads = this.calculateEquivalentNodalLoads(startNode, endNode, load);

            for (let k = 0; k < 6; k++) {
                F[indices[k]] += eqLoads[k];
            }
        });

        // Temperature Loads on Members -> Equivalent Nodal Loads
        // Uniform ΔT -> axial elongation: N_T = E*A*alpha*deltaT (applies as axial force pair)
        // Thermal gradient across depth -> bending: κ = alpha * gradient -> M_T = E*I*kappa (fixed-end moments)
        structure.loads.filter(l => l.type === 'temperature').forEach(load => {
            const member = structure.members.find(m => m.id === load.targetId);
            if (!member) return;
            const startNode = structure.nodes.find(n => n.id === member.startNodeId)!;
            const endNode = structure.nodes.find(n => n.id === member.endNodeId)!;
            const mat = structure.materials.find(m => m.id === member.materialId)!;
            const sec = structure.sections.find(s => s.id === member.sectionId)!;

            const dx = endNode.x - startNode.x;
            const dy = endNode.y - startNode.y;
            const L = Math.sqrt(dx * dx + dy * dy);
            const c = dx / L;
            const s = dy / L;

            const E = mat.E * 1e6;       // GPa -> kN/m²
            const A = sec.A * 1e-4;       // cm² -> m²
            const I = sec.I * 1e-8;       // cm⁴ -> m⁴
            const alpha = load.alpha ?? 1.2e-5;
            const deltaT = load.deltaT ?? 0;
            const gradient = load.gradient ?? 0;
            const h = load.depth ?? 0.3;

            const i = nodeIndexMap.get(startNode.id)!;
            const j = nodeIndexMap.get(endNode.id)!;

            // 1. Axial thermal force (uniform ΔT)
            const N_T = E * A * alpha * deltaT;
            // Acts along member axis: -N_T at start in local x, +N_T at end
            // Transform to global: Fx = N_T * c, Fy = N_T * s
            F[3 * i] -= N_T * c;
            F[3 * i + 1] -= N_T * s;
            F[3 * j] += N_T * c;
            F[3 * j + 1] += N_T * s;

            // 2. Bending thermal moment (temperature gradient across depth)
            // For fixed-fixed beam: FEM = ±E*I*alpha*gradient/h at member ends
            const kappa_T = alpha * (gradient !== 0 ? gradient : deltaT / h);
            const MT = E * I * kappa_T;
            // Self-equilibrating: +MT at start rotation, -MT at end rotation
            F[3 * i + 2] += MT;
            F[3 * j + 2] -= MT;
        });

        // 5. Apply Boundary Conditions (Penalty + Elastic Spring + Settlement)
        const PENALTY = 1e14;
        structure.nodes.forEach((n, i) => {
            const dx_i = 3 * i;
            const dy_i = 3 * i + 1;
            const rz_i = 3 * i + 2;

            // Hard restraints (penalty method) + optional prescribed displacement (settlement)
            if (n.restraints.dx) {
                K[dx_i][dx_i] += PENALTY;
                const prescribed = (n as any).prescribedDx ?? 0;
                F[dx_i] = PENALTY * prescribed;
            }
            if (n.restraints.dy) {
                K[dy_i][dy_i] += PENALTY;
                const prescribed = (n as any).prescribedDy ?? 0;
                F[dy_i] = PENALTY * prescribed;
            }
            if (n.restraints.rz) {
                K[rz_i][rz_i] += PENALTY;
                // Rotation settlement not implemented — zero by default
            }

            // Elastic spring supports: add spring stiffness to diagonal
            const elastic = (n as any).elasticSupport as { kx?: number; ky?: number; krz?: number } | undefined;
            if (elastic) {
                if (elastic.kx) K[dx_i][dx_i] += elastic.kx;
                if (elastic.ky) K[dy_i][dy_i] += elastic.ky;
                if (elastic.krz) K[rz_i][rz_i] += elastic.krz;
            }
        });

        // 6. Solve K * d = F
        const d = this.solveLinearSystem(K, F);

        // 7. Post-Processing (Member Forces)
        const reactions: Record<string, any> = {};
        const memberForces: Record<string, any> = {};
        const nodeDisplacements: Record<string, any> = {};

        structure.nodes.forEach((n, i) => {
            nodeDisplacements[n.id] = {
                dx: d[3 * i],
                dy: d[3 * i + 1],
                rz: d[3 * i + 2]
            };
            // Reactions calculation (simple approach: K_orig * d - F_applied)
            // ... omitted for brevity, can calculate if needed
            reactions[n.id] = { fx: 0, fy: 0, mz: 0 };
        });

        structure.members.forEach(member => {
            const startNode = structure.nodes.find(n => n.id === member.startNodeId)!;
            const endNode = structure.nodes.find(n => n.id === member.endNodeId)!;
            const mat = structure.materials.find(m => m.id === member.materialId)!;
            const sec = structure.sections.find(s => s.id === member.sectionId)!;

            const i = nodeIndexMap.get(startNode.id)!;
            const j = nodeIndexMap.get(endNode.id)!;

            const globalDisp = [
                d[3 * i], d[3 * i + 1], d[3 * i + 2],
                d[3 * j], d[3 * j + 1], d[3 * j + 2]
            ];

            memberForces[member.id] = this.calculateMemberForces(startNode, endNode, mat, sec, globalDisp);
        });

        return { nodeDisplacements, memberForces, reactions };
    }

    private static getElementStiffnessMatrix(n1: Node, n2: Node, mat: any, sec: any): number[][] {
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const L = Math.sqrt(dx * dx + dy * dy);
        const c = dx / L;
        const s = dy / L;

        // Properties
        const E = mat.E * 1e6; // GPa -> kN/m^2
        const A = sec.A * 1e-4; // cm^2 -> m^2
        const I = sec.I * 1e-8; // cm^4 -> m^4

        // Local Stiffness Matrix (k_local) 6x6
        // [ EA/L   0      0      -EA/L   0      0    ]
        // [ 0     12EI/L^3 6EI/L^2 0    -12EI/L^3 6EI/L^2 ]
        // ...
        // Simplified construction
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

        // Transformation Matrix T
        // [ c  s  0  0  0  0 ]
        // [-s  c  0  0  0  0 ]
        // [ 0  0  1  0  0  0 ]
        // [ 0  0  0  c  s  0 ]
        // [ 0  0  0 -s  c  0 ]
        // [ 0  0  0  0  0  1 ]

        // K_global = T^T * k_local * T
        // Implementation of matrix multiplication:

        return this.transformMatrix(k_local, c, s);
    }

    private static transformMatrix(k_local: number[][], c: number, s: number): number[][] {
        const T = [
            [c, s, 0, 0, 0, 0],
            [-s, c, 0, 0, 0, 0],
            [0, 0, 1, 0, 0, 0],
            [0, 0, 0, c, s, 0],
            [0, 0, 0, -s, c, 0],
            [0, 0, 0, 0, 0, 1]
        ];

        // T_transpose
        const TT = T[0].map((_, colIndex) => T.map(row => row[colIndex]));

        // Multiply TT * k_local
        const Temp = this.multiplyMatrices(TT, k_local);
        // Multiply Result * T
        return this.multiplyMatrices(Temp, T);
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

    private static calculateEquivalentNodalLoads(n1: Node, n2: Node, load: Load): number[] {
        // Simplified for UDL perpendicular to member
        // Returns Force vector in GLOBAL coordinates 6x1
        // 1. Calculate Fixed End Forces in LOCAL
        // 2. Transform to Global (Force transform is same as Displacement? Yes, F_glob = T^T * F_loc ?)
        // Actually F_local = T * F_global -> F_global = T^-1 * F_local = T^T * F_local

        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const L = Math.sqrt(dx * dx + dy * dy);
        const c = dx / L;
        const s = dy / L;

        const f_fixed_local = Array(6).fill(0);

        if (load.type === 'member_distributed' && load.wStart !== undefined) {
            // Assuming w is vertical (gravity) or perpendicular? 
            // SAP2000 usually asks. Assuming Perpendicular for now for frame element UDL logic,
            // OR assuming Gravity (Global Y).
            // Let's assume w is gravity load in Global Y direction (standard for beams).
            // Then we need to project it? 
            // For simplicity prototype: Assume load is PERPENDICULAR to member (q).

            const q = load.wStart; // kN/m
            const V = (q * L) / 2;
            const M = (q * L * L) / 12;

            // Reacting forces at nodes (Fixed Support Reactions)
            // Start Node: Fy = +V, M = +M
            // End Node:   Fy = +V, M = -M

            // But Equivalent Nodal Load is MINUS the Reaction.
            // So Load on Node = - Reaction
            // Start: Fy = -V, M = -M
            // End:   Fy = -V, M = +M

            // Local indices: 0:x, 1:y, 2:m ...
            f_fixed_local[1] = -V;
            f_fixed_local[2] = -M;
            f_fixed_local[4] = -V;
            f_fixed_local[5] = M;
        }

        // Transform to Global
        // F_global = T^T * f_fixed_local
        // T^T is:
        // [ c -s  0 ...]
        // [ s  c  0 ...]
        // ...

        const T_T = [
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
                f_global[i] += T_T[i][j] * f_fixed_local[j];
            }
        }

        return f_global;
    }

    private static calculateMemberForces(n1: Node, n2: Node, mat: any, sec: any, globalDisp: number[]) {
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const L = Math.sqrt(dx * dx + dy * dy);
        const c = dx / L;
        const s = dy / L;

        // Transform global displacements to local
        // u_local = T * u_global
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
            for (let j = 0; j < 6; j++) {
                locDisp[i] += T[i][j] * globalDisp[j];
            }
        }

        // k_local * u_local = f_local
        // Reconstruct k_local (simplified reuse)
        const E = mat.E * 1e6;
        const A = sec.A * 1e-4;
        const I = sec.I * 1e-8;

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

        const forces = Array(6).fill(0);
        for (let i = 0; i < 6; i++) {
            for (let j = 0; j < 6; j++) {
                forces[i] += k_local[i][j] * locDisp[j];
            }
        }

        // indices: 0:N1, 1:V1, 2:M1, 3:N2, 4:V2, 5:M2
        return {
            startForce: { N: forces[0], V: forces[1], M: forces[2] },
            endForce: { N: forces[3], V: forces[4], M: forces[5] }
        };
    }

    private static solveLinearSystem(A: number[][], b: number[]): number[] {
        // Gaussian elimination (same as Truss)
        const n = A.length;
        const M = A.map(row => [...row]);
        const x = [...b];

        for (let i = 0; i < n; i++) {
            let maxRow = i;
            for (let k = i + 1; k < n; k++) {
                if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k;
            }
            if (Math.abs(M[maxRow][i]) < 1e-12) {
                return Array(n).fill(0); // Singularity check
            }
            [M[i], M[maxRow]] = [M[maxRow], M[i]];
            [x[i], x[maxRow]] = [x[maxRow], x[i]];
            for (let k = i + 1; k < n; k++) {
                const f = M[k][i] / M[i][i];
                x[k] -= f * x[i];
                for (let j = i; j < n; j++) M[k][j] -= f * M[i][j];
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
