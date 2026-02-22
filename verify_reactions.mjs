// Quick analytical verification of BeamAnalyzer reaction cases
// Tests the statics formulas used in the new generateResults()

function verifySimplySupported(testName, loads, xA, xB, expectedRA, expectedRB) {
    const span = xB - xA;
    let totalFy = 0;
    let momentAboutA = 0;

    for (const load of loads) {
        if (load.type === 'point') {
            const Fy = load.magnitude; // downward positive
            totalFy += Fy;
            momentAboutA += Fy * (load.position - xA);
        } else if (load.type === 'distributed') {
            const a = load.startPosition;
            const b = load.endPosition;
            const w1 = load.magnitude;
            const w2 = load.endMagnitude ?? w1;
            const F_trap = (w1 + w2) / 2 * (b - a);
            const centroid = a + (b - a) * (2 * w2 + w1) / (3 * (w1 + w2));
            totalFy += F_trap;
            momentAboutA += F_trap * (centroid - xA);
        } else if (load.type === 'moment') {
            momentAboutA += load.magnitude;
        }
    }

    const RB = momentAboutA / span;
    const RA = totalFy - RB;

    const ok = (r, exp) => Math.abs(r - exp) < 0.001 ? '✅' : `❌ (expected ${exp})`;
    console.log(`\n${testName}`);
    console.log(`  RA = ${RA.toFixed(4)} kN  ${ok(RA, expectedRA)}`);
    console.log(`  RB = ${RB.toFixed(4)} kN  ${ok(RB, expectedRB)}`);
}

// Test 1: UDL w=10 kN/m over full span L=10m
// Expected: RA = RB = 50 kN
verifySimplySupported('Test 1: UDL 10 kN/m, L=10m',
    [{ type: 'distributed', magnitude: 10, endMagnitude: 10, startPosition: 0, endPosition: 10, position: 0 }],
    0, 10,
    50, 50
);

// Test 2: Point load 20 kN at midspan (x=5)
// Expected: RA = RB = 10 kN
verifySimplySupported('Test 2: Point load 20 kN at x=5, L=10m',
    [{ type: 'point', magnitude: 20, position: 5 }],
    0, 10,
    10, 10
);

// Test 3: Point load 30 kN at x=2 (off-center)
// Expected: RA = 30*(10-2)/10 = 24 kN, RB = 30*2/10 = 6 kN
verifySimplySupported('Test 3: Point load 30 kN at x=2, L=10m',
    [{ type: 'point', magnitude: 30, position: 2 }],
    0, 10,
    24, 6
);

// Test 4: Triangular load (0 at x=0, 20 kN/m at x=10)
// Resultant = 20*10/2 = 100 kN at centroid = 2/3*10 = 6.667m from A
// RA = 100*(10-6.667)/10 = 33.333 kN, RB = 100*6.667/10 = 66.667 kN
verifySimplySupported('Test 4: Triangular load 0→20 kN/m, L=10m',
    [{ type: 'distributed', magnitude: 0, endMagnitude: 20, startPosition: 0, endPosition: 10, position: 0 }],
    0, 10,
    33.333, 66.667
);

// Test 5: UDL 10 kN/m partial (x=2 to x=8)
// Resultant = 10*6 = 60 kN at centroid x=5
// RA = 60*(10-5)/10 = 30 kN, RB = 60*5/10 = 30 kN
verifySimplySupported('Test 5: Partial UDL 10 kN/m from x=2 to x=8, L=10m',
    [{ type: 'distributed', magnitude: 10, endMagnitude: 10, startPosition: 2, endPosition: 8, position: 2 }],
    0, 10,
    30, 30
);

console.log('\nAll tests complete.');
