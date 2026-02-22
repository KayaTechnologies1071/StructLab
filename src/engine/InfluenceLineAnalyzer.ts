/**
 * InfluenceLineAnalyzer — Tesir Çizgisi Hesabı
 *
 * Yöntem: Birim yük (1 kN) kirişi boyunca hareket ettirilir.
 * Her konumda BeamAnalyzer çağrılarak ilgilenilen nokta/kesit için:
 *   - Tepki kuvveti (reaction)
 *   - Kesme kuvveti (shear at section)
 *   - Eğilme momenti (moment at section)
 * hesaplanır ve tesir çizgisi oluşturulur.
 *
 * ÖNEMLİ:
 *   - Geçici kirişten asıl yükler ÇIKARILIR — sadece birim yük uygulanır.
 *     (Yoksa sürekli yükün etkisi ordinate'lere karışır ve sonuçlar yanlış çıkar.)
 *   - Kesme için kesit SOL tarafına en yakın nokta kullanılır.
 *     (Yük tam kesit üzerindeyken sağ taraftan okumak yanlış sonuç verir.)
 *   - Bu hesap ağır olduğundan sadece "Hesapla" butonuyla tetiklenir.
 */

import { BeamAnalyzer } from './BeamAnalyzer';
import type { Beam } from '../features/beam/types';

export type InfluenceTarget =
    | { type: 'reaction'; supportId: string }
    | { type: 'shear'; position: number }
    | { type: 'moment'; position: number };

export interface InfluenceLinePoint {
    loadPosition: number;  // x position of the moving unit load
    value: number;         // ordinate of influence line at this load position
}

export interface InfluenceLineResult {
    target: InfluenceTarget;
    points: InfluenceLinePoint[];
    maxPositive: number;
    maxNegative: number;
    /** Positions where load should be placed for maximum positive effect */
    favorablePositiveRange: { start: number; end: number }[];
    /** Positions where load should be placed for maximum negative effect */
    favorableNegativeRange: { start: number; end: number }[];
}

export class InfluenceLineAnalyzer {

    /**
     * Calculate an influence line by traversing a unit load along the beam.
     *
     * @param beam  - Base beam configuration. Existing loads on the beam are STRIPPED;
     *                only the moving unit load is applied per step. Supports + hinges kept.
     * @param target - What to compute the influence line for
     * @param steps  - Number of load positions (default 80)
     */
    static analyze(beam: Beam, target: InfluenceTarget, steps = 80): InfluenceLineResult {
        const points: InfluenceLinePoint[] = [];

        // Base beam WITHOUT any loads — only supports, hinges, EI are used
        const baseBeam: Beam = {
            ...beam,
            loads: [],          // ← strip all permanent loads
            temperatureLoad: undefined,
        };

        for (let k = 0; k <= steps; k++) {
            const loadPos = (k / steps) * beam.length;

            // For endpoints, a load exactly on a support is degenerate in FEM:
            // the support penalty absorbs the load so the nodal load effectively vanishes.
            // Instead, evaluate at a small offset from each endpoint and assign the correct
            // theoretical ordinate analytically (unit load AT a support → that support carries
            // the whole unit load, so R_own=1, R_other=0; moment and shear at interior sections = 0).
            const isAtStart = k === 0;
            const isAtEnd = k === steps;

            if (isAtStart) {
                // Müller-Breslau: unit load at x=0 — reactions: all supports in order of position.
                // Simple case: first support (leftmost) takes R=1, rest R=0; moment at any section = 0.
                let value = 0;
                if (target.type === 'reaction') {
                    const sorted = [...beam.supports].sort((a, b) => a.position - b.position);
                    const firstId = sorted[0]?.id;
                    value = target.supportId === firstId ? 1 : 0;
                }
                // shear and moment = 0 (load on support produces no internal forces)
                points.push({ loadPosition: loadPos, value });
                continue;
            }

            if (isAtEnd) {
                // Unit load at x=L (last support)
                let value = 0;
                if (target.type === 'reaction') {
                    const sorted = [...beam.supports].sort((a, b) => a.position - b.position);
                    const lastId = sorted[sorted.length - 1]?.id;
                    value = target.supportId === lastId ? 1 : 0;
                }
                points.push({ loadPosition: loadPos, value });
                continue;
            }

            // Interior: unit load at safePos (clamped just in case)
            const safePos = Math.max(1e-5, Math.min(beam.length - 1e-5, loadPos));

            // Beam with only the unit downward load at this position
            const tempBeam: Beam = {
                ...baseBeam,
                loads: [
                    {
                        id: '__unit__',
                        type: 'point',
                        magnitude: 1,           // 1 kN downward
                        position: safePos,
                        angle: 90               // sin(90°)=1 → Fy = -1 kN (downward in BeamAnalyzer sign convention)
                    }
                ]
            };

            let value = 0;
            try {
                const result = BeamAnalyzer.analyze(tempBeam);

                if (target.type === 'reaction') {
                    // Reactions are already stored by support id
                    value = result.reactions[target.supportId] ?? 0;

                } else if (target.type === 'shear') {
                    // For shear influence line: read the shear just to the LEFT of the section.
                    // This prevents picking up the jump that occurs when the unit load is
                    // exactly at (or within one diagram step of) the target section.
                    const section = target.position;
                    const diagrams = result.diagrams;
                    const EPS = beam.length / (steps * 2);

                    // Find the last diagram point strictly left of section
                    let bestIdx = -1;
                    for (let i = 0; i < diagrams.length; i++) {
                        if (diagrams[i].x < section - EPS) bestIdx = i;
                    }
                    if (bestIdx < 0) {
                        // If no point is to the left (section is at x=0), use first point
                        bestIdx = 0;
                    }
                    value = diagrams[bestIdx].shear;

                } else if (target.type === 'moment') {
                    // Moment is continuous across a load point —
                    // just find the closest point to the section
                    const section = target.position;
                    const diagrams = result.diagrams;
                    let closestIdx = 0;
                    let minDist = Infinity;
                    for (let i = 0; i < diagrams.length; i++) {
                        const d = Math.abs(diagrams[i].x - section);
                        if (d < minDist) { minDist = d; closestIdx = i; }
                    }
                    value = diagrams[closestIdx].moment;
                }

            } catch {
                value = 0;
            }

            points.push({ loadPosition: loadPos, value });
        }

        const values = points.map(p => p.value);
        const maxPositive = Math.max(0, ...values);
        const maxNegative = Math.min(0, ...values);

        // Identify favorable ranges
        const favorablePositiveRange: { start: number; end: number }[] = [];
        const favorableNegativeRange: { start: number; end: number }[] = [];
        this.extractRanges(points, v => v > 1e-9, favorablePositiveRange);
        this.extractRanges(points, v => v < -1e-9, favorableNegativeRange);

        return { target, points, maxPositive, maxNegative, favorablePositiveRange, favorableNegativeRange };
    }

    private static extractRanges(
        points: InfluenceLinePoint[],
        predicate: (v: number) => boolean,
        out: { start: number; end: number }[]
    ) {
        let rangeStart: number | null = null;
        for (const p of points) {
            if (predicate(p.value)) {
                if (rangeStart === null) rangeStart = p.loadPosition;
            } else {
                if (rangeStart !== null) {
                    out.push({ start: rangeStart, end: p.loadPosition });
                    rangeStart = null;
                }
            }
        }
        if (rangeStart !== null) {
            out.push({ start: rangeStart, end: points[points.length - 1].loadPosition });
        }
    }
}
