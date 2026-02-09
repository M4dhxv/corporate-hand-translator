/**
 * Gesture Classifier Utility
 * 
 * Performs rule-based gesture classification using MediaPipe hand landmarks.
 * Maps detected gestures to satirical corporate phrases.
 * 
 * Landmark Reference (MediaPipe Hands):
 * 0: Wrist
 * 1-4: Thumb (CMC, MCP, IP, TIP)
 * 5-8: Index finger (MCP, PIP, DIP, TIP)
 * 9-12: Middle finger (MCP, PIP, DIP, TIP)
 * 13-16: Ring finger (MCP, PIP, DIP, TIP)
 * 17-20: Pinky finger (MCP, PIP, DIP, TIP)
 */

// Gesture to phrase mapping
const GESTURE_PHRASES = {
    'open-palm': "Let's put a pin in that for now.",
    'fist': "We need to circle back to the core deliverables.",
    'thumbs-up': "I am fully aligned with this initiative.",
    'pointing': "Let's take this offline.",
    'peace': "We have verified the cross-functional synergy.",
    'none': "Waiting for input…"
};

/**
 * Check if a finger is extended based on landmark positions.
 * A finger is considered extended if the tip is further from the wrist than the PIP joint.
 * 
 * @param {Array} landmarks - Array of 21 hand landmarks from MediaPipe
 * @param {number} fingerTipIdx - Index of the finger tip landmark
 * @param {number} fingerPipIdx - Index of the finger PIP joint landmark
 * @returns {boolean} - True if finger is extended
 */
function isFingerExtended(landmarks, fingerTipIdx, fingerPipIdx) {
    const tip = landmarks[fingerTipIdx];
    const pip = landmarks[fingerPipIdx];
    const mcp = landmarks[fingerPipIdx - 1]; // MCP is one before PIP

    // For y-axis comparison (smaller y = higher on screen due to inverted coords)
    // A finger is extended if tip.y < pip.y (tip is above pip)
    return tip.y < pip.y;
}

/**
 * Check if thumb is extended.
 * Thumb uses different logic based on x-axis position relative to palm.
 * 
 * @param {Array} landmarks - Array of 21 hand landmarks from MediaPipe
 * @returns {boolean} - True if thumb is extended
 */
function isThumbExtended(landmarks) {
    const thumbTip = landmarks[4];
    const thumbIp = landmarks[3];
    const thumbMcp = landmarks[2];
    const wrist = landmarks[0];
    const indexMcp = landmarks[5];

    // Calculate thumb extension based on distance from palm center
    // Thumb is extended if tip is significantly away from palm
    const palmCenterX = (wrist.x + indexMcp.x) / 2;
    const thumbExtension = Math.abs(thumbTip.x - thumbMcp.x);
    const thumbDistFromPalm = Math.abs(thumbTip.x - palmCenterX);

    // Also check if thumb tip is above thumb MCP (for thumbs up)
    const thumbPointingUp = thumbTip.y < thumbMcp.y - 0.05;

    return thumbDistFromPalm > 0.1 || thumbPointingUp;
}

/**
 * Check if thumb is pointing upward (for thumbs up gesture).
 * 
 * @param {Array} landmarks - Array of 21 hand landmarks from MediaPipe
 * @returns {boolean} - True if thumb is pointing up
 */
function isThumbPointingUp(landmarks) {
    const thumbTip = landmarks[4];
    const thumbIp = landmarks[3];
    const thumbMcp = landmarks[2];
    const wrist = landmarks[0];

    // Thumb tip should be significantly above the thumb base
    const thumbPointingUp = thumbTip.y < thumbMcp.y - 0.08;

    // Thumb should be relatively vertical
    const thumbAngle = Math.abs(thumbTip.x - thumbMcp.x);
    const isVertical = thumbAngle < 0.15;

    return thumbPointingUp && isVertical;
}

/**
 * Check if all fingers are curled (for fist detection).
 * 
 * @param {Array} landmarks - Array of 21 hand landmarks from MediaPipe
 * @returns {boolean} - True if all fingers are curled
 */
function areAllFingersCurled(landmarks) {
    const indexCurled = landmarks[8].y > landmarks[6].y;
    const middleCurled = landmarks[12].y > landmarks[10].y;
    const ringCurled = landmarks[16].y > landmarks[14].y;
    const pinkyCurled = landmarks[20].y > landmarks[18].y;

    return indexCurled && middleCurled && ringCurled && pinkyCurled;
}

/**
 * Main gesture classification function.
 * Analyzes hand landmarks to determine the current gesture.
 * 
 * @param {Array} landmarks - Array of 21 hand landmarks from MediaPipe
 * @returns {Object} - Object containing gesture type and phrase
 */
export function classifyGesture(landmarks) {
    if (!landmarks || landmarks.length !== 21) {
        return { gestureType: 'none', phrase: GESTURE_PHRASES['none'] };
    }

    // Get finger states
    const indexExtended = isFingerExtended(landmarks, 8, 6);
    const middleExtended = isFingerExtended(landmarks, 12, 10);
    const ringExtended = isFingerExtended(landmarks, 16, 14);
    const pinkyExtended = isFingerExtended(landmarks, 20, 18);
    const thumbExtended = isThumbExtended(landmarks);
    const thumbUp = isThumbPointingUp(landmarks);
    const allFingersCurled = areAllFingersCurled(landmarks);

    // Gesture detection logic (ordered by specificity)

    // 1. Thumbs Up: Only thumb extended and pointing up, all fingers curled
    if (thumbUp && allFingersCurled) {
        return { gestureType: 'thumbs-up', phrase: GESTURE_PHRASES['thumbs-up'] };
    }

    // 2. Peace/Victory Sign: Index and middle extended, others curled
    if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
        return { gestureType: 'peace', phrase: GESTURE_PHRASES['peace'] };
    }

    // 3. Pointing Up: Only index finger extended
    if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
        return { gestureType: 'pointing', phrase: GESTURE_PHRASES['pointing'] };
    }

    // 4. Open Palm: All fingers extended
    if (indexExtended && middleExtended && ringExtended && pinkyExtended) {
        return { gestureType: 'open-palm', phrase: GESTURE_PHRASES['open-palm'] };
    }

    // 5. Closed Fist: All fingers curled
    if (allFingersCurled && !thumbExtended) {
        return { gestureType: 'fist', phrase: GESTURE_PHRASES['fist'] };
    }

    // Default: No recognized gesture
    return { gestureType: 'none', phrase: GESTURE_PHRASES['none'] };
}

/**
 * Get all available gestures and their phrases.
 * Useful for displaying gesture legend in the UI.
 * 
 * @returns {Object} - Mapping of gesture types to phrases
 */
export function getAllGestures() {
    return { ...GESTURE_PHRASES };
}

export default classifyGesture;
