/**
 * gestureDecisionEngine.js — Gesture Validation & Debouncing
 *
 * This module sits between raw ML predictions and UI/TTS triggers.
 * It applies heuristic gates and stability voting to prevent:
 *   1. Gesture confusion (e.g., CLOSED_FIST ↔ THUMBS_UP)
 *   2. Frame-to-frame jitter triggering repeated TTS
 *   3. Spam from a single held gesture
 *
 * Core concepts:
 *   - Thumb Dominance Gate: THUMBS_UP requires thumb to be significantly
 *     more extended than other fingers
 *   - Stability Voting: Require N consecutive frames of same gesture
 *   - Intent Lock: Once a gesture is accepted, lock it for 2–3 seconds
 *     to prevent re-trigger on hand jitter
 *
 * This is a deterministic, frame-by-frame decision engine.
 * All decisions are explainable and debuggable.
 */

// ──────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────

/** Number of consecutive frames required to stabilize a gesture */
const STABILITY_FRAMES = 8;

/** Cooldown duration (ms) after accepting a gesture */
const GESTURE_COOLDOWN_MS = 2500;

/**
 * Thumb dominance threshold for THUMBS_UP.
 * Thumb distance must be AT LEAST this factor greater than max other finger distance.
 * Higher = stricter (fewer false THUMBS_UP).
 */
const THUMB_DOMINANCE_THRESHOLD = 1.3;

/**
 * Confidence tie-break threshold.
 * If two gestures differ by less than this, prefer the conservative one.
 * Example: THUMBS_UP (0.75) and CLOSED_FIST (0.68) → diff is 0.07 < 0.1
 * → prefer CLOSED_FIST (conservative wins).
 */
const CONFIDENCE_TIE_BREAK_THRESHOLD = 0.1;

// ──────────────────────────────────────────────
// MediaPipe hand landmark indices
// ──────────────────────────────────────────────

const LANDMARKS = {
    WRIST: 0,
    THUMB_TIP: 4,
    INDEX_TIP: 8,
    MIDDLE_TIP: 12,
    RING_TIP: 16,
    PINKY_TIP: 20
};

// ──────────────────────────────────────────────
// Gesture Decision Engine Class
// ──────────────────────────────────────────────

class GestureDecisionEngine {
    constructor() {
        /**
         * Stability buffer: stores last N predictions to vote on gesture.
         * Each entry: { label: string, confidence: number, timestamp: number }
         */
        this.stabilityBuffer = [];

        /**
         * Currently accepted gesture (what we last fired to UI).
         * Prevents re-triggering same gesture repeatedly.
         */
        this.acceptedGesture = null;

        /**
         * Timestamp when the current gesture was accepted.
         * Used to enforce cooldown.
         */
        this.acceptedTimestamp = 0;

        /**
         * Whether we're currently in cooldown.
         * During cooldown, gestures are silently ignored.
         */
        this.inCooldown = false;
    }

    /**
     * Reset the engine state (e.g., when hand disappears).
     * Called when no hand is detected.
     */
    reset() {
        this.stabilityBuffer = [];
        this.acceptedGesture = null;
        this.acceptedTimestamp = 0;
        this.inCooldown = false;
    }

