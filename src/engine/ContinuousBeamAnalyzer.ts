/**
 * ContinuousBeamAnalyzer — Sürekli Kiriş Analizi
 * 
 * Üç Moment Denklemi (Clapeyron / Three-Moment Theorem):
 * M_{i-1}*L_{i-1}/I_{i-1} + 2*M_i*(L_{i-1}/I_{i-1} + L_i/I_i) + M_{i+1}*L_i/I_i
 *   = -6*E*(theta_i_left + theta_i_right + settlement terms)
 * 
 * Desteklenen yük tipleri:
 * - Tekil yük (Point Load): konum ve büyüklük
 * - Yayılı yük (UDL): başlangıç/bitiş pozisyonu ve büyüklük
 * - Mesnet çökmesi: her mesnet için ayrı
 */

export interface ContinuousSpan {
    length: number;       // m
    EI: number;           // kN·m² (E in kN/m², I in m^4)
    loads: SpanLoad[];
    settlement_start?: number; // m (downward positive)
    settlement_end?: number;   // m
}

export interface SpanLoad {
    type: 'point' | 'udl';
    magnitude: number;  // kN for point,  kN/m for udl
    /** For point load: distance from left support (m) */
    position?: number;
    /** For udl: start and end positions within span */
    startPos?: number;
    endPos?: number;
}

export interface ContinuousSpanResult {
    spanIndex: number;
    M_left: number;   // kNm — moment at left support
    M_right: number;  // kNm — moment at right support
    reactions: { left: number; right: number }; // kN
    /** Points along the span for diagrams */
    points: { x: number; shear: number; moment: number }[];
}

export interface ContinuousBeamResult {
    /** Support moments [M_0, M_1, ..., M_n] — inner supports are solved via 3-moment eqn */
    supportMoments: number[];
    spans: ContinuousSpanResult[];
    reactions: number[]; // total reaction at each support (kN)
}

export class ContinuousBeamAnalyzer {

