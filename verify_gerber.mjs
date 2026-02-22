// Gerber beam analytical verification
// Tests the classical segment-cut method embedded in generateResults (Path C)

// Simulate the segLoadResultant function
function segLoadResultant(loads, xa, xb, xRef) {
    let Fy = 0, M = 0;
    loads.forEach(load => {
        if (load.type === 'point') {
            const pos = load.position;
            if (pos > xa - 1e-9 && pos < xb + 1e-9) {
                const ar = (load.angle ?? 90) * Math.PI / 180;
                const fy = load.magnitude * Math.sin(ar);
                Fy += fy; M += fy * (pos - xRef);
            }
        } else if (load.type === 'distributed' && load.startPosition !== undefined && load.endPosition !== undefined) {
            const overlapStart = Math.max(load.startPosition, xa);
            const overlapEnd = Math.min(load.endPosition, xb);
            if (overlapEnd > overlapStart) {
                const segLen = load.endPosition - load.startPosition;
                const ta = (overlapStart - load.startPosition) / segLen;
                const tb = (overlapEnd - load.startPosition) / segLen;
                const wa = load.magnitude + ((load.endMagnitude ?? load.magnitude) - load.magnitude) * ta;
                const wb = load.magnitude + ((load.endMagnitude ?? load.magnitude) - load.magnitude) * tb;
                const F = (wa + wb) / 2 * (overlapEnd - overlapStart);
                const centroid = overlapStart + (overlapEnd - overlapStart) * (2 * wb + wa) / (3 * (wa + wb));
                Fy += F; M += F * (centroid - xRef);
            }
        }
    });
    return { Fy, M };
}

// Simulate the Gerber segment-cut solver from Path C
function solveGerber(beamLength, hingeXs, supports, loads) {
    const cutXs = [0, ...hingeXs.sort((a, b) => a - b), beamLength];
    const shearAtCut = {};
    shearAtCut[0] = 0;
    shearAtCut[beamLength] = 0;
    const segmentResults = {};
    let ok = true;

    for (let si = cutXs.length - 2; si >= 0; si--) {
        const xa = cutXs[si], xb = cutXs[si + 1];
        const leftShear = shearAtCut[xa] ?? 0;
        const rightShear = shearAtCut[xb] ?? 0;

        const segsupports = supports.filter(s => s.x >= xa - 1e-9 && s.x <= xb + 1e-9);
        const { Fy: loadFy, M: loadM } = segLoadResultant(loads, xa, xb, xa);

        if (segsupports.length === 0) continue;
        else if (segsupports.length === 1) {
            const s = segsupports[0];
            const Ry = loadFy + leftShear - rightShear;
            segmentResults[s.id] = Ry;
        } else if (segsupports.length === 2) {
            const s1 = segsupports[0], s2 = segsupports[1];
            const { Fy: tFy, M: mAboutS1 } = segLoadResultant(loads, xa, xb, s1.x);
            const mAdj = mAboutS1 + leftShear * (xa - s1.x) - rightShear * (xb - s1.x);
            const R2 = mAdj / (s2.x - s1.x);
            const R1 = tFy + leftShear - rightShear - R2;
            segmentResults[s1.id] = R1;
            segmentResults[s2.id] = R2;
        } else { ok = false; break; }

        if (si > 0) {
            const totalR = segsupports.reduce((a, s) => a + (segmentResults[s.id] || 0), 0);
            shearAtCut[xa] = loadFy - totalR + rightShear;
        }
    }
    return { ok, results: segmentResults };
}

const check = (val, exp, label) => {
    const ok = Math.abs(val - exp) < 0.01;
    console.log(`  ${label}: ${val.toFixed(4)} kN  ${ok ? '✅' : '❌ expected ' + exp}`);
};

// TEST 1: Classic Gerber — A(pin,0), hinge(4), B(roller,10), P=20kN at x=2
// Cut at hinge: left seg → ΣM@hinge: RA×4 = 20×2 → RA=10, RB=10
console.log('\nTest 1: Gerber A(0)-hinge(4)-B(10), P=20kN @x=2');
{
    const { results } = solveGerber(10, [4], [{ id: 'A', x: 0 }, { id: 'B', x: 10 }], [
        { type: 'point', magnitude: 20, position: 2 }
    ]);
    check(results['A'], 10, 'RA');
    check(results['B'], 10, 'RB');
}

