// COMPREHENSIVE GERBER BEAM VERIFICATION
// Mirrors the exact algorithm in BeamAnalyzer.ts generateResults Path C
// using the corrected sign convention: R = loadFy + Vr - Vl

function loadResultant(loads, xRef, xa, xb) {
    const hasRange = xa !== undefined && xb !== undefined;
    let Fy = 0, M = 0;
    loads.forEach(load => {
        if (load.type === 'point') {
            const pos = load.position;
            if (hasRange && (pos < xa - 1e-9 || pos > xb + 1e-9)) return;
            const fy = load.magnitude * Math.sin((load.angle ?? 90) * Math.PI / 180);
            Fy += fy; M += fy * (pos - xRef);
        } else if (load.type === 'distributed') {
            const overS = hasRange ? Math.max(load.startPosition, xa) : load.startPosition;
            const overE = hasRange ? Math.min(load.endPosition, xb) : load.endPosition;
            if (overE <= overS + 1e-9) return;
            const totalLen = load.endPosition - load.startPosition;
            const ta = (overS - load.startPosition) / totalLen;
            const tb = (overE - load.startPosition) / totalLen;
            const w1 = load.magnitude, w2 = load.endMagnitude ?? w1;
            const wa = w1 + (w2 - w1) * ta, wb = w1 + (w2 - w1) * tb;
            const F = (wa + wb) / 2 * (overE - overS);
            const centroid = overS + (overE - overS) * (2 * wb + wa) / (3 * (wa + wb));
            Fy += F; M += F * (centroid - xRef);
        }
    });
    return { Fy, M };
}