    /**
     * Solve a continuous beam using the Three-Moment Equation (Clapeyron).
     * Boundary conditions: M_0 = 0 (pinned/roller start), M_n = 0 (pinned/roller end).
     * Fixed end supports can be modeled by adding a zero-length fictitious span.
     */
    static analyze(spans: ContinuousSpan[]): ContinuousBeamResult {
        const n = spans.length; // number of spans
        // Number of internal supports (intermediate nodes): n-1
        // Total support moments: n+1 (index 0 to n)
        // Boundary moments: M[0] = 0, M[n] = 0 (simply supported ends)

        // --- Step 1: Calculate 6A*abar/L and 6A*bbar/L for each span ---
        // These are the "load terms" in the three-moment equation
        const loadTermLeft: number[] = [];  // 6 * A * a_bar / (L * EI) for each span (contribution to left joint)
        const loadTermRight: number[] = []; // 6 * A * b_bar / (L * EI) for each span (contribution to right joint)

        for (let i = 0; i < n; i++) {
            const span = spans[i];
            const L = span.length;
            const EI = span.EI;
            let sixAabar = 0; // 6*A*abar / L
            let sixAbbar = 0; // 6*A*bbar / L

            for (const load of span.loads) {
                if (load.type === 'point' && load.position !== undefined) {
                    const P = load.magnitude;
                    const a = load.position;
                    const b = L - a;
                    // Three-moment load factors for concentrated load P at distance a from left
                    // 6Aabar/L = P*a*(L^2 - a^2) / L
                    // 6Abbar/L = P*b*(L^2 - b^2) / L
                    sixAabar += P * a * (L * L - a * a) / L;
                    sixAbbar += P * b * (L * L - b * b) / L;
                } else if (load.type === 'udl') {
                    const w = load.magnitude;
                    const a = load.startPos ?? 0;
                    const b_end = load.endPos ?? L;
                    const loaded_length = b_end - a;
                    if (loaded_length <= 0) continue;

                    // For full-span UDL: 6Aabar/L = 6Abbar/L = w*L^3/4
                    // For partial UDL, integrate numerically with 50 strips
                    const N = 50;
                    const dx = loaded_length / N;
                    for (let k = 0; k < N; k++) {
                        const x = a + (k + 0.5) * dx; // position of strip center
                        const dP = w * dx;
                        const bbar = L - x;
                        sixAabar += dP * x * (L * L - x * x) / L;
                        sixAbbar += dP * bbar * (L * L - bbar * bbar) / L;
                    }
                }
            }

            loadTermLeft.push(sixAabar / EI);
            loadTermRight.push(sixAbbar / EI);
        }

        // --- Step 2: Assemble Three-Moment Equations for internal joints ---
        // For joint i (internal):
        // M_{i-1}*(L_{i-1}/EI_{i-1}) + 2*M_i*(L_{i-1}/EI_{i-1} + L_i/EI_i) + M_{i+1}*(L_i/EI_i)
        //   = -loadTermRight[i-1] - loadTermLeft[i] + δ_i_terms

        // There are n-1 internal joints → n-1 equations, n-1 unknowns (M_1 to M_{n-1})
        // We know M_0 = 0 and M_n = 0 (both ends pinned/roller)

        const numUnknowns = n - 1;
        if (numUnknowns <= 0) {
            // Single span — no internal joints; statically determinate
            return this.solveSingleSpan(spans[0]);
        }

        const A_mat = Array.from({ length: numUnknowns }, () => Array(numUnknowns).fill(0));
        const b_vec = Array(numUnknowns).fill(0);

        for (let eq = 0; eq < numUnknowns; eq++) {
            const i = eq + 1; // joint index (1 to n-1)
            const spanLeft = spans[i - 1];
            const spanRight = spans[i];

            const Ll_EI = spanLeft.length / spanLeft.EI;
            const Lr_EI = spanRight.length / spanRight.EI;

            // Coefficient of M_{i-1}
            if (eq > 0) {
                A_mat[eq][eq - 1] = Ll_EI;
            }
            // Coefficient of M_i
            A_mat[eq][eq] = 2 * (Ll_EI + Lr_EI);
            // Coefficient of M_{i+1}
            if (eq < numUnknowns - 1) {
                A_mat[eq][eq + 1] = Lr_EI;
            }

            // RHS: load terms + settlement terms
            let rhs = -(loadTermRight[i - 1] + loadTermLeft[i]);

            // Settlement contribution: 6E * (delta_{i-1} / L_{i-1} - delta_i*(1/L_{i-1} + 1/L_i) + delta_{i+1}/L_i)
            // where delta is downward settlement (positive = down → negative in beam convention)
            // Here EI cancels when pre-divided by L/EI:
            const d_prev = (i === 1 ? (spanLeft.settlement_start ?? 0) : 0);
            const d_cur = spanLeft.settlement_end ?? 0;
            const d_next = spanRight.settlement_end ?? 0;
            // Add to rhs: 6*(d_prev/L_left - d_cur*(1/L_left+1/L_right) + d_next/L_right)
            // factored by EI (already accounted for in equation form)
            rhs += 6 * (d_prev / spanLeft.length - d_cur * (1 / spanLeft.length + 1 / spanRight.length) + d_next / spanRight.length);

            b_vec[eq] = rhs;
        }

        // --- Step 3: Solve the tridiagonal system ---
        const M_inner = this.solveTridiagonal(A_mat, b_vec);

        const supportMoments = [0, ...M_inner, 0]; // M_0=0, M_n=0

        // --- Step 4: Calculate member reactions and build diagram points ---
        const spanResults: ContinuousSpanResult[] = [];
        const reactions = Array(n + 1).fill(0);

        for (let i = 0; i < n; i++) {
            const span = spans[i];
            const L = span.length;
            const M_L = supportMoments[i];
            const M_R = supportMoments[i + 1];

            // Free-body diagram of span i:
            // Sum moments about right end: R_left * L = M_R - M_L + (load contributions)
            let momentLoadContrib = 0; // Sum of (Load * distance from right) for simple beam
            for (const load of span.loads) {
                if (load.type === 'point' && load.position !== undefined) {
                    const b = L - load.position;
                    momentLoadContrib += load.magnitude * b;
                } else if (load.type === 'udl') {
                    const a = load.startPos ?? 0;
                    const b_end = load.endPos ?? L;
                    const wL = load.magnitude * (b_end - a);
                    const x_centroid = (a + b_end) / 2;
                    momentLoadContrib += wL * (L - x_centroid);
                }
            }

            const R_left = (M_R - M_L + momentLoadContrib) / L;
            let totalLoad = 0;
            for (const load of span.loads) {
                if (load.type === 'point') totalLoad += load.magnitude;
                else if (load.type === 'udl') totalLoad += load.magnitude * ((load.endPos ?? L) - (load.startPos ?? 0));
            }
            const R_right = totalLoad - R_left;

            reactions[i] += R_left;
            reactions[i + 1] += R_right;

            // Build shear/moment diagram
            const STEPS = 50;
            const points: ContinuousSpanResult['points'] = [];
            for (let k = 0; k <= STEPS; k++) {
                const x = (k / STEPS) * L;
                const { shear, moment } = this.calculateAtX(span, x, R_left, M_L);
                points.push({ x, shear, moment });
            }

            spanResults.push({
                spanIndex: i,
                M_left: M_L,
                M_right: M_R,
                reactions: { left: R_left, right: R_right },
                points
            });
        }

        return { supportMoments, spans: spanResults, reactions };
    }

