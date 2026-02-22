import type { Beam, AnalysisResult, AnalysisPoint, Load } from '../features/beam/types';

export class BeamAnalyzer {
    private static SEGMENTS = 200; // Number of points for diagrams

    /**
     * Calculates reactions, shear, moment, and deflection using Matrix Stiffness Method.
     * Supports arbitrary supports, internal hinges (Gerber), and loads.
     */
    static analyze(beam: Beam): AnalysisResult {
        // 1. Discretize Beam into Nodes and Elements
        const { nodes, elements } = this.discretize(beam);

        // 2. Assemble Global Stiffness Matrix (K) and Force Vector (F)
        const dof = nodes.length * 2; // 2 DOF per node (v, theta)
        const K = Array.from({ length: dof }, () => Array(dof).fill(0));
        const F = Array(dof).fill(0);

        const E = beam.elasticModulus * 1e6; // kPa (kN/m2)
        const I = beam.momentOfInertia * 1e-8; // m4

        elements.forEach(el => {
            const i = el.startIndex * 2;
            const j = el.endIndex * 2;

            const isLeftHinge = nodes[el.startIndex].isHinge;
            const isRightHinge = nodes[el.endIndex].isHinge;

            // Helper to get K_local
            const k_local = this.getElementStiffness(isLeftHinge, isRightHinge, E, I, el.length);

            // Assemble into Global K
            const props = [i, i + 1, j, j + 1];
            props.forEach((globalRow, localRow) => {
                props.forEach((globalCol, localCol) => {
                    K[globalRow][globalCol] += k_local[localRow][localCol];
                });
            });

            // 3. Equivalent Nodal Loads (Fixed End Actions)
            // Add FEA to Global F
            const fea = this.calculateFEA(el, beam.loads, nodes[el.startIndex].x, nodes[el.endIndex].x, isLeftHinge, isRightHinge);
            props.forEach((globalRow, localRow) => {
                F[globalRow] += fea[localRow];
            });
        });

        // Handle Hinges (Singularity in Rotation)
        nodes.forEach((n, idx) => {
            if (n.isHinge) {
                const rotDof = idx * 2 + 1;
                K[rotDof][rotDof] += 1.0;
            }
        });

        // 4. Apply Nodal Loads directly
        nodes.forEach((node, index) => {
            // Find loads EXACTLY at node position
            beam.loads.forEach(load => {
                if (Math.abs(load.position - node.x) < 1e-6) {
                    if (load.type === 'point') {
                        const angleRad = (load.angle ?? 90) * Math.PI / 180;
                        const Fy = -load.magnitude * Math.sin(angleRad);
                        F[index * 2] += Fy;
                    } else if (load.type === 'moment') {
                        F[index * 2 + 1] -= load.magnitude;
                    }
                }
            });
        });

        // 4b. Temperature Load — adds equivalent nodal moments due to thermal gradient
        // M_T = E * I * alpha * (deltaT / h)  → curvature due to gradient
        // Uniform deltaT causes axial expansion only (no bending for prismatic beam)
        if (beam.temperatureLoad) {
            const { deltaT, alpha, gradient, depth } = beam.temperatureLoad;
            // Thermal gradient causes bending: κ = alpha * (deltaT_top - deltaT_bot) / h
            // If gradient is given (°C/m) and depth is given:
            const h = depth ?? 0.3; // default 30cm depth
            const thermalGradient = gradient ?? 0; // °C/m
            // Equivalent moment per unit length: m_T = E * I * alpha * grad
            const EI = E * I;
            const kappa_T = alpha * (thermalGradient > 0 ? thermalGradient : deltaT / h);

            elements.forEach(el => {
                const L = el.length;
                const MT = EI * kappa_T; // fixed-end moment due to temperature gradient

                // Fixed-end moments for temperature: equal and opposite self-equilibrating moments
                // At near end: +MT, at far end: -MT (for uniform gradient along element)
                const i = el.startIndex * 2;
                const j = el.endIndex * 2;
                F[i + 1] += MT;   // Start rotation DOF
                F[j + 1] -= MT;   // End rotation DOF
                // No net shear from uniform thermal gradient (only bending)
                // But for fixed-end condition, shear must balance: V = 6*E*I*kappa/L^2?
                // For a beam with thermal gradient, the FEM shear forces are zero for
                // uniform gradient (no transverse load). The moment is constant.
                // So only moment terms in F are needed.
                void L; // suppress unused warning
            });
        }

        // 5. Apply Boundary Conditions (Penalty Method)
        // Support settlements are handled as prescribed displacements: F[i] += penalty * settlement
        const penalty = 1e15;
        nodes.forEach((node, index) => {
            if (node.support) {
                const i = index * 2;
                const settlement = node.support.settlement ?? 0; // downward positive → negative displacement in FEM

                // Fix Vertical (v) — with optional settlement
                if (node.support.type === 'pinned' || node.support.type === 'roller' || node.support.type === 'fixed') {
                    K[i][i] += penalty;
                    F[i] += penalty * (-settlement); // prescribed displacement (downward = negative v)
                }

                // Fix Rotation (theta) if Fixed
                if (node.support.type === 'fixed') {
                    K[i + 1][i + 1] += penalty;
                    // No rotation prescribed (unless we add that input)
                }
            }
        });

        // 6. Solve K * u = F
        const u = this.gaussianElimination(K, F);

        // 7. Post-Processing: Reactions & Diagrams
        return this.generateResults(nodes, elements, u, beam);
    }

