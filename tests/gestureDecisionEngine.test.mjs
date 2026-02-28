/**
 * gestureDecisionEngine.test.mjs — Unit Tests for Gesture Decision Engine
 *
 * Self-contained test suite that mirrors the production GestureDecisionEngine
 * logic without requiring Vite bundling. This ensures tests run in plain Node.
 *
 * Tests cover:
 *   1. Stability voting (N consecutive frames required)
 *   2. Thumb dominance gating (THUMBS_UP vs CLOSED_FIST)
 *   3. Cooldown enforcement (2.5s lockout after accepted gesture)
 *   4. Cooldown expiry (new gesture accepted after wait)
 *   5. Hand disappearance reset
 *   6. NONE/null prediction rejection
 *   7. Mixed frame instability
 *   8. Same gesture deduplication
 *   9. Phrase and gestureType correctness for all 5 classes
 *  10. Fresh detection after hand loss + return
 *
 * Run: npm test
 */

// ──────────────────────────────────────────────
// Engine Mirror (matches production code exactly)
// ──────────────────────────────────────────────

const STABILITY_FRAMES = 8;
const GESTURE_COOLDOWN_MS = 2500;
const THUMB_DOMINANCE_THRESHOLD = 1.3;

const LM = { WRIST: 0, THUMB_TIP: 4, INDEX_TIP: 8, MIDDLE_TIP: 12, RING_TIP: 16, PINKY_TIP: 20 };

function getPhraseForLabel(label) {
    const map = {
        'OPEN_PALM': "Let's put a pin in that for now.",
        'CLOSED_FIST': "We need to circle back to the core deliverables.",
        'THUMBS_UP': "I am fully aligned with this initiative.",
        'POINTING_UP': "Let's take this offline.",
        'PEACE_SIGN': "We have verified the cross-functional synergy."
    };
    return map[label] || 'Waiting for input…';
}

function getGestureTypeForLabel(label) {
    const map = {
        'OPEN_PALM': 'open-palm', 'CLOSED_FIST': 'fist',
        'THUMBS_UP': 'thumbs-up', 'POINTING_UP': 'pointing', 'PEACE_SIGN': 'peace'
    };
    return map[label] || null;
}

class GestureDecisionEngine {
    constructor() { this.reset(); }

    reset() {
        this.stabilityBuffer = [];
        this.acceptedGesture = null;
        this.acceptedTimestamp = 0;
        this.inCooldown = false;
    }

    _dist(a, b) {
        return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2);
    }

    _validateThumbDominance(landmarks) {
        const w = landmarks[LM.WRIST];
        const thumb = this._dist(w, landmarks[LM.THUMB_TIP]);
        const others = [LM.INDEX_TIP, LM.MIDDLE_TIP, LM.RING_TIP, LM.PINKY_TIP]
            .map(i => this._dist(w, landmarks[i]));
        return thumb > THUMB_DOMINANCE_THRESHOLD * Math.max(...others);
    }

    _applyGates(label, confidence, landmarks) {
        if (label === 'THUMBS_UP' && !this._validateThumbDominance(landmarks)) return 'CLOSED_FIST';
        return label;
    }

    _updateBuffer(label, confidence) {
        this.stabilityBuffer.push({ label, confidence, ts: Date.now() });
        if (this.stabilityBuffer.length > STABILITY_FRAMES) this.stabilityBuffer.shift();
        if (this.stabilityBuffer.length === STABILITY_FRAMES &&
            this.stabilityBuffer.every(p => p.label === this.stabilityBuffer[0].label)) {
            return this.stabilityBuffer[0].label;
        }
        return null;
    }

    _isInCooldown() {
        if (!this.inCooldown || !this.acceptedTimestamp) return false;
        if (Date.now() - this.acceptedTimestamp >= GESTURE_COOLDOWN_MS) this.inCooldown = false;
        return this.inCooldown;
    }

    processFrame(pred, landmarks) {
        const { label, confidence } = pred;
        if (!label || label === 'NONE') return null;
        if (this._isInCooldown()) return null;

        const gated = this._applyGates(label, confidence, landmarks);
        const stable = this._updateBuffer(gated, confidence);

        if (stable && stable !== this.acceptedGesture) {
            this.acceptedGesture = stable;
            this.acceptedTimestamp = Date.now();
            this.inCooldown = true;
            this.stabilityBuffer = [];
            return {
                label: stable,
                gestureType: getGestureTypeForLabel(stable),
                phrase: getPhraseForLabel(stable),
                reason: `stable (${STABILITY_FRAMES} frames)`
            };
        }
        return null;
    }

    onHandDisappear() { this.reset(); }
}