    private static solveSingleSpan(span: ContinuousSpan): ContinuousBeamResult {
        const L = span.length;
        let totalLoad = 0;
        let momentAboutRight = 0;
        for (const load of span.loads) {
            if (load.type === 'point' && load.position !== undefined) {
                totalLoad += load.magnitude;
                momentAboutRight += load.magnitude * (L - load.position);
            } else if (load.type === 'udl') {
                const a = load.startPos ?? 0;
                const b_end = load.endPos ?? L;
                const wL = load.magnitude * (b_end - a);
                totalLoad += wL;
                momentAboutRight += wL * (L - (a + b_end) / 2);
            }
        }
        const R_left = momentAboutRight / L;
        const R_right = totalLoad - R_left;
        const STEPS = 50;
        const points = [];
        for (let k = 0; k <= STEPS; k++) {
            const x = (k / STEPS) * L;
            const { shear, moment } = this.calculateAtX(span, x, R_left, 0);
            points.push({ x, shear, moment });
        }
        return {
            supportMoments: [0, 0],
            spans: [{ spanIndex: 0, M_left: 0, M_right: 0, reactions: { left: R_left, right: R_right }, points }],
            reactions: [R_left, R_right]
        };
    }

    private static calculateAtX(
        span: ContinuousSpan, x: number, R_left: number, M_left: number
    ): { shear: number; moment: number } {
        let shear = R_left;
        let moment = M_left + R_left * x;

        for (const load of span.loads) {
            if (load.type === 'point' && load.position !== undefined && load.position <= x) {
                shear -= load.magnitude;
                moment -= load.magnitude * (x - load.position);
            } else if (load.type === 'udl') {
                const a = load.startPos ?? 0;
                const b_end = load.endPos ?? span.length;
                if (a < x) {
                    const x2 = Math.min(x, b_end);
                    const loaded = x2 - a;
                    shear -= load.magnitude * loaded;
                    moment -= load.magnitude * loaded * (x - a - loaded / 2);
                }
            }
        }

        return { shear, moment };
    }

    /** Solve a general (possibly non-tridiagonal for small systems) linear system via Gaussian elimination */
    private static solveTridiagonal(A: number[][], b: number[]): number[] {
        const n = b.length;
        // Forward elimination
        for (let i = 0; i < n; i++) {
            // Pivot
            let maxRow = i;
            for (let k = i + 1; k < n; k++) {
                if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) maxRow = k;
            }
            [A[i], A[maxRow]] = [A[maxRow], A[i]];
            [b[i], b[maxRow]] = [b[maxRow], b[i]];

            if (Math.abs(A[i][i]) < 1e-12) continue;
            for (let k = i + 1; k < n; k++) {
                const factor = A[k][i] / A[i][i];
                for (let j = i; j < n; j++) A[k][j] -= factor * A[i][j];
                b[k] -= factor * b[i];
            }
        }
        // Back substitution
        const x = Array(n).fill(0);
        for (let i = n - 1; i >= 0; i--) {
            x[i] = b[i];
            for (let j = i + 1; j < n; j++) x[i] -= A[i][j] * x[j];
            x[i] /= A[i][i];
        }
        return x;
    }
}