    // --- Helpers ---

    private static discretize(beam: Beam) {
        // Collect all critical X coordinates
        const points = new Set<number>();
        points.add(0);
        points.add(beam.length);

        beam.supports.forEach(s => points.add(s.position));
        (beam.hinges || []).forEach(h => points.add(h.position));
        beam.loads.forEach(l => {
            points.add(l.position);
            if (l.type === 'distributed') {
                if (l.startPosition !== undefined) points.add(l.startPosition);
                if (l.endPosition !== undefined) points.add(l.endPosition);
            }
        });

        const sortedX = Array.from(points).sort((a, b) => a - b);

        // Merge close points
        const uniqueX: number[] = [sortedX[0]];
        for (let i = 1; i < sortedX.length; i++) {
            if (sortedX[i] - uniqueX[uniqueX.length - 1] > 1e-5) {
                uniqueX.push(sortedX[i]);
            }
        }

        const nodes = uniqueX.map(x => {
            const support = beam.supports.find(s => Math.abs(s.position - x) < 1e-5);
            const isHinge = (beam.hinges || []).some(h => Math.abs(h.position - x) < 1e-5);
            return { x, support, isHinge };
        });

        const elements = [];
        for (let i = 0; i < nodes.length - 1; i++) {
            elements.push({
                startIndex: i,
                endIndex: i + 1,
                length: nodes[i + 1].x - nodes[i].x
            });
        }

        return { nodes, elements };
    }

    private static getElementStiffness(isLeftHinge: boolean, isRightHinge: boolean, E: number, I: number, L: number) {
        if (!isLeftHinge && !isRightHinge) {
            // Fixed-Fixed
            const a = 12 * E * I / (L * L * L);
            const b = 6 * E * I / (L * L);
            const c = 4 * E * I / L;
            const d = 2 * E * I / L;

            return [
                [a, b, -a, b],
                [b, c, -b, d],
                [-a, -b, a, -b],
                [b, d, -b, c]
            ];
        } else if (isLeftHinge && !isRightHinge) {
            // Pinned-Fixed (Release Left)
            const a = 3 * E * I / (L * L * L);
            const b = 3 * E * I / (L * L);
            const c = 3 * E * I / L;

            return [
                [a, 0, -a, b],
                [0, 0, 0, 0],
                [-a, 0, a, -b],
                [b, 0, -b, c]
            ];
        } else if (!isLeftHinge && isRightHinge) {
            // Fixed-Pinned (Release Right)
            const a = 3 * E * I / (L * L * L);
            const b = 3 * E * I / (L * L);
            const c = 3 * E * I / L;

            return [
                [a, b, -a, 0],
                [b, c, -b, 0],
                [-a, -b, a, 0],
                [0, 0, 0, 0]
            ];
        } else {
            // Pinned-Pinned
            return Array(4).fill(0).map(() => Array(4).fill(0));
        }
    }