// TEST 2: Gerber — A(pin,0), hinge(6), B(roller,10), UDL 10kN/m full span
// Left seg [0,6]: ΣFy: RA + shear@6 = 10*6=60, ΣM@hinge: RA*6 = 10*6*3 → RA=30, V_hinge=-30+60=30 going left
// Right seg [6,10]: V_hinge(left) + RB = 10*4=40 → RB=40-30=10? 
// Use proper: left seg: ΣM@6: RA*6 = 10*6*3 = 180 → RA=30
//             right seg: ΣFy: RB = 10*4 = 40 (no left shear onto right... wait)
// Actually: left seg shear at hinge = RA - 10*6 = 30-60 = -30 (net upward = -30, i.e. 30 down)
// Right seg gets +30 (upward on left face): ΣFy: 30 - 10*4 + RB = 0 → RB = 40-30 = 10 ✓
// Global check: RA+RB = 30+10 = 40 = total load 10*10/2...wait L=10, UDL=10: total=100. RA=30 only if hinge is at 6... Hmm
// Let me recalculate: with hinge at x=6, A at x=0, B at x=10
// Left segment [0,6]: load = 10*6=60 kN, centroid at x=3
// ΣM@hinge(6): RA*6 - 60*3 = 0 → RA = 30 kN
// Shear just left of hinge = RA - 60 = 30 - 60 = -30 kN (downward on left face)
// Shear just right of hinge = 30 kN (upward on right face, for right segment)
// Right segment [6,10]: load = 10*4=40, centroid at x=8
// ΣFy: 30 - 40 + RB = 0 → RB = 10 kN ✓ Total: 30+10=40... but total load = 10*10=100???
// Wait, hinge at x=6, UDL full span means left segment has 60kN, right has 40kN. Total = 100kN
// RA+RB = 30+10 = 40 kN ≠ 100 kN → WRONG.
// Something is wrong with the shear propagation logic...
// Let me recalculate more carefully.
// The issue: the algorithm uses shearAtCut[L]=0 initially (right end, free end).
// For right segment [6,10]: rightShear = shearAtCut[10] = 0 (free end)
// leftShear = shearAtCut[6] (unknown at start, starts at 0? No, that's the problem)
// The algorithm processes right-to-left, so for the RIGHTMOST segment first:
//   si = 1 (segment [6,10]): xa=6, xb=10, leftShear=shearAtCut[6]=0 (not set yet), rightShear=0
//   segsupports = [B at x=10]
//   loadFy = 40, Ry_B = 40 + 0 - 0 = 40
//   Update shearAtCut[6] = 40 - 40 + 0 = 0 (wrong!)
// Then si=0 (segment [0,6]): xa=0, xb=6, leftShear=0, rightShear=shearAtCut[6]=0
//   segsupports = [A at x=0]  
//   loadFy = 60, Ry_A = 60 + 0 - 0 = 60 (WRONG, should be 60 only for full-seg with no hinge condition)
// This gives RA=60, RB=40 which is wrong for Gerber...

// AH, I see the problem. The shear propagation is NOT correctly using the hinge condition.
// The issue: for the rightmost segment [6,10], the leftShear at the hinge boundary should be UNKNOWN,
// not pre-set to 0. The algorithm assumes rightShear=0 at free ends, but leftShear at a hinge 
// should be computed from the RIGHT-TO-LEFT traversal...
// Actually the algorithm should work from right to left, computing shear at each hinge from the
// solved right segment. Let me trace again:

// RIGHT segment [6,10]: 
//   rightShear = shearAtCut[10] = 0 (free end - correct for roller/pin with no overhang)
//   Wait, B is a roller at x=10. The "right shear" at x=10 should be 0 (nothing to the right of B).
//   segsupports has B at x=10, so: Ry_B = loadFy + leftShear - rightShear = 40 + leftShear - 0
//   But leftShear is shearAtCut[6] which is 0 (not yet set) → Ry_B = 40 (WRONG)
//   Then shearAtCut[6] = loadFy - totalR + rightShear = 40 - 40 + 0 = 0 (WRONG)

// For LEFT segment [0,6]:
//   leftShear = shearAtCut[0] = 0 (this is correct - nothing to left of beam)
//   rightShear = shearAtCut[6] = 0 (just set, but WRONG)
//   Ry_A = 60 + 0 - 0 = 60 (WRONG)

// So the shear propagation is broken. The issue: the right segment [6,10] should NOT 
// use Ry_B = loadFy at that point, but rather Ry_B should be solved FROM the hinge condition.
// The algorithm doesn't know the left shear at the hinge until the left segment is processed.

// I think the algorithm needs to be fixed. The correct approach:
// - Process LEFT segment first (using M@hinge = 0 condition to find RA)
// - Then use RA to compute shear at hinge
// - Then solve right segment using that shear