function solveGerberNew(beamLength, hingeXs, supports, loads) {
    const cutXs = [0, ...hingeXs.sort((a, b) => a - b), beamLength];

    // cutShear[x] = net upward force to the LEFT of x (standard V convention)
    const cutShear = new Map();
    cutShear.set(0, 0);          // free left end
    cutShear.set(beamLength, 0); // free right end
    hingeXs.forEach(hx => cutShear.set(hx, null)); // unknown

    const segReactions = {};
    const solvedIds = new Set();

    let progress = true;
    let iter = 0;
    const maxIter = cutXs.length * 5;

    while (progress && solvedIds.size < supports.length && iter++ < maxIter) {
        progress = false;

        for (let si = 0; si < cutXs.length - 1; si++) {
            const xa = cutXs[si], xb = cutXs[si + 1];
            const leftV = cutShear.get(xa);
            const rightV = cutShear.get(xb);

            const segsupports = supports.filter(s => s.x >= xa - 1e-9 && s.x <= xb + 1e-9 && !solvedIds.has(s.id));
            const nUnkSup = segsupports.length;
            const nUnkV = (leftV === null ? 1 : 0) + (rightV === null ? 1 : 0);
            const totalUnk = nUnkSup + nUnkV;

            if (totalUnk > 2 || totalUnk === 0) continue;

            const { Fy: loadFy } = loadResultant(loads, xa, xa, xb);
            const Vl = leftV ?? 0;
            const Vr = rightV ?? 0;

            if (totalUnk === 2 && nUnkSup === 1 && nUnkV === 1) {
                const s = segsupports[0];
                if (leftV === null) {
                    // Left V unknown, right Vr known.
                    // Use ΣM@s to find Vl, then ΣFy for Rs.
                    const { M: loadMs_s } = loadResultant(loads, s.x, xa, xb);
                    let Vl_new, Rs_new;
                    if (Math.abs(s.x - xa) < 1e-9) {
                        // Support at xa: Vl has zero arm → can't solve from ΣM@s; skip
                        continue;
                    } else if (Math.abs(s.x - xb) < 1e-9) {
                        // Support at xb: ΣM@xb: Vl*(xa-xb) + loadMs_xb - Vr*0 = 0
                        const { M: loadMs_xb } = loadResultant(loads, xb, xa, xb);
                        Vl_new = loadMs_xb / (xb - xa);
                        Rs_new = loadFy + Vr - Vl_new;
                    } else {
                        // General: ΣM@s: Vl*(xa-s.x) + loadMs_s - Vr*(xb-s.x) = 0
                        Vl_new = (loadMs_s + Vr * (xb - s.x)) / (s.x - xa);
                        Rs_new = loadFy + Vr - Vl_new;
                    }
                    segReactions[s.id] = Rs_new;
                    solvedIds.add(s.id);
                    cutShear.set(xa, Vl_new);
                    progress = true;
                } else {
                    // leftV known, rightV null → ΣM@s to find Vr, then ΣFy for Rs
                    // ΣM@s: Vl*(s.x-xa) + loadMs - R_s*0 - Vr*(xb-s.x) = 0
                    // Wait, actually: Vl acts at xa, upward. Arm = (s.x - xa). Loads moment about s. Vr acts at xb, downward (it's going OUT). Arm = (xb - s.x).
                    // ΣM@s: Vl*(s.x-xa) + loadMs_about_s - Vr*(xb-s.x) = 0
                    // Using our sign (M from loads): loadMs with xRef=s.x
                    // But loadMs in downward-positive convention creates CW moments (positive).
                    // Vl upward at xa: CW moment about s if xa < s.x (i.e., s.x - xa > 0) = Vl*(s.x-xa)? 
                    // Actually: upward force Vl at xa creates CCW moment if xa < s.x (moment = +Vl*(s.x-xa))
                    // Downward loads create CW moment = positive loadMs
                    // Vr (outgoing, acts DOWNWARD on segment at xb) creates CW moment = +Vr*(xb-s.x) if xb > s.x
                    // ΣM@s = 0 (CCW pos): +Vl*(s.x-xa) - loadMs + Vr*(xb-s.x) = 0?  Hmm mixed up.
                    // Let me just derive from first principles:
                    // For segment [xa, xb], all upward forces = 0:
                    //   Vl (from left, upward at xa) + R_s (reaction at s.x, upward) - w_total - Vr (leaving right, = cutShear[xb]) = 0
                    // Moments about s.x CCW positive:
                    //   Vl*(xa - s.x) + M_loads_about_s + Vr*(xb - s.x) should balance: wait Vr is the OUTGOING shear.
                    //   Wait: Vr = cutShear[xb] = net upward to left of xb. If Vr > 0, then the segment is "losing" Vr upward to the right. From the segment's FBD, the right face has a downward force = Vr on it.
                    //   ΣM@s: (Vl acts at xa, upward = CCW if xa<s.x): Vl*(xa-s.x)... hmm signs.
                    //   Using: upward force F at position x creates moment about reference r of F*(x-r) (positive if x>r: CCW)
                    //   Vl at xa (upward): moment about s.x = Vl*(xa - s.x) [negative if xa < s.x, i.e. CW]
                    //   Loads (download, negative in CCW convention): contribute -loadMs where loadMs = sum(Fy_down * (pos-s.x))  
                    //   Vr: acts as downward at xb (negative), moment = -Vr*(xb-s.x) [CW if xb>s.x]
                    //   Rs at s.x: no arm = 0
                    // ΣM@s: Vl*(xa-s.x) - loadMs - Vr*(xb-s.x) = 0
                    // → Vr = (Vl*(xa-s.x) - loadMs) / (xb-s.x)
                    const { M: loadMs } = loadResultant(loads, s.x, xa, xb);
                    const Vr_new = (Vl * (xa - s.x) - loadMs) / (xb - s.x);
                    const Rs_new = loadFy + Vr_new - Vl;
                    segReactions[s.id] = Rs_new;
                    solvedIds.add(s.id);
                    cutShear.set(xb, Vr_new);
                    progress = true;
                }
            } else if (totalUnk === 2 && nUnkSup === 2 && nUnkV === 0) {
                const s1 = segsupports[0], s2 = segsupports[1];
                // ΣM@s1: Vl*(xa-s1.x) - loadMs1 - Vr*(xb-s1.x) - R2*(s2.x-s1.x) = 0
                // Wait: loads downward create -loadMs1 (CW). R2 at s2.x: moment about s1 = R2*(s2.x-s1.x) CCW (upward force to the right).
                // ΣM@s1: Vl*(xa-s1.x) - loadMs1 - Vr*(xb-s1.x) + R2*(s2.x-s1.x)... hmm
                // Let me be more careful. Using CCW positive, upward positive forces:
                //   Vl at xa (upward): Vl*(xa-s1.x) [CCW if xa>s1.x, else CW]
                //   R2 at s2.x (upward): R2*(s2.x-s1.x) [CCW since s2.x > s1.x]  
                //   Loads (downward, negative): -loadMs1 where loadMs1 = sum_of(Fy_down*(pos-s1.x))
                //   Vr (outgoing downward at xb): -(Vr)*(xb-s1.x) [CW]
                // ΣM@s1 = 0: Vl*(xa-s1.x) + R2*(s2.x-s1.x) - loadMs1 - Vr*(xb-s1.x) = 0
                // → R2 = (loadMs1 + Vr*(xb-s1.x) - Vl*(xa-s1.x)) / (s2.x-s1.x)
                const { M: loadMs1 } = loadResultant(loads, s1.x, xa, xb);
                const R2_fixed = (loadMs1 + Vr * (xb - s1.x) - Vl * (xa - s1.x)) / (s2.x - s1.x);
                const R1 = loadFy + Vr - Vl - R2_fixed;
                segReactions[s1.id] = R1;
                segReactions[s2.id] = R2_fixed;
                solvedIds.add(s1.id);
                solvedIds.add(s2.id);
                progress = true;
            } else if (totalUnk === 1 && nUnkSup === 1 && nUnkV === 0) {
                const s = segsupports[0];
                segReactions[s.id] = loadFy + Vr - Vl;
                solvedIds.add(s.id);
                progress = true;
            }

            // Propagate cut shear
            if (leftV === null && cutShear.get(xa) === null) {
                const totalR = segsupports.filter(s => segReactions[s.id] !== undefined).reduce((a, s) => a + segReactions[s.id], 0);
                cutShear.set(xa, loadFy + Vr - totalR);
            }
            if (rightV === null && cutShear.get(xb) === null) {
                const totalR = segsupports.filter(s => segReactions[s.id] !== undefined).reduce((a, s) => a + segReactions[s.id], 0);
                cutShear.set(xb, Vl + totalR - loadFy);
            }
        }
    }
    return segReactions;
}

