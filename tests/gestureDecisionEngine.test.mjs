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
 *   9. Phrase and gestureType correctness for all 10 classes
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
        'PEACE_SIGN': "We have verified the cross-functional synergy.",
        'OK_SIGN': "The current plan is on track.",
        'CALL_ME': "Let's sync one-on-one after this.",
        'ROCK_SIGN': "This initiative is a top priority.",
        'THREE_FINGERS': "I have three key points to add.",
        'FOUR_FINGERS': "Let's review four action items."
    };
    return map[label] || 'Waiting for input…';
}

function getGestureTypeForLabel(label) {
    const map = {
        'OPEN_PALM': 'open-palm', 'CLOSED_FIST': 'fist',
        'THUMBS_UP': 'thumbs-up', 'POINTING_UP': 'pointing', 'PEACE_SIGN': 'peace',
        'OK_SIGN': 'ok-sign', 'CALL_ME': 'call-me', 'ROCK_SIGN': 'rock-sign',
        'THREE_FINGERS': 'three-fingers', 'FOUR_FINGERS': 'four-fingers'
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

    _pickBestNonFistLabel(probabilities = {}) {
        const keys = Object.keys(probabilities);
        if (keys.length === 0) return 'OPEN_PALM';

        let bestLabel = 'OPEN_PALM';
        let bestProb = -1;

        for (const [candidate, prob] of Object.entries(probabilities)) {
            if (candidate === 'CLOSED_FIST') continue;
            if (prob > bestProb) {
                bestProb = prob;
                bestLabel = candidate;
            }
        }

        return bestLabel;
    }

    _validateThumbDominance(landmarks) {
        const w = landmarks[LM.WRIST];
        const thumb = this._dist(w, landmarks[LM.THUMB_TIP]);
        const others = [LM.INDEX_TIP, LM.MIDDLE_TIP, LM.RING_TIP, LM.PINKY_TIP]
            .map(i => this._dist(w, landmarks[i]));
        return thumb > THUMB_DOMINANCE_THRESHOLD * Math.max(...others);
    }

    _applyGates(prediction, landmarks) {
        const { label, probabilities = {} } = prediction;

        if (label === 'THUMBS_UP' && !this._validateThumbDominance(landmarks)) return 'CLOSED_FIST';
        if (label === 'CALL_ME' && !this._validateCallMeGeometry(landmarks)) return 'CLOSED_FIST';

        if (label === 'CLOSED_FIST' && this._validateCallMeGeometry(landmarks)) {
            return 'CALL_ME';
        }

        if (label === 'CLOSED_FIST' && !this._validateClosedFistGeometry(landmarks)) {
            return this._pickBestNonFistLabel(probabilities);
        }

        return label;
    }

    // Validate 'Call Me' geometry: thumb and pinky extended, others curled
    _validateCallMeGeometry(landmarks) {
        const WRIST = LM.WRIST;
        const THUMB_TIP = LM.THUMB_TIP;
        const INDEX_TIP = LM.INDEX_TIP;
        const MIDDLE_TIP = LM.MIDDLE_TIP;
        const RING_TIP = LM.RING_TIP;
        const PINKY_TIP = LM.PINKY_TIP;

        const wrist = landmarks[WRIST];

        const thumbTipDist = this._dist(wrist, landmarks[THUMB_TIP]);
        const indexTipDist = this._dist(wrist, landmarks[INDEX_TIP]);
        const middleTipDist = this._dist(wrist, landmarks[MIDDLE_TIP]);
        const ringTipDist = this._dist(wrist, landmarks[RING_TIP]);
        const pinkyTipDist = this._dist(wrist, landmarks[PINKY_TIP]);
        const thumbToPinkyDist = this._dist(landmarks[THUMB_TIP], landmarks[PINKY_TIP]);

        const curledCenter = {
            x: (landmarks[INDEX_TIP].x + landmarks[MIDDLE_TIP].x + landmarks[RING_TIP].x) / 3,
            y: (landmarks[INDEX_TIP].y + landmarks[MIDDLE_TIP].y + landmarks[RING_TIP].y) / 3,
            z: (landmarks[INDEX_TIP].z + landmarks[MIDDLE_TIP].z + landmarks[RING_TIP].z) / 3
        };
        const thumbAwayFromFist = this._dist(landmarks[THUMB_TIP], curledCenter) > 0.08;
        const pinkyAwayFromFist = this._dist(landmarks[PINKY_TIP], curledCenter) > 0.08;

        const curledMax = Math.max(indexTipDist, middleTipDist, ringTipDist);
        const curledAvg = (indexTipDist + middleTipDist + ringTipDist) / 3;
        const thumbExtended = thumbTipDist > curledMax * 1.06;
        const pinkyExtended = pinkyTipDist > curledMax * 1.06;

        const weakerExtended = Math.min(thumbTipDist, pinkyTipDist);
        const indexCurled = indexTipDist < weakerExtended * 0.95;
        const middleCurled = middleTipDist < weakerExtended * 0.95;
        const ringCurled = ringTipDist < weakerExtended * 0.95;

        const spreadValid = weakerExtended > 0.12 && weakerExtended > curledAvg * 1.05;

        return (
            thumbExtended &&
            pinkyExtended &&
            indexCurled &&
            middleCurled &&
            ringCurled &&
            spreadValid &&
            thumbToPinkyDist > 0.18 &&
            thumbAwayFromFist &&
            pinkyAwayFromFist
        );
    }

    _validateClosedFistGeometry(landmarks) {
        const WRIST = LM.WRIST;
        const THUMB_TIP = LM.THUMB_TIP;
        const INDEX_TIP = LM.INDEX_TIP;
        const MIDDLE_TIP = LM.MIDDLE_TIP;
        const RING_TIP = LM.RING_TIP;
        const PINKY_TIP = LM.PINKY_TIP;

        const wrist = landmarks[WRIST];
        const tips = [
            landmarks[THUMB_TIP],
            landmarks[INDEX_TIP],
            landmarks[MIDDLE_TIP],
            landmarks[RING_TIP],
            landmarks[PINKY_TIP]
        ];

        const tipDists = tips.map((tip) => this._dist(wrist, tip));
        const maxTipDist = Math.max(...tipDists);
        const minTipDist = Math.min(...tipDists);

        const compactToWrist = maxTipDist < 0.22;
        const uniformClosure = (maxTipDist - minTipDist) < 0.08;

        const thumbIndex = this._dist(landmarks[THUMB_TIP], landmarks[INDEX_TIP]);
        const indexMiddle = this._dist(landmarks[INDEX_TIP], landmarks[MIDDLE_TIP]);
        const middleRing = this._dist(landmarks[MIDDLE_TIP], landmarks[RING_TIP]);
        const ringPinky = this._dist(landmarks[RING_TIP], landmarks[PINKY_TIP]);
        const fingertipsTogether =
            thumbIndex < 0.16 &&
            indexMiddle < 0.10 &&
            middleRing < 0.10 &&
            ringPinky < 0.10;

        return compactToWrist && uniformClosure && fingertipsTogether;
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

        const gated = this._applyGates(pred, landmarks);
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

// Thumb and pinky extended, others curled (for CALL_ME)
function makeCallMeLandmarks() {
    const lm = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
    lm[0] = { x: 0.5, y: 0.5, z: 0 };
    // Thumb extended
    lm[4] = { x: 0.3, y: 0.2, z: 0 };
    // Index curled
    lm[8] = { x: 0.52, y: 0.48, z: 0.1 };
    // Middle curled
    lm[12] = { x: 0.53, y: 0.49, z: 0.1 };
    // Ring curled
    lm[16] = { x: 0.54, y: 0.50, z: 0.1 };
    // Pinky extended
    lm[20] = { x: 0.7, y: 0.2, z: 0 };
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

function makeClosedFistLandmarks() {
    const lm = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
    lm[0] = { x: 0.5, y: 0.5, z: 0 };
    lm[4] = { x: 0.45, y: 0.43, z: 0.02 };
    lm[8] = { x: 0.49, y: 0.42, z: 0.03 };
    lm[12] = { x: 0.51, y: 0.42, z: 0.03 };
    lm[16] = { x: 0.53, y: 0.43, z: 0.02 };
    lm[20] = { x: 0.55, y: 0.44, z: 0.02 };
    return lm;
}

function pred(label, conf = 0.9, probabilities = {}) {
    return {
        label,
        confidence: conf,
        gestureType: getGestureTypeForLabel(label),
        phrase: getPhraseForLabel(label),
        probabilities
    };
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
        ['THUMBS_UP', 'thumbs-up', "I am fully aligned with this initiative."],
        ['POINTING_UP', 'pointing', "Let's take this offline."],
        ['PEACE_SIGN', 'peace', "We have verified the cross-functional synergy."],
        ['OK_SIGN', 'ok-sign', "The current plan is on track."],
        ['CALL_ME', 'call-me', "Let's sync one-on-one after this."],
        ['ROCK_SIGN', 'rock-sign', "This initiative is a top priority."],
        ['THREE_FINGERS', 'three-fingers', "I have three key points to add."],
        ['FOUR_FINGERS', 'four-fingers', "Let's review four action items."]
    ]) {
        engine.reset();
        let lm;
        if (lbl === 'CALL_ME') lm = makeCallMeLandmarks();
        else if (lbl === 'CLOSED_FIST') lm = makeClosedFistLandmarks();
        else lm = makeThumbsUpLandmarks();
        const r = feed(pred(lbl), lm, 8);
        assert(r?.gestureType === type, `${lbl} → ${type}`);
        assert(r?.phrase === phrase, `${lbl} → correct phrase`);
    }
}

console.log('\nTest 11: Fist requires compact closure — non-compact fist rejected');
{
    engine.reset();
    const lm = makeCallMeLandmarks();
    const p = pred('CLOSED_FIST', 0.9, { CALL_ME: 0.3, OPEN_PALM: 0.2 });
    const r = feed(p, lm, 8);
    assert(r?.label === 'CALL_ME', 'CLOSED_FIST + call-me geometry promotes to CALL_ME');
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
