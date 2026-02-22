import { BeamAnalyzer } from './BeamAnalyzer';
import type { Beam } from '../features/beam/types';

// Mock Beam
const beam: Beam = {
    length: 6,
    supports: [
        { id: 's1', type: 'fixed', position: 0 },
        { id: 's2', type: 'roller', position: 6 }
    ],
    loads: [
        { id: 'l1', type: 'point', position: 1.5, magnitude: 10, angle: 90 }
    ],
    hinges: [
        { id: 'h1', position: 3 }
    ],
    elasticModulus: 200, // GPa
    momentOfInertia: 5000 // cm4 (needs conversion in analyzer?) 
    // Analyzer uses: E * 1e6 (kPa), I * 1e-8 (m4).
    // E=200 GPa = 200 * 10^6 kPa.
    // I=5000 cm4 = 5000 * 10^-8 m4.
};

console.log("Running Beam Analysis Verification...");

const result = BeamAnalyzer.analyze(beam);

console.log("Analysis Complete.");

// Check Moment at Hinge (x=3)
// We need to find the point closest to x=3 in results.diagrams
const hingePoint = result.diagrams.reduce((prev, curr) =>
    Math.abs(curr.x - 3) < Math.abs(prev.x - 3) ? curr : prev
);

console.log(`Moment at x=${hingePoint.x.toFixed(3)}: ${hingePoint.moment.toFixed(4)} kNm`);

if (Math.abs(hingePoint.moment) < 0.1) {
    console.log("PASS: Moment at hinge is approximately zero.");
} else {
    console.error("FAIL: Moment at hinge is NOT zero.");
}

// Check Max Deflection
console.log(`Max Deflection: ${result.maxDeflection.toFixed(6)} m`);

// Check Reaction at Fixed Support (Approx)
console.log("Reactions:", result.reactions);
console.log("Moment Reactions:", result.momentReaction);