    private static calculateFEA(el: any, loads: Load[], xStart: number, xEnd: number, isLeftHinge: boolean, isRightHinge: boolean) {
        const fea = Array(4).fill(0); // v1, m1, v2, m2
        const L = el.length;

        loads.forEach(load => {
            if (load.type === 'point' && load.position > xStart && load.position < xEnd) {
                const a = load.position - xStart;
                const b = xEnd - load.position;
                const angleRad = (load.angle ?? 90) * Math.PI / 180;
                const Py = -load.magnitude * Math.sin(angleRad); // Down is negative

                const V1 = -Py * b * b * (3 * a + b) / (L * L * L);
                const M1 = -Py * a * b * b / (L * L);
                const V2 = -Py * a * a * (a + 3 * b) / (L * L * L);
                const M2 = Py * a * a * b / (L * L);

                this.addFEA(fea, V1, M1, V2, M2, L, isLeftHinge, isRightHinge);
            }
            else if (load.type === 'distributed' && load.startPosition !== undefined && load.endPosition !== undefined) {
                const lStart = Math.max(load.startPosition, xStart);
                const lEnd = Math.min(load.endPosition, xEnd);

                if (lEnd > lStart) {
                    const w1 = load.magnitude;
                    const steps = 10;
                    const dx = (lEnd - lStart) / steps;

                    for (let k = 0; k < steps; k++) {
                        const x = lStart + (k + 0.5) * dx;
                        const localX = x - xStart;

                        const wf = w1 + ((load.endMagnitude ?? w1) - w1) * (x - load.startPosition) / (load.endPosition - load.startPosition);
                        const P_eff = -wf * dx; // Equivalent Point load

                        const a = localX;
                        const b = L - a;

                        const V1 = -P_eff * b * b * (3 * a + b) / (L * L * L);
                        const M1 = -P_eff * a * b * b / (L * L);
                        const V2 = -P_eff * a * a * (a + 3 * b) / (L * L * L);
                        const M2 = P_eff * a * a * b / (L * L);

                        this.addFEA(fea, V1, M1, V2, M2, L, isLeftHinge, isRightHinge);
                    }
                }
            }
        });

        return fea;
    }

    private static addFEA(fea: number[], V1: number, M1: number, V2: number, M2: number, L: number, isLeftHinge: boolean, isRightHinge: boolean) {
        // Invert Reactions to get Equivalent Nodal Loads
        V1 = -V1; M1 = -M1; V2 = -V2; M2 = -M2;

        if (!isLeftHinge && !isRightHinge) {
            fea[0] += V1; fea[1] += M1; fea[2] += V2; fea[3] += M2;
        } else if (isLeftHinge && !isRightHinge) {
            fea[1] += 0;
            fea[3] += M2 - 0.5 * M1;
            fea[0] += V1 - 1.5 * M1 / L;
            fea[2] += V2 + 1.5 * M1 / L;
        } else if (!isLeftHinge && isRightHinge) {
            fea[3] += 0;
            fea[1] += M1 - 0.5 * M2;
            fea[0] += V1 + 1.5 * M2 / L;
            fea[2] += V2 - 1.5 * M2 / L;
        } else {
            fea[1] += 0;
            fea[3] += 0;
            fea[0] += V1 - (M1 + M2) / L;
            fea[2] += V2 + (M1 + M2) / L;
        }
    }