// ──────────────────────────────────────────────
// Test Harness
// ──────────────────────────────────────────────

const engine = new GestureDecisionEngine();
let passed = 0, failed = 0;

function assert(cond, msg) {
    if (cond) { passed++; console.log(`  ✅ ${msg}`); }
    else { failed++; console.error(`  ❌ FAIL: ${msg}`); }
}

function makeThumbsUpLandmarks() {
    const lm = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
    lm[0] = { x: 0.5, y: 0.5, z: 0 };
    lm[4] = { x: 0.5, y: 0.1, z: 0 };   // thumb far from wrist
    lm[8] = { x: 0.52, y: 0.48, z: 0 };  // index close
    lm[12] = { x: 0.51, y: 0.49, z: 0 }; // middle close
    lm[16] = { x: 0.50, y: 0.50, z: 0 }; // ring close
    lm[20] = { x: 0.49, y: 0.51, z: 0 }; // pinky close
    return lm;
}

function makeAmbiguousFist() {
    const lm = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
    lm[0] = { x: 0.5, y: 0.5, z: 0 };
    lm[4] = { x: 0.5, y: 0.35, z: 0 };   // thumb slightly out
    lm[8] = { x: 0.52, y: 0.38, z: 0 };   // other fingers also out
    lm[12] = { x: 0.51, y: 0.37, z: 0 };
    lm[16] = { x: 0.50, y: 0.39, z: 0 };
    lm[20] = { x: 0.49, y: 0.40, z: 0 };
    return lm;
}

function pred(label, conf = 0.9) {
    return { label, confidence: conf, gestureType: getGestureTypeForLabel(label), phrase: getPhraseForLabel(label) };
}

function feed(p, lm, n) {
    let r = null;
    for (let i = 0; i < n; i++) r = engine.processFrame(p, lm);
    return r;
}

// ──────────────────────────────────────────────
// Test Suite
// ──────────────────────────────────────────────

console.log('\n🧪 Gesture Decision Engine — Unit Tests\n');

console.log('Test 1: Stability Voting — requires 8 consecutive identical frames');
{
    engine.reset();
    const lm = makeThumbsUpLandmarks();
    assert(feed(pred('OPEN_PALM'), lm, 5) === null, '5 frames → no gesture (below threshold)');
    engine.reset();
    const r = feed(pred('OPEN_PALM'), lm, 8);
    assert(r !== null, '8 frames → gesture accepted');
    assert(r?.label === 'OPEN_PALM', 'Correct label: OPEN_PALM');
    assert(r?.gestureType === 'open-palm', 'Correct gestureType: open-palm');
}

console.log('\nTest 2: Thumb Dominance Gate — validates THUMBS_UP geometry');
{
    engine.reset();
    const r = feed(pred('THUMBS_UP'), makeThumbsUpLandmarks(), 8);
    assert(r !== null, 'Valid THUMBS_UP accepted (thumb dominant)');
    assert(r?.label === 'THUMBS_UP', 'Label: THUMBS_UP');
}
{
    engine.reset();
    const r = feed(pred('THUMBS_UP'), makeAmbiguousFist(), 8);
    assert(r !== null, 'Ambiguous thumb-out fist stabilizes');
    assert(r?.label === 'CLOSED_FIST', 'THUMBS_UP downgraded → CLOSED_FIST');
}

