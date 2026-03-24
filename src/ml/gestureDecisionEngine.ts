/**
 * gestureDecisionEngine.ts — Gesture Validation & Debouncing
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

import { getGestureTypeForLabel, getPhraseForLabel } from '../config/gestureConfig';
import type { Landmark, MLPrediction, StabilityEntry, GestureResult, EngineState } from '../types';

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
 * Reserved for future use when full probability distributions are exposed.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const CONFIDENCE_TIE_BREAK_THRESHOLD = 0.1;
void CONFIDENCE_TIE_BREAK_THRESHOLD;

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
} as const;

// ──────────────────────────────────────────────
// Gesture Decision Engine Class
// ──────────────────────────────────────────────

class GestureDecisionEngine {
    /** Stability buffer: stores last N predictions to vote on gesture. */
    stabilityBuffer: StabilityEntry[];

    /** Currently accepted gesture (what we last fired to UI). */
    acceptedGesture: string | null;

    /** Timestamp when the current gesture was accepted. */
    acceptedTimestamp: number;

    /** Whether we're currently in cooldown. */
    inCooldown: boolean;

    constructor() {
        this.stabilityBuffer = [];
        this.acceptedGesture = null;
        this.acceptedTimestamp = 0;
        this.inCooldown = false;
    }

    /**
     * Reset the engine state (e.g., when hand disappears).
     */
    reset(): void {
        this.stabilityBuffer = [];
        this.acceptedGesture = null;
        this.acceptedTimestamp = 0;
        this.inCooldown = false;
    }

    /**
     * Compute distance from wrist to a landmark.
     */
    _computeDistance(wrist: Landmark, tip: Landmark): number {
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
     */
    _validateThumbDominance(landmarks: Landmark[]): boolean {
        const wrist = landmarks[LANDMARKS.WRIST];
        const thumbDist = this._computeDistance(wrist, landmarks[LANDMARKS.THUMB_TIP]);
        const indexDist = this._computeDistance(wrist, landmarks[LANDMARKS.INDEX_TIP]);
        const middleDist = this._computeDistance(wrist, landmarks[LANDMARKS.MIDDLE_TIP]);
        const ringDist = this._computeDistance(wrist, landmarks[LANDMARKS.RING_TIP]);
        const pinkyDist = this._computeDistance(wrist, landmarks[LANDMARKS.PINKY_TIP]);

        const otherFingerDists = [indexDist, middleDist, ringDist, pinkyDist];
        const maxOtherDist = Math.max(...otherFingerDists);

        return thumbDist > THUMB_DOMINANCE_THRESHOLD * maxOtherDist;
    }

    /**
     * Apply confidence-aware tie breaking.
     * Forward-compatible hook for future ML improvements.
     */
    _applyTieBreaking(label: string, _confidence: number, _fullPredictionObject: unknown): string {
        return label;
    }

    /**
     * Apply all decision gates to a raw ML prediction.
     *
     * Gates (in order):
     *   1. Thumb dominance: if THUMBS_UP, validate thumb extension
     *   2. Call Me geometry: if CALL_ME, require thumb+pinky extended, others curled
     *   3. Tie-breaking: if close confidence, prefer conservative gesture
     */
    _applyDecisionGates(label: string, confidence: number, landmarks: Landmark[]): string {
        // Gate 1: Thumb Dominance for THUMBS_UP
        if (label === 'THUMBS_UP') {
            const isValid = this._validateThumbDominance(landmarks);
            if (!isValid) {
                return 'CLOSED_FIST';
            }
        }

        // Gate 2: Call Me geometry and confidence for CALL_ME
        if (label === 'CALL_ME') {
            const isValid = this._validateCallMeGeometry(landmarks);
            // Use the same threshold as the rest of the app (from config)
            const CONFIDENCE_THRESHOLD = 0.60;
            if (!isValid || confidence < CONFIDENCE_THRESHOLD) {
                // If not valid or not confident, fallback to most likely confusion (fist)
                return 'CLOSED_FIST';
            }
        }

        // Gate 3: Tie-breaking (future-compatible)
        const finalLabel = this._applyTieBreaking(label, confidence, null);
        return finalLabel;
    }

    /**
     * Validate 'Call Me' gesture geometry: thumb and pinky extended, others curled.
     * Returns true if geometry matches expected pattern.
     */
    _validateCallMeGeometry(landmarks: Landmark[]): boolean {
        // Indices for tips
        const WRIST = 0, THUMB_TIP = 4, INDEX_TIP = 8, MIDDLE_TIP = 12, RING_TIP = 16, PINKY_TIP = 20;
        const wrist = landmarks[WRIST];
        // Distances from wrist
        const thumbDist = this._computeDistance(wrist, landmarks[THUMB_TIP]);
        const pinkyDist = this._computeDistance(wrist, landmarks[PINKY_TIP]);
        const indexDist = this._computeDistance(wrist, landmarks[INDEX_TIP]);
        const middleDist = this._computeDistance(wrist, landmarks[MIDDLE_TIP]);
        const ringDist = this._computeDistance(wrist, landmarks[RING_TIP]);
        // Require thumb and pinky to be at least 1.1x as extended as the max of the other fingers
        const curledMax = Math.max(indexDist, middleDist, ringDist);
        const EXTENSION_FACTOR = 1.1;
        return thumbDist > EXTENSION_FACTOR * curledMax && pinkyDist > EXTENSION_FACTOR * curledMax;
    }

    /**
     * Feed a new frame into the stability voting system.
     */
    _updateStabilityBuffer(label: string, confidence: number): string | null {
        this.stabilityBuffer.push({
            label,
            confidence,
            timestamp: Date.now()
        });

        if (this.stabilityBuffer.length > STABILITY_FRAMES) {
            this.stabilityBuffer.shift();
        }

        if (this.stabilityBuffer.length === STABILITY_FRAMES) {
            const allSame = this.stabilityBuffer.every(
                (p) => p.label === this.stabilityBuffer[0].label
            );

            if (allSame) {
                return this.stabilityBuffer[0].label;
            }
        }

        return null;
    }

    /**
     * Check if we're in gesture cooldown period.
     */
    _isInCooldown(): boolean {
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
     */
    processFrame(mlPrediction: MLPrediction, landmarks: Landmark[]): GestureResult | null {
        const { label, confidence } = mlPrediction;

        // Ignore if gesture is null (low confidence from model)
        if (!label || label === 'NONE') {
            return null;
        }

        // Check cooldown: ignore all gestures during cooldown
        if (this._isInCooldown()) {
            return null;
        }

        // Apply decision gates (thumb dominance, tie-breaking)
        const gatedLabel = this._applyDecisionGates(label, confidence, landmarks);

        // Map gated label to phrase and gestureType
        const finalGestureType = this._labelToGestureType(gatedLabel);
        const finalPhrase = this._labelToPhrase(gatedLabel);

        // Feed into stability voting
        const stableLabel = this._updateStabilityBuffer(gatedLabel, confidence);

        // If gesture is stable, check if it's new
        if (stableLabel) {
            if (stableLabel !== this.acceptedGesture) {
                this.acceptedGesture = stableLabel;
                this.acceptedTimestamp = Date.now();
                this.inCooldown = true;
                this.stabilityBuffer = [];

                return {
                    label: stableLabel,
                    gestureType: finalGestureType,
                    phrase: finalPhrase,
                    reason: `stable (${STABILITY_FRAMES} frames)`
                };
            }
        }

        return null;
    }

    /**
     * Notify engine that hand disappeared.
     */
    onHandDisappear(): void {
        this.reset();
    }

    // ──────────────────────────────────────────────
    // Utility: Label → UI mappings
    // ──────────────────────────────────────────────

    _labelToGestureType(label: string): string | null {
        return getGestureTypeForLabel(label);
    }

    _labelToPhrase(label: string): string {
        return getPhraseForLabel(label);
    }
}

// ──────────────────────────────────────────────
// Export singleton instance
// ──────────────────────────────────────────────

export const gestureDecisionEngine = new GestureDecisionEngine();

/**
 * Public API: Process a frame through the decision engine.
 */
export function processGestureFrame(mlPrediction: MLPrediction, landmarks: Landmark[]): GestureResult | null {
    return gestureDecisionEngine.processFrame(mlPrediction, landmarks);
}

/**
 * Public API: Notify engine that hand disappeared.
 */
export function onHandLost(): void {
    gestureDecisionEngine.onHandDisappear();
}

/**
 * Public API: Get current decision engine state (for debugging).
 */
export function getEngineState(): EngineState {
    return {
        acceptedGesture: gestureDecisionEngine.acceptedGesture,
        inCooldown: gestureDecisionEngine.inCooldown,
        stabilityBufferSize: gestureDecisionEngine.stabilityBuffer.length,
        cooldownTimeRemaining: gestureDecisionEngine.inCooldown
            ? Math.max(0, GESTURE_COOLDOWN_MS - (Date.now() - gestureDecisionEngine.acceptedTimestamp))
            : 0
    };
}