    private static gaussianElimination(A: number[][], b: number[]) {
        const n = A.length;
        const M = A.map(row => [...row]);
        const x = [...b];

        for (let i = 0; i < n; i++) {
            let maxEl = Math.abs(M[i][i]);
            let maxRow = i;
            for (let k = i + 1; k < n; k++) {
                if (Math.abs(M[k][i]) > maxEl) {
                    maxEl = Math.abs(M[k][i]);
                    maxRow = k;
                }
            }

            for (let k = i; k < n; k++) {
                const tmp = M[maxRow][k];
                M[maxRow][k] = M[i][k];
                M[i][k] = tmp;
            }
            const tmp = x[maxRow];
            x[maxRow] = x[i];
            x[i] = tmp;

            for (let k = i + 1; k < n; k++) {
                const c = -M[k][i] / M[i][i];
                for (let j = i; j < n; j++) {
                    if (i === j) {
                        M[k][j] = 0;
                    } else {
                        M[k][j] += c * M[i][j];
                    }
                }
                x[k] += c * x[i];
            }
        }

        const result = Array(n).fill(0);
        for (let i = n - 1; i > -1; i--) {
            let sum = 0;
            for (let j = i + 1; j < n; j++) {
                sum += M[i][j] * result[j];
            }
            result[i] = (x[i] - sum) / M[i][i];
        }
        return result;
    }

    // --- Results Generation ---


    // --- Results Generation ---