const check = (val, exp, name) => {
    const ok = Math.abs(val - exp) < 0.01;
    console.log(`  ${name}: ${(val || 0).toFixed(4)} kN  ${ok ? '✅' : '❌ expected ' + exp}`);
    return ok;
};

let allPassed = true;
const test = (name, fn) => {
    console.log(`\n${name}`);
    if (!fn()) allPassed = false;
};

// TEST 1: Classic 2-support Gerber — A(pin,0)-hinge(4)-B(roller,10), P=20kN@x=2
// Expected: RA=10, RB=10  (from ΣM@hinge: RA*4 = 20*2 → RA=10, ΣFy: RB=10)
test('Test 1: A(0)-hinge(4)-B(10), P=20@x=2', () => {
    const r = solveGerberNew(10, [4],
        [{ id: 'A', x: 0 }, { id: 'B', x: 10 }],
        [{ type: 'point', magnitude: 20, position: 2 }]);
    return check(r['A'], 10, 'RA') & check(r['B'], 10, 'RB');
});

// TEST 2: 2-support Gerber — A(pin,0)-hinge(6)-B(roller,10), UDL 10kN/m full
// Expected: RA=30 (ΣM@hinge: RA*6 = 10*6*3 = 180 → RA=30), RB=70
test('Test 2: A(0)-hinge(6)-B(10), UDL 10kN/m', () => {
    const r = solveGerberNew(10, [6],
        [{ id: 'A', x: 0 }, { id: 'B', x: 10 }],
        [{ type: 'distributed', magnitude: 10, endMagnitude: 10, startPosition: 0, endPosition: 10 }]);
    return check(r['A'], 30, 'RA') & check(r['B'], 70, 'RB');
});

