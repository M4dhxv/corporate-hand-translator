/**
 * Strict Pinch Gesture Detector Hook
 *
 * Detects pinch ONLY when ALL conditions are met:
 * 1. Thumb (4) + Index (8) tips touching (< 0.06 normalized)
 * 2. Middle (12), Ring (16), Pinky (20) fingers CLOSED
 * 3. Index NOT fully extended upward
 * 4. No conflicting gestures (PEACE, POINTING, OPEN_PALM, OK_SIGN)
 * 5. Hold time: 700-900ms continuous
 * 6. 2-second cooldown after trigger
 *
 * This prevents false positives from casual hand movements.
 */

import { useCallback, useRef } from 'react';
import type { Landmark } from '../types';

interface UsePinchDetectorParams {
    onPinch?: () => void;
    currentGestureType: string | null;
}

interface UsePinchDetectorReturn {
    detectPinch: (landmarks: Landmark[]) => void;
}

export function usePinchDetector({ onPinch, currentGestureType }: UsePinchDetectorParams): UsePinchDetectorReturn {
    const holdStartTimeRef = useRef<number | null>(null);
    const lastPinchTimeRef = useRef(0);
    const isPinchingRef = useRef(false);

    // Strict configuration — all distances use NORMALIZED coordinates (0-1 range)
    const PINCH_DISTANCE_THRESHOLD = 0.06;
    const PINCH_HOLD_DURATION = 800;
    const PINCH_COOLDOWN = 2000;

    // Conflicting gestures that should suppress pinch
    const CONFLICTING_GESTURES = ['peace', 'pointing', 'open-palm', 'ok-sign'];

    /**
     * Check if a finger is extended (tip is farther from wrist than joint)
     */
    const isFingerExtended = (landmarks: Landmark[], tipIndex: number, pipIndex: number, _mcpIndex: number): boolean => {
        if (!landmarks[tipIndex] || !landmarks[pipIndex]) {
            return false;
        }

        const tip = landmarks[tipIndex];
        const pip = landmarks[pipIndex];
        const wrist = landmarks[0];

        const tipDist = Math.sqrt(
            Math.pow(tip.x - wrist.x, 2) +
            Math.pow(tip.y - wrist.y, 2)
        );
        const pipDist = Math.sqrt(
            Math.pow(pip.x - wrist.x, 2) +
            Math.pow(pip.y - wrist.y, 2)
        );

        return tipDist > pipDist * 1.15;
    };

    /**
     * Check if index finger is fully extended upward
     */
    const isIndexFullyExtended = (landmarks: Landmark[]): boolean => {
        if (!landmarks[8] || !landmarks[6] || !landmarks[5]) {
            return false;
        }

        const indexTip = landmarks[8];
        const indexPip = landmarks[6];
        const wrist = landmarks[0];

        const tipToWristDist = Math.sqrt(
            Math.pow(indexTip.x - wrist.x, 2) +
            Math.pow(indexTip.y - wrist.y, 2)
        );

        const isDistant = tipToWristDist > 0.25;
        const isUpward = indexTip.y < indexPip.y - 0.05;

        return isDistant && isUpward;
    };

    /**
     * Main pinch detection logic
     */
    const detectPinch = useCallback((landmarks: Landmark[]) => {
        if (!landmarks || landmarks.length < 21) {
            holdStartTimeRef.current = null;
            isPinchingRef.current = false;
            return;
        }

        const now = Date.now();

        // ── RULE 1: Check for conflicting gestures ──
        const gestureTypeLower = currentGestureType ? currentGestureType.toLowerCase() : '';
        if (CONFLICTING_GESTURES.some(g => gestureTypeLower.includes(g))) {
            holdStartTimeRef.current = null;
            isPinchingRef.current = false;
            return;
        }

        // ── RULE 2: Check thumb + index distance (tight threshold) ──
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];

        if (!thumbTip || !indexTip) {
            holdStartTimeRef.current = null;
            isPinchingRef.current = false;
            return;
        }

        const pinchDistance = Math.sqrt(
            Math.pow(thumbTip.x - indexTip.x, 2) +
            Math.pow(thumbTip.y - indexTip.y, 2)
        );

        const isPinching = pinchDistance < PINCH_DISTANCE_THRESHOLD;

        if (!isPinching) {
            holdStartTimeRef.current = null;
            isPinchingRef.current = false;
            return;
        }

        // ── RULE 3: Check that middle, ring, pinky are CLOSED ──
        const isMiddleExtended = isFingerExtended(landmarks, 12, 11, 10);
        const isRingExtended = isFingerExtended(landmarks, 16, 15, 14);
        const isPinkyExtended = isFingerExtended(landmarks, 20, 19, 18);

        if (isMiddleExtended || isRingExtended || isPinkyExtended) {
            holdStartTimeRef.current = null;
            isPinchingRef.current = false;
            return;
        }

        // ── RULE 4: Check that index is NOT fully extended upward ──
        if (isIndexFullyExtended(landmarks)) {
            holdStartTimeRef.current = null;
            isPinchingRef.current = false;
            return;
        }

        // ── RULE 5: Check hold time ──
        if (!isPinchingRef.current) {
            holdStartTimeRef.current = now;
            isPinchingRef.current = true;
            return;
        }

        // Pinch continuing - check if held long enough
        const holdDuration = now - (holdStartTimeRef.current ?? now);
        if (
            holdDuration >= PINCH_HOLD_DURATION &&
            now - lastPinchTimeRef.current >= PINCH_COOLDOWN
        ) {
            if (onPinch) {
                onPinch();
            }
            lastPinchTimeRef.current = now;
            holdStartTimeRef.current = now;
        }
    }, [currentGestureType, onPinch]);

    return { detectPinch };
}