    private static generateResults(nodes: any[], elements: any[], u: number[], beam: Beam): AnalysisResult {
        const points: AnalysisPoint[] = [];
        const E = beam.elasticModulus * 1e6;
        const I = beam.momentOfInertia * 1e-8;
        const L = beam.length;

        // =====================================================================
        // REACTIONS — route based on beam topology
        //   A) No hinges, cantilever (1 fixed):   direct statics
        //   B) No hinges, 2 pin/roller:            direct ΣM@A, ΣFy
        //   C) Has internal hinges (Gerber):       classical segment statics
        //   D) Hyperstatic, no hinges:             FEM K_orig×u
        // =====================================================================
        const reactions: Record<string, number> = {};
        const momentReactions: Record<string, number> = {};

        const hinges: any[] = beam.hinges || [];
        const hasHinges = hinges.length > 0;

        const supportNodes = nodes.filter((n: any) => n.support);
        const pinRollerNodes = supportNodes.filter((n: any) => n.support.type === 'pinned' || n.support.type === 'roller');
        const fixedNodes = supportNodes.filter((n: any) => n.support.type === 'fixed');

        // Helper: load resultant (Fy downward-positive, M CCW-positive) about xRef
        const loadResultant = (xRef: number, xa?: number, xb?: number) => {
            let Fy = 0, M = 0;
            const hasRange = xa !== undefined && xb !== undefined;
            beam.loads.forEach((load: any) => {
                if (load.type === 'point') {
                    const pos: number = load.position;
                    if (hasRange && (pos < (xa as number) - 1e-9 || pos > (xb as number) + 1e-9)) return;
                    const ar = (load.angle ?? 90) * Math.PI / 180;
                    const fy = load.magnitude * Math.sin(ar);
                    Fy += fy; M += fy * (pos - xRef);
                } else if (load.type === 'distributed' && load.startPosition !== undefined && load.endPosition !== undefined) {
                    const overS = hasRange ? Math.max(load.startPosition, xa as number) : load.startPosition;
                    const overE = hasRange ? Math.min(load.endPosition, xb as number) : load.endPosition;
                    if (overE <= overS + 1e-9) return;
                    const totalLen = load.endPosition - load.startPosition;
                    const w1 = load.magnitude, w2 = load.endMagnitude ?? w1;
                    const ta = (overS - load.startPosition) / totalLen;
                    const tb = (overE - load.startPosition) / totalLen;
                    const wa = w1 + (w2 - w1) * ta;
                    const wb = w1 + (w2 - w1) * tb;
                    const F = (wa + wb) / 2 * (overE - overS);
                    const centroid = overS + (overE - overS) * (2 * wb + wa) / (3 * (wa + wb));
                    Fy += F; M += F * (centroid - xRef);
                } else if (load.type === 'moment') {
                    if (!hasRange || (load.position >= (xa as number) - 1e-9 && load.position <= (xb as number) + 1e-9)) {
                        M += load.magnitude;
                    }
                }
            });
            return { Fy, M };
        };

        // Helper: compute reactions via K_orig × u (FEM-based, for indeterminate cases)
        const computeReactionsFromFEM = () => {
            const dof = nodes.length * 2;
            const K_orig: number[][] = Array.from({ length: dof }, () => Array(dof).fill(0));
            elements.forEach((el: any) => {
                const si = el.startIndex * 2, ei = el.endIndex * 2;
                const k = this.getElementStiffness(nodes[el.startIndex].isHinge, nodes[el.endIndex].isHinge, E, I, el.length);
                const props = [si, si + 1, ei, ei + 1];
                props.forEach((gr, lr) => props.forEach((gc, lc) => { K_orig[gr][gc] += k[lr][lc]; }));
            });
            nodes.forEach((node: any, idx: number) => {
                if (!node.support) return;
                const dV = idx * 2;
                let Ku = 0;
                for (let c = 0; c < dof; c++) Ku += K_orig[dV][c] * u[c];
                let Fapp = 0;
                beam.loads.forEach((load: any) => {
                    if (load.type === 'point' && Math.abs(load.position - node.x) < 1e-6) {
                        Fapp += -load.magnitude * Math.sin((load.angle ?? 90) * Math.PI / 180);
                    }
                });
                reactions[node.support.id] = parseFloat((Ku - Fapp).toFixed(4));
                if (node.support.type === 'fixed') {
                    const dT = idx * 2 + 1;
                    let KuM = 0;
                    for (let c = 0; c < dof; c++) KuM += K_orig[dT][c] * u[c];
                    momentReactions[node.support.id] = parseFloat(KuM.toFixed(4));
                }
            });
        };

        if (!hasHinges && fixedNodes.length === 1 && pinRollerNodes.length === 0) {
            // ── A: Cantilever ─────────────────────────────────────────────────
            const { Fy, M } = loadResultant(fixedNodes[0].x);
            reactions[fixedNodes[0].support.id] = parseFloat(Fy.toFixed(4));
            momentReactions[fixedNodes[0].support.id] = parseFloat((-M).toFixed(4));

        } else if (!hasHinges && pinRollerNodes.length === 2 && fixedNodes.length === 0) {
            // ── B: Simply supported, no hinges ────────────────────────────────
            const xA = pinRollerNodes[0].x, xB = pinRollerNodes[1].x;
            const { Fy: totalFy, M: mAboutA } = loadResultant(xA);
            const RB = mAboutA / (xB - xA);
            reactions[pinRollerNodes[0].support.id] = parseFloat((totalFy - RB).toFixed(4));
            reactions[pinRollerNodes[1].support.id] = parseFloat(RB.toFixed(4));

        } else if (hasHinges) {
            // ── C: Gerber beam — classical cut-at-hinge analysis ─────────────
            //
            // Algorithm: iterative segment solver.
            //   - Beam is cut at hinge positions into segments.
            //   - Each cut introduces 1 unknown shear (continuity: M=0, V=transmitted).
            //   - A segment is solvable when only 1 of its 2 cut-shears is unknown,
            //     and it has exactly (unknownShears + N_reactions) = 2 equation budget.
            //   - Iteratively solve solvable segments until all done or stuck (fallback FEM).
            //
            const hingeXs: number[] = hinges.map((h: any) => h.position).sort((a: number, b: number) => a - b);
            const cutXs: number[] = [0, ...hingeXs, L];

            // Shear force at each cut boundary (positive = upward on right face of cut)
            // Known: at beam ends, shear from outside = 0 (free ends) or overhang value
            const cutShear: Map<number, number | null> = new Map();
            cutXs.forEach((x, i) => {
                // At beam start (i=0) and beam end (last): only free end = 0
                // Intermediate hinges: unknown until computed
                if (i === 0 || i === cutXs.length - 1) cutShear.set(x, 0); // free ends
                else cutShear.set(x, null); // unknown
            });

            const segReactions: Record<string, number> = {};
            const solvedSupportIds = new Set<string>();

            let progress = true;
            let iterations = 0;
            const maxIter = cutXs.length * 3;

            while (progress && solvedSupportIds.size < supportNodes.length && iterations++ < maxIter) {
                progress = false;

                for (let si = 0; si < cutXs.length - 1; si++) {
                    const xa = cutXs[si], xb = cutXs[si + 1];
                    const leftV = cutShear.get(xa);   // null = unknown
                    const rightV = cutShear.get(xb);  // null = unknown

                    // Supports in this segment (inclusive of endpoints)
                    const segSupports = supportNodes.filter((n: any) =>
                        n.x >= xa - 1e-9 && n.x <= xb + 1e-9 && !solvedSupportIds.has(n.support.id));
                    const nUnkSup = segSupports.length;
                    const nUnkV = (leftV === null ? 1 : 0) + (rightV === null ? 1 : 0);
                    const totalUnk = nUnkSup + nUnkV;

                    // We have 2 equations (ΣFy, ΣM) per segment
                    if (totalUnk > 2) continue; // too many unknowns, skip
                    if (totalUnk === 0) continue; // already solved

                    const { Fy: loadFy } = loadResultant(xa, xa, xb);

                    // Known boundary shears (treat null as 0 if only 1 unknown)
                    const Vl = leftV ?? 0;
                    const Vr = rightV ?? 0;

                    if (totalUnk === 2 && nUnkSup === 1 && nUnkV === 1) {
                        // 1 unknown shear + 1 unknown reaction → solvable if:
                        //  the known shear side has a support at its edge OR free end.
                        // Use moment about the support to eliminate it.
                        const s = segSupports[0];
                        if (leftV === null) {
                            // Left V unknown, right Vr known.
                            // ΣM@s (CCW+): Vl*(xa-s.x) - loadMs_s - Vr*(xb-s.x) = 0
                            // → Vl = (loadMs_s + Vr*(xb-s.x)) / (xa-s.x)
                            const { M: loadMs_s } = loadResultant(s.x, xa, xb);
                            let Vl_new: number, Rs_new: number;
                            if (Math.abs(s.x - xa) < 1e-9) {
                                // Support at xa: Vl arm = 0 in ΣM@s → can't solve, skip
                                continue;
                            } else if (Math.abs(s.x - xb) < 1e-9) {
                                // Support at xb: ΣM@xb: Vl*(xa-xb) + loadMs_xb - Vr*0 = 0
                                const { M: loadMs_xb } = loadResultant(xb, xa, xb);
                                Vl_new = loadMs_xb / (xb - xa);
                                Rs_new = loadFy + Vr - Vl_new;
                            } else {
                                // General: Vl = (loadMs_s + Vr*(xb-s.x)) / (xa-s.x)
                                Vl_new = (loadMs_s + Vr * (xb - s.x)) / (xa - s.x);
                                Rs_new = loadFy + Vr - Vl_new;
                            }
                            segReactions[s.support.id] = Rs_new;
                            solvedSupportIds.add(s.support.id);
                            cutShear.set(xa, Vl_new);
                            progress = true;
                        } else {
                            // Left V known, Right V unknown
                            // ΣM@xa: Rs*(s.x-xa) - Vr*(xb-xa) = loadMaboutXa + Vl*0
                            // Unknowns: Rs and Vr → pivot about s.x:
                            // ΣM@s: -Vr*(xb-s.x) + Vl*(s.x-xa) = loadM@s
                            const { M: loadMs } = loadResultant(s.x, xa, xb);
                            // ΣM@s: Vl*(s.x-xa) - Vr*(xb-s.x) = loadMs
                            // Only Vr unknown: Vr = (Vl*(s.x-xa) - loadMs) / (xb-s.x)
                            const Vr_new = (Vl * (xa - s.x) - loadMs) / (xb - s.x);
                            // Then ΣFy: Vl + Rs - Vr - loadFy = 0 → Rs = loadFy + Vr - Vl
                            const Rs_new = loadFy + Vr_new - Vl;
                            segReactions[s.support.id] = Rs_new;
                            solvedSupportIds.add(s.support.id);
                            cutShear.set(xb, Vr_new);
                            progress = true;
                        }
                    } else if (totalUnk === 2 && nUnkSup === 2 && nUnkV === 0) {
                        // Both boundary shears known, 2 unknown reactions → ΣFy + ΣM
                        const s1 = segSupports[0], s2 = segSupports[1];
                        const { M: loadMs1 } = loadResultant(s1.x, xa, xb);
                        // ΣM@s1: R2*(s2.x-s1.x) = loadMs1 + Vl*(xa-s1.x) - Vr*(xb-s1.x)
                        //                     // ΣM@s1 = 0: Loads_moment + Vl*arm_Vl - Vr*arm_Vr - R2*(s2.x-s1.x) = 0
                        // → R2 = (loadMs1 + Vl*(xa-s1.x) - Vr*(xb-s1.x)) / (s2.x-s1.x)
                        const R2_fixed = (loadMs1 + Vr * (xb - s1.x) - Vl * (xa - s1.x)) / (s2.x - s1.x);
                        const R1 = loadFy + Vr - Vl - R2_fixed;
                        segReactions[s1.support.id] = R1;
                        segReactions[s2.support.id] = R2_fixed;
                        solvedSupportIds.add(s1.support.id);
                        solvedSupportIds.add(s2.support.id);
                        progress = true;
                    } else if (totalUnk === 1 && nUnkSup === 1 && nUnkV === 0) {
                        // 1 unknown reaction, both boundary shears known → ΣFy
                        const s = segSupports[0];
                        segReactions[s.support.id] = loadFy + Vr - Vl;
                        solvedSupportIds.add(s.support.id);
                        // Propagate: the shear "through" this segment for neighbours' benefit
                        // (no cut shear to update, both boundaries already known)
                        progress = true;
                    }

                    // After solving, if this segment's cut shear at one end was null and now we know
                    // all reactions in the segment, propagate the missing shear:
                    if (leftV === null && cutShear.get(xa) === null) {
                        // Compute leftV from ΣFy: Rs + Vl = loadFy + Vr
                        const totalR = segSupports
                            .filter((s: any) => segReactions[s.support.id] !== undefined)
                            .reduce((acc: number, s: any) => acc + segReactions[s.support.id], 0);
                        const Vl_new = loadFy + Vr - totalR;
                        cutShear.set(xa, Vl_new);
                    } else if (rightV === null && cutShear.get(xb) === null) {
                        const totalR = segSupports
                            .filter((s: any) => segReactions[s.support.id] !== undefined)
                            .reduce((acc: number, s: any) => acc + segReactions[s.support.id], 0);
                        const Vr_new = Vl + totalR - loadFy;
                        cutShear.set(xb, Vr_new);
                    }
                }
            }

            // Check if all supports solved
            const allSolved = supportNodes.every((n: any) => segReactions[n.support.id] !== undefined);
            if (allSolved) {
                supportNodes.forEach((n: any) => {
                    reactions[n.support.id] = parseFloat(segReactions[n.support.id].toFixed(4));
                });
            } else {
                // Fallback: FEM
                computeReactionsFromFEM();
            }

        } else {
            // ── D: Hyperstatic (no hinges) — FEM ──────────────────────────────
            computeReactionsFromFEM();
        }

        // =====================================================================
        // V/M DIAGRAMS via free-body cut from left (uses computed reactions)
        // =====================================================================
        const reactionMap: Map<number, number> = new Map();
        const momentMap: Map<number, number> = new Map();
        nodes.forEach((n: any) => {
            if (n.support && reactions[n.support.id] !== undefined)
                reactionMap.set(n.x, reactions[n.support.id]);
            if (n.support && momentReactions[n.support.id] !== undefined)
                momentMap.set(n.x, momentReactions[n.support.id]);
        });

        const allX = new Set<number>();
        elements.forEach((el: any) => {
            const x0 = nodes[el.startIndex].x, xE = nodes[el.endIndex].x;
            const steps = Math.ceil(this.SEGMENTS * ((xE - x0) / L));
            for (let s = 0; s <= steps; s++) allX.add(x0 + s * (xE - x0) / steps);
        });

        const sortedX = Array.from(allX).sort((a, b) => a - b);

        sortedX.forEach(xG => {
            let V = 0, M = 0;
            reactionMap.forEach((Ry, xPos) => {
                if (xPos < xG - 1e-9) { V += Ry; M += Ry * (xG - xPos); }
                else if (Math.abs(xPos - xG) < 1e-9) { V += Ry * 0.5; }
            });
            momentMap.forEach((Mry, xPos) => {
                if (xPos <= xG - 1e-9) M += Mry;
            });
            beam.loads.forEach((load: any) => {
                if (load.type === 'point') {
                    const ar = (load.angle ?? 90) * Math.PI / 180;
                    const Fy = load.magnitude * Math.sin(ar);
                    if (load.position < xG - 1e-9) { V -= Fy; M -= Fy * (xG - load.position); }
                    else if (Math.abs(load.position - xG) < 1e-9) { V -= Fy * 0.5; }
                } else if (load.type === 'distributed' && load.startPosition !== undefined && load.endPosition !== undefined) {
                    const a = load.startPosition, b = load.endPosition;
                    if (a >= xG + 1e-9) return;
                    const w1 = load.magnitude, w2 = load.endMagnitude ?? w1;
                    const oS = a, oE = Math.min(b, xG);
                    if (oE <= oS) return;
                    const tS = (oS - a) / (b - a), tE = (oE - a) / (b - a);
                    const ws = w1 + (w2 - w1) * tS, we = w1 + (w2 - w1) * tE;
                    const F = (ws + we) / 2 * (oE - oS);
                    const centroid = oS + (oE - oS) * (2 * we + ws) / (3 * (ws + we));
                    V -= F; M -= F * (xG - centroid);
                } else if (load.type === 'moment') {
                    if (load.position < xG - 1e-9) M += load.magnitude;
                }
            });
            points.push({ x: xG, shear: V, moment: M, deflection: 0 });
        });

        // Second pass: deflection by integrating moment
        let pIdx = 0;
        elements.forEach((el: any) => {
            const elL = el.length;
            const steps = Math.ceil(this.SEGMENTS * (elL / L));
            const i = el.startIndex * 2;
            let v_curr = u[i], theta_curr = u[i + 1];
            const dx = elL / steps;
            const startX = nodes[el.startIndex].x, endX = nodes[el.endIndex].x;

            while (pIdx < points.length && Math.abs(points[pIdx].x - startX) > 1e-4 && points[pIdx].x < startX) pIdx++;
            if (pIdx < points.length && Math.abs(points[pIdx].x - startX) < 1e-4) {
                points[pIdx].deflection = v_curr; pIdx++;
            }
            for (let s = 1; s <= steps; s++) {
                if (pIdx >= points.length || points[pIdx].x > endX + 1e-4) break;
                const prevM = pIdx > 0 ? points[pIdx - 1].moment : points[pIdx].moment;
                const avgM = (prevM + points[pIdx].moment) / 2;
                const theta_old = theta_curr;
                theta_curr += (avgM / (E * I)) * dx;
                v_curr += ((theta_old + theta_curr) / 2) * dx;
                points[pIdx].deflection = v_curr; pIdx++;
            }
        });

        let maxMoment = 0, maxShear = 0, maxDeflection = 0;
        points.forEach(p => {
            if (Math.abs(p.moment) > maxMoment) maxMoment = Math.abs(p.moment);
            if (Math.abs(p.shear) > maxShear) maxShear = Math.abs(p.shear);
            if (Math.abs(p.deflection) > maxDeflection) maxDeflection = Math.abs(p.deflection);
        });

        return { reactions, momentReaction: momentReactions, diagrams: points, maxMoment, maxShear, maxDeflection };
    }
}