    /**
     * Compute distance from wrist to a landmark.
     * Used for thumb dominance gating.
     *
     * @param {object} wrist - Wrist landmark { x, y, z }
     * @param {object} tip - Finger tip landmark { x, y, z }
     * @returns {number} Euclidean distance
     */
    _computeDistance(wrist, tip) {
        const dx = tip.x - wrist.x;
        const dy = tip.y - wrist.y;
        const dz = tip.z - wrist.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /**
     * Check if THUMBS_UP is justified by thumb geometry.
     *
     * Logic:
     *   1. Compute distance from wrist to thumb tip
     *   2. Compute distances for all other finger tips
     *   3. THUMBS_UP is only valid if:
     *      - Thumb distance > THRESHOLD × max(other finger distances)
     *      - If not, the gesture is likely CLOSED_FIST with thumb peeking out
     *
     * @param {Array} landmarks - 21 MediaPipe hand landmarks
     * @returns {boolean} True if thumb dominance is satisfied
     */
    _validateThumbDominance(landmarks) {
        const wrist = landmarks[LANDMARKS.WRIST];
        const thumbDist = this._computeDistance(wrist, landmarks[LANDMARKS.THUMB_TIP]);
        const indexDist = this._computeDistance(wrist, landmarks[LANDMARKS.INDEX_TIP]);
        const middleDist = this._computeDistance(wrist, landmarks[LANDMARKS.MIDDLE_TIP]);
        const ringDist = this._computeDistance(wrist, landmarks[LANDMARKS.RING_TIP]);
        const pinkyDist = this._computeDistance(wrist, landmarks[LANDMARKS.PINKY_TIP]);

        const otherFingerDists = [indexDist, middleDist, ringDist, pinkyDist];
        const maxOtherDist = Math.max(...otherFingerDists);

        // Thumb must be significantly more extended than all other fingers
        const isThumpsUpValid = thumbDist > THUMB_DOMINANCE_THRESHOLD * maxOtherDist;

        // Debug: uncomment to see per-frame thumb geometry
        // console.log(`[THUMB GATE] thumb=${thumbDist.toFixed(2)} max_other=${maxOtherDist.toFixed(2)} valid=${isThumpsUpValid}`);

        return isThumpsUpValid;
    }

    /**
     * Apply confidence-aware tie breaking.
     *
     * Conservative heuristic: if two gestures are close in confidence,
     * prefer the more conservative gesture (less likely to cause misfire).
     *
     * Gesture conservativeness ranking (most → least conservative):
     *   1. OPEN_PALM (always safe, hard to confuse)
     *   2. POINTING_UP (clear intent)
     *   3. PEACE_SIGN (very distinct)
     *   4. CLOSED_FIST (conservative vs. expressive)
     *   5. THUMBS_UP (most expressive, most likely to be confused)
     *
     * @param {string} label - Raw prediction label
     * @param {number} confidence - Raw prediction confidence
     * @param {object} fullPredictionObject - Full prediction with all probabilities
     * @returns {string} Final label after tie-breaking
     */
    _applyTieBreaking(label, confidence, fullPredictionObject) {
        /**
         * WARNING: fullPredictionObject is currently NOT available
         * in the current predictGesture() output. This is a
         * forward-compatible hook for future ML improvements.
         *
         * For now, we use single-label output. Tie-breaking will be
         * more powerful once we expose full probability distributions.
         */

        // Future: Once predictGesture() exposes all probabilities:
        // if (label === 'THUMBS_UP' && CLOSED_FIST probability is close)
        //   → return 'CLOSED_FIST' (conservative wins)

        return label;
    }

    /**
     * Apply all decision gates to a raw ML prediction.
     *
     * Gates (in order):
     *   1. Thumb dominance: if THUMBS_UP, validate thumb extension
     *   2. Tie-breaking: if close confidence, prefer conservative gesture
     *
     * @param {string} label - Raw prediction label
     * @param {number} confidence - Raw prediction confidence
     * @param {Array} landmarks - 21 MediaPipe landmarks
     * @returns {string} Final label after gates (may reject THUMBS_UP → CLOSED_FIST)
     */
    _applyDecisionGates(label, confidence, landmarks) {
        // Gate 1: Thumb Dominance
        if (label === 'THUMBS_UP') {
            const isValid = this._validateThumbDominance(landmarks);
            if (!isValid) {
                // Thumb is not dominant → this is actually CLOSED_FIST with thumb out
                return 'CLOSED_FIST';
            }
        }

        // Gate 2: Tie-breaking (future-compatible)
        const finalLabel = this._applyTieBreaking(label, confidence, null);

        return finalLabel;
    }

    /**
     * Feed a new frame into the stability voting system.
     *
     * Accumulates predictions in a rolling buffer. Once the buffer
     * contains STABILITY_FRAMES of the same gesture, that gesture
     * is considered "stable" and can be accepted.
     *
     * @param {string} label - Gesture label
     * @param {number} confidence - Prediction confidence
     * @returns {string|null} Stable gesture (same for N frames) or null
     */
    _updateStabilityBuffer(label, confidence) {
        // Add new prediction
        this.stabilityBuffer.push({
            label,
            confidence,
            timestamp: Date.now()
        });

        // Keep buffer size bounded
        if (this.stabilityBuffer.length > STABILITY_FRAMES) {
            this.stabilityBuffer.shift();
        }

        // Check if all recent frames agree
        if (this.stabilityBuffer.length === STABILITY_FRAMES) {
            const allSame = this.stabilityBuffer.every(
                (p) => p.label === this.stabilityBuffer[0].label
            );

            if (allSame) {
                // All frames agree → gesture is stable
                return this.stabilityBuffer[0].label;
            }
        }

        // Not enough consensus yet
        return null;
    }

    /**
     * Check if we're in gesture cooldown period.
     * Returns true if less than GESTURE_COOLDOWN_MS have elapsed
     * since the last accepted gesture.
     *
     * @returns {boolean}
     */
    _isInCooldown() {
        if (!this.inCooldown || this.acceptedTimestamp === 0) {
            return false;
        }

        const elapsedMs = Date.now() - this.acceptedTimestamp;
        const stillInCooldown = elapsedMs < GESTURE_COOLDOWN_MS;

        if (!stillInCooldown) {
            this.inCooldown = false;
        }

        return this.inCooldown;
    }

    /**
     * Process a raw ML prediction frame.
     *
     * Pipeline:
     *   1. Check if in cooldown → if yes, return null (ignore)
     *   2. Apply decision gates (thumb dominance, tie-breaking)
     *   3. Feed into stability voting buffer
     *   4. If stable, accept gesture
     *   5. If gesture changed, trigger UI update
     *
     * @param {object} mlPrediction - Output from predictGesture()
     *                  { label: string, confidence: number, gestureType: string, phrase: string }
     * @param {Array} landmarks - 21 MediaPipe hand landmarks
     * @returns {object|null} Final gesture to trigger UI with, or null if no trigger
     *                        { label: string, gestureType: string, phrase: string, reason: string }
     */
    processFrame(mlPrediction, landmarks) {
        const { label, confidence, gestureType, phrase } = mlPrediction;

        // Ignore if gesture is null (low confidence from model)
        if (!label || label === 'NONE') {
            // Hand still there, but no gesture confidence
            // Don't reset buffer yet (allows gesture to stabilize across low-confidence frames)
            return null;
        }

        // Check cooldown: ignore all gestures during cooldown
        if (this._isInCooldown()) {
            // Silently ignore
            return null;
        }

        // Apply decision gates (thumb dominance, tie-breaking)
        const gatedLabel = this._applyDecisionGates(label, confidence, landmarks);

        // The gated label might differ from the original (e.g., THUMBS_UP → CLOSED_FIST)
        // Map back to phrase and gestureType using a lookup table
        const finalGestureType = this._labelToGestureType(gatedLabel);
        const finalPhrase = this._labelToPhrase(gatedLabel);

        // Feed into stability voting
        const stableLabel = this._updateStabilityBuffer(gatedLabel, confidence);

        // If gesture is stable, check if it's new
        if (stableLabel) {
            if (stableLabel !== this.acceptedGesture) {
                // New gesture detected → accept it
                this.acceptedGesture = stableLabel;
                this.acceptedTimestamp = Date.now();
                this.inCooldown = true;
                this.stabilityBuffer = []; // Reset buffer after acceptance

                return {
                    label: stableLabel,
                    gestureType: finalGestureType,
                    phrase: finalPhrase,
                    reason: `stable (${STABILITY_FRAMES} frames)`
                };
            }
        }

        // Same gesture held or not yet stable
        return null;
    }

    /**
     * Notify engine that hand disappeared.
     * This clears all buffers and ends cooldown.
     */
    onHandDisappear() {
        this.reset();
    }

    // ──────────────────────────────────────────────
    // Utility: Label → UI mappings
    // ──────────────────────────────────────────────

    _labelToGestureType(label) {
        const mapping = {
            'OPEN_PALM': 'open-palm',
            'CLOSED_FIST': 'fist',
            'THUMBS_UP': 'thumbs-up',
            'POINTING_UP': 'pointing',
            'PEACE_SIGN': 'peace'
        };
        return mapping[label] || null;
    }

    _labelToPhrase(label) {
        const mapping = {
            'OPEN_PALM': "Let's put a pin in that for now.",
            'CLOSED_FIST': "We need to circle back to the core deliverables.",
            'THUMBS_UP': "I am fully aligned with this initiative.",
            'POINTING_UP': "Let's take this offline.",
            'PEACE_SIGN': "We have verified the cross-functional synergy."
        };
        return mapping[label] || 'Waiting for input…';
    }
}

// ──────────────────────────────────────────────
// Export singleton instance
// ──────────────────────────────────────────────

export const gestureDecisionEngine = new GestureDecisionEngine();

/**
 * Public API: Process a frame through the decision engine.
 *
 * @param {object} mlPrediction - Raw ML output
 * @param {Array} landmarks - MediaPipe hand landmarks
 * @returns {object|null} Final gesture or null
 */
export function processGestureFrame(mlPrediction, landmarks) {
    return gestureDecisionEngine.processFrame(mlPrediction, landmarks);
}

/**
 * Public API: Notify engine that hand disappeared.
 */
export function onHandLost() {
    gestureDecisionEngine.onHandDisappear();
}

/**
 * Public API: Get current decision engine state (for debugging).
 */
export function getEngineState() {
    return {
        acceptedGesture: gestureDecisionEngine.acceptedGesture,
        inCooldown: gestureDecisionEngine.inCooldown,
        stabilityBufferSize: gestureDecisionEngine.stabilityBuffer.length,
        cooldownTimeRemaining: gestureDecisionEngine.inCooldown
            ? Math.max(0, GESTURE_COOLDOWN_MS - (Date.now() - gestureDecisionEngine.acceptedTimestamp))
            : 0
    };
}