// For a standard Gerber: hinge between A-side and B-side:
// 1. Left seg: ΣM@hinge = 0 gives RA
// 2. Shear at hinge (from left) = RA - sum_of_loads_left
// 3. Right seg: ΣFy (with known shear at hinge from left) gives RB

// But the code processes RIGHT-TO-LEFT. For 2-support Gerber:
// - First processes right segment [hinge, B] with UNKNOWN left shear  
// - This is solvable only with ΣFy but can't give RB without knowing V_hinge!

// The correct method:
// For each segment, we have 2 equations (ΣFy, ΣM) and:
//   - 1 known boundary (left or right shear, 0 at free end)
//   - 1 unknown boundary
//   - N unknown reactions
// So we need: known_shears + N_reactions = 2 equations available
// → N_reactions = 2 - 1 = 1 (so exactly 1 unknown reaction per segment when both ends are known)

// The issue: for the MIDDLE segment or a segment without free ends, both shears are unknown.
// Solution: process from BOTH ends inward, or process from the side with more known info.

// Better algorithm: Start from FREE ENDS (segments that have a free/known boundary), solve outward.

console.log('\nTest 2 (debug trace): Gerber A(0)-hinge(6)-B(10), UDL 10kN/m');
{
    // Expected: RA=30, RB=70? Let me compute:
    // ΣM@hinge(6): RA*6 = 10*6*3 → RA = 30
    // ΣFy: RA + RB = 100 → RB = 70
    const { results } = solveGerber(10, [6], [{ id: 'A', x: 0 }, { id: 'B', x: 10 }], [
        { type: 'distributed', magnitude: 10, endMagnitude: 10, startPosition: 0, endPosition: 10, position: 0 }
    ]);
    check(results['A'] || 0, 30, 'RA');
    check(results['B'] || 0, 70, 'RB');
}

// TEST 3: 3-support Gerber — A(pin,0), B(roller,5), hinge(7), C(roller,10)
// This is indeterminate without hinge → determinate with hinge
// Expected from hand calc...
console.log('\nTest 3: 3-support A(0)-B(5)-hinge(7)-C(10), P=10kN @x=2.5');
{
    // Right segment [7,10]: C at x=10, rightShear=0
    // loadFy = 0 (no load in [7,10]), Ry_C = 0 + V_hinge - 0 = V_hinge (unknown)
    // Left segment [0,7]: A(0), B(5)
    // ΣM@7 = RA*7 + RB*2 = 10*4.5 = 45 ... (1)
    // ΣFy: RA + RB - 10 + RC = 0 ... (2)
    // Shear just left of hinge = RA + RB - 10 (upward net)
    // For M@hinge = 0: right segment shear into hinge = RC (upward on right face)
    // Shear left of hinge (downward on left face) = RC (equilibrium at hinge)
    // So: RA + RB - 10 = RC ... (3)
    // From ΣM@7: RA*7 + RB*2 = 10*4.5 = 45 → RA*7 + RB*2 = 45 ... (1)
    // ΣM@A: RB*5 = 10*2.5 - RC*10 (taking full beam moments about A)
    // Hmm, need to use hinge condition more carefully.
    // Left of hinge [0,7]: ΣM about hinge: RA*7 + RB*2 - 10*(7-2.5) = 0
    //   RA*7 + RB*2 = 10*4.5 = 45 ... (1)
    // Right of hinge [7,10]: ΣM about hinge: RC*(10-7) - 0 = 0... wait
    //   ΣM@hinge for right part: RC*(10-7) = 0 → RC = 0! 
    //   Hmm that's weird. Let me check: right segment [7,10] has no loads, so:
    //   ΣM@hinge(x=7) = RC * (10-7) = 0 → RC = 0
    //   Then from shear: V_hinge = RC = 0
    // Left segment: ΣFy: RA + RB - 10 = V_hinge_right = 0 → RA + RB = 10 ... (2)
    //   ΣM@A: RB*5 - 10*2.5 - 0*(7 - hinge) = 0 → RB = 25/5 = 5
    //   RA = 10 - 5 = 5
    // So: RA=5, RB=5, RC=0
    const { results: r3 } = solveGerber(10, [7], [{ id: 'A', x: 0 }, { id: 'B', x: 5 }, { id: 'C', x: 10 }], [
        { type: 'point', magnitude: 10, position: 2.5 }
    ]);
    check(r3['A'] || 0, 5, 'RA');
    check(r3['B'] || 0, 5, 'RB');
    check(r3['C'] || 0, 0, 'RC');
}

console.log('\nDone. Note: failures mean the algorithm needs revision.');