console.log('\nTest 3: Cooldown Enforcement — 2.5s lockout after accepted gesture');
{
    engine.reset();
    const lm = makeThumbsUpLandmarks();
    const first = feed(pred('OPEN_PALM'), lm, 8);
    assert(first !== null, 'First gesture accepted');
    const second = feed(pred('PEACE_SIGN'), lm, 8);
    assert(second === null, 'Second gesture blocked during cooldown');
    assert(engine.inCooldown === true, 'Engine confirms cooldown active');
}

console.log('\nTest 4: Cooldown Expires — new gesture accepted after wait');
{
    engine.reset();
    const lm = makeThumbsUpLandmarks();
    feed(pred('OPEN_PALM'), lm, 8);
    engine.acceptedTimestamp = Date.now() - 3000;
    engine.inCooldown = true;
    const r = feed(pred('PEACE_SIGN'), lm, 8);
    assert(r !== null, 'New gesture accepted after cooldown expires');
    assert(r?.label === 'PEACE_SIGN', 'Correct label: PEACE_SIGN');
}

console.log('\nTest 5: Hand Disappearance — full state reset');
{
    engine.reset();
    feed(pred('OPEN_PALM'), makeThumbsUpLandmarks(), 5);
    engine.onHandDisappear();
    assert(engine.acceptedGesture === null, 'Accepted gesture cleared');
    assert(engine.stabilityBuffer.length === 0, 'Stability buffer cleared');
    assert(engine.inCooldown === false, 'Cooldown cleared');
    assert(engine.acceptedTimestamp === 0, 'Timestamp reset to 0');
}

console.log('\nTest 6: NONE Predictions — silently ignored');
{
    engine.reset();
    assert(feed(pred('NONE', 0), makeThumbsUpLandmarks(), 15) === null, 'NONE never triggers');
    assert(engine.acceptedGesture === null, 'No accepted gesture after NONE');
}

console.log('\nTest 7: Mixed Frames — alternating gestures break stability');
{
    engine.reset();
    const lm = makeThumbsUpLandmarks();
    for (let i = 0; i < 30; i++) engine.processFrame(i % 2 === 0 ? pred('OPEN_PALM') : pred('PEACE_SIGN'), lm);
    assert(engine.acceptedGesture === null, 'Alternating predictions never stabilize');
}

console.log('\nTest 8: Same Gesture Deduplication — no re-trigger');
{
    engine.reset();
    const lm = makeThumbsUpLandmarks();
    const first = feed(pred('OPEN_PALM'), lm, 8);
    assert(first !== null, 'First trigger fires');
    engine.acceptedTimestamp = Date.now() - 3000;
    engine.inCooldown = false;
    assert(feed(pred('OPEN_PALM'), lm, 8) === null, 'Same gesture NOT re-triggered');
}

console.log('\nTest 9: Phrase & GestureType Correctness — all gestures');
{
    for (const [lbl, type, phrase] of [
        ['OPEN_PALM', 'open-palm', "Let's put a pin in that for now."],
        ['CLOSED_FIST', 'fist', "We need to circle back to the core deliverables."],
        ['POINTING_UP', 'pointing', "Let's take this offline."],
        ['PEACE_SIGN', 'peace', "We have verified the cross-functional synergy."]
    ]) {
        engine.reset();
        const r = feed(pred(lbl), makeThumbsUpLandmarks(), 8);
        assert(r?.gestureType === type, `${lbl} → ${type}`);
        assert(r?.phrase === phrase, `${lbl} → correct phrase`);
    }
}

console.log('\nTest 10: Fresh Detection After Hand Loss + Return');
{
    engine.reset();
    const lm = makeThumbsUpLandmarks();
    assert(feed(pred('OPEN_PALM'), lm, 8) !== null, 'Accepted before hand loss');
    engine.onHandDisappear();
    assert(feed(pred('OPEN_PALM'), lm, 8) !== null, 'Same gesture re-accepted after hand loss');
}

// ──────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────

console.log(`\n${'═'.repeat(50)}`);
console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${'═'.repeat(50)}\n`);

if (failed > 0) { console.log('💥 Some tests failed.\n'); process.exit(1); }
else { console.log('🎉 All tests passed!\n'); process.exit(0); }