// TEST 3: 3-support — A(0)-B(5)-hinge(7)-C(10), P=10@x=2.5
// Expected: RA=5, RB=5, RC=0 (from hinge condition: right segment empty → RC=0)
test('Test 3: A(0)-B(5)-hinge(7)-C(10), P=10@x=2.5', () => {
    const r = solveGerberNew(10, [7],
        [{ id: 'A', x: 0 }, { id: 'B', x: 5 }, { id: 'C', x: 10 }],
        [{ type: 'point', magnitude: 10, position: 2.5 }]);
    return check(r['A'], 5, 'RA') & check(r['B'], 5, 'RB') & check(r['C'], 0, 'RC');
});

// TEST 4: A(pin,0)-hinge(3)-B(roller,6)-C(roller,10), UDL 20kN/m
// Left seg [0,3]: ΣM@hinge: RA*3 = 20*3*1.5 = 90 → RA=30. cutShear[3]=30-60=-30
// Right seg [3,10]: ΣM@B(6): -30*(3-6)? Complex, use global check
// Global: RA+RB+RC = 20*10 = 200; from right seg [3,10] with segsupports=[B@6,C@10]
// ΣM@B: Vl*(xa-xB) + loadMs_right_about_B - Vr*(xb-xB) - R_C*(xC-xB) = 0
// ΣM@B(6): (-30)*(3-6) + load(xa=3,xb=10,s=6) - 0 - RC*(10-6) = 0
// load moment about 6: 20*7=140, centroid of [3,10] at x=6.5, so M_about_6 = 20*7*(6.5-6) = 70
// (-30)*(-3) + 70 - RC*4 = 0 → 90 + 70 = RC*4 → RC = 40
// RB = loadFy_right + Vr - Vl - RC = 20*7 + 0 - (-30) - 40 = 140 + 30 - 40 = 130? 
// Hmm let me just run and check global equilibrium.
test('Test 4: A(0)-hinge(3)-B(6)-C(10), UDL 20kN/m', () => {
    const r = solveGerberNew(10, [3],
        [{ id: 'A', x: 0 }, { id: 'B', x: 6 }, { id: 'C', x: 10 }],
        [{ type: 'distributed', magnitude: 20, endMagnitude: 20, startPosition: 0, endPosition: 10 }]);
    console.log(`  RA=${(r['A'] || 0).toFixed(4)}, RB=${(r['B'] || 0).toFixed(4)}, RC=${(r['C'] || 0).toFixed(4)}`);
    const total = (r['A'] || 0) + (r['B'] || 0) + (r['C'] || 0);
    const totalLoad = 20 * 10;
    const eq = Math.abs(total - totalLoad) < 0.01;
    console.log(`  Total reactions = ${total.toFixed(4)}, load = ${totalLoad}  ${eq ? '✅ equilibrium OK' : '❌ NOT in equilibrium'}`);
    // RA from left seg: RA*3 = 20*3*1.5 = 90 → RA=30
    return check(r['A'], 30, 'RA') & eq;
});

// TEST 5: No hinge, simply supported — verify Path B still works
// A(0), B(10), P=20@x=3 → RA=14, RB=6
test('Test 5 (no hinge, reference): A(0)-B(10), P=20@x=3', () => {
    // This is not a Gerber, use Path B directly  
    const loads = [{ type: 'point', magnitude: 20, position: 3 }];
    const xA = 0, xB = 10;
    const { Fy: totalFy, M: mAboutA } = loadResultant(loads, xA, undefined, undefined);
    const RB = mAboutA / (xB - xA);
    const RA = totalFy - RB;
    return check(RA, 14, 'RA') & check(RB, 6, 'RB');
});

console.log(`\n${allPassed ? '🎉 ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
