import { useCallback, useRef } from 'react';

/**
 * Strict Pinch Gesture Detector Hook
 * 
 * Detects pinch ONLY when ALL conditions are met:
 * 1. Thumb (4) + Index (8) tips touching (< 40px)
 * 2. Middle (12), Ring (16), Pinky (20) fingers CLOSED
 * 3. Index NOT fully extended upward
 * 4. No conflicting gestures (PEACE, POINTING, OPEN_PALM)
 * 5. Hold time: 700-900ms continuous
 * 6. 2-second cooldown after trigger
 * 
 * This prevents false positives from casual hand movements.
 */
export function usePinchDetector({ onPinch, currentGestureType }) {
    const holdStartTimeRef = useRef(null);
    const lastPinchTimeRef = useRef(0);
    const isPinchingRef = useRef(false);

    // Strict configuration
    const PINCH_DISTANCE_THRESHOLD = 40; // pixels - very tight
    const PINCH_HOLD_DURATION = 800; // ms - must hold continuously
    const PINCH_COOLDOWN = 2000; // ms - prevent spam
    
    // Conflicting gestures that should suppress pinch
    const CONFLICTING_GESTURES = ['peace', 'pointing', 'open-palm'];

    /**
     * Check if a finger is extended (tip is farther from wrist than joint)
     * Returns true if finger is extended, false if curled/closed
     */
    const isFingerExtended = (landmarks, tipIndex, pipIndex, mcpIndex) => {
        if (!landmarks[tipIndex] || !landmarks[pipIndex] || !landmarks[mcpIndex]) {
            return false;
        }

        const tip = landmarks[tipIndex];
        const pip = landmarks[pipIndex];
        const mcp = landmarks[mcpIndex];
        const wrist = landmarks[0];

        // Calculate distances from wrist
        const tipDist = Math.sqrt(
            Math.pow(tip.x - wrist.x, 2) +
            Math.pow(tip.y - wrist.y, 2)
        );
        const pipDist = Math.sqrt(
            Math.pow(pip.x - wrist.x, 2) +
            Math.pow(pip.y - wrist.y, 2)
        );

        // Finger is extended if tip is significantly farther than PIP
        return tipDist > pipDist * 1.15; // 15% threshold
    };

    /**
     * Check if index finger is fully extended upward
     * (would conflict with pointing gesture)
     */
    const isIndexFullyExtended = (landmarks) => {
        if (!landmarks[8] || !landmarks[6] || !landmarks[5]) {
            return false;
        }

        const indexTip = landmarks[8];
        const indexPip = landmarks[6];
        const wrist = landmarks[0];

        // Index is "fully extended upward" if:
        // 1. Tip is far from wrist
        // 2. Tip is significantly above PIP (y-axis)
        const tipToWristDist = Math.sqrt(
            Math.pow(indexTip.x - wrist.x, 2) +
            Math.pow(indexTip.y - wrist.y, 2)
        );

        const isDistant = tipToWristDist > 150; // pixels from wrist
        const isUpward = indexTip.y < indexPip.y - 30; // tip significantly above PIP

        return isDistant && isUpward;
    };

    /**
     * Main pinch detection logic
     */
    const detectPinch = useCallback((landmarks) => {
        if (!landmarks || landmarks.length < 21) {
            holdStartTimeRef.current = null;
            isPinchingRef.current = false;
            return;
        }

        const now = Date.now();

        // ── RULE 1: Check for conflicting gestures ──
        // If a conflicting gesture is active, ignore pinch
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
        // Middle: landmark 12 (tip), 11 (PIP), 10 (MCP)
        // Ring: landmark 16 (tip), 15 (PIP), 14 (MCP)
        // Pinky: landmark 20 (tip), 19 (PIP), 18 (MCP)
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
            // Pinch just started
            holdStartTimeRef.current = now;
            isPinchingRef.current = true;
            return;
        }

        // Pinch continuing - check if held long enough
        const holdDuration = now - holdStartTimeRef.current;
        if (
            holdDuration >= PINCH_HOLD_DURATION &&
            now - lastPinchTimeRef.current >= PINCH_COOLDOWN
        ) {
            // ✓ All conditions met - trigger toggle
            if (onPinch) {
                onPinch();
            }
            lastPinchTimeRef.current = now;
            // Reset hold so it doesn't trigger again immediately
            holdStartTimeRef.current = now;
        }
    }, [currentGestureType, onPinch]);

    return { detectPinch };
}
