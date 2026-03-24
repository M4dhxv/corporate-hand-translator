/**
 * gestureConfig.ts — Single Source of Truth for Gesture Configuration
 *
 * All gesture labels, phrases, UI mappings, and display info live here.
 * Every module imports from this file instead of defining its own copy.
 *
 * WHY: Prevents config drift between the ML model, decision engine,
 * trainer, and UI components. One file to update, zero duplicates.
 */

import type { GestureDisplayInfo } from '../types';

// ──────────────────────────────────────────────
// Gesture Labels (order matches model output indices)
// ──────────────────────────────────────────────

export const GESTURE_LABELS = [
    'OPEN_PALM',
    'CLOSED_FIST',
    'THUMBS_UP',
    'POINTING_UP',
    'PEACE_SIGN',
    'OK_SIGN',
    'CALL_ME',
    'ROCK_SIGN',
    'THREE_FINGERS',
    'FOUR_FINGERS'
] as const;

/** Union type of all valid gesture labels */
export type GestureLabel = (typeof GESTURE_LABELS)[number];

/** Total number of gesture classes */
export const NUM_CLASSES: number = GESTURE_LABELS.length;

// ──────────────────────────────────────────────
// ML Label → Corporate Phrase
// ──────────────────────────────────────────────

export const LABEL_TO_PHRASE: Record<GestureLabel, string> = {
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

// ──────────────────────────────────────────────
// ML Label → UI Gesture Type (kebab-case for CSS/UI)
// ──────────────────────────────────────────────

export const LABEL_TO_GESTURE_TYPE: Record<GestureLabel, string> = {
    'OPEN_PALM': 'open-palm',
    'CLOSED_FIST': 'fist',
    'THUMBS_UP': 'thumbs-up',
    'POINTING_UP': 'pointing',
    'PEACE_SIGN': 'peace',
    'OK_SIGN': 'ok-sign',
    'CALL_ME': 'call-me',
    'ROCK_SIGN': 'rock-sign',
    'THREE_FINGERS': 'three-fingers',
    'FOUR_FINGERS': 'four-fingers'
};

// ──────────────────────────────────────────────
// UI Display Info (emoji + human-readable name)
// ──────────────────────────────────────────────

export const GESTURE_DISPLAY: Record<GestureLabel, GestureDisplayInfo> = {
    'OPEN_PALM': { emoji: '✋', name: 'Open Palm' },
    'CLOSED_FIST': { emoji: '✊', name: 'Closed Fist' },
    'THUMBS_UP': { emoji: '👍', name: 'Thumbs Up' },
    'POINTING_UP': { emoji: '☝️', name: 'Pointing Up' },
    'PEACE_SIGN': { emoji: '✌️', name: 'Peace Sign' },
    'OK_SIGN': { emoji: '👌', name: 'OK Sign' },
    'CALL_ME': { emoji: '🤙', name: 'Call Me' },
    'ROCK_SIGN': { emoji: '🤘', name: 'Rock Sign' },
    'THREE_FINGERS': { emoji: '3️⃣', name: 'Three Fingers' },
    'FOUR_FINGERS': { emoji: '4️⃣', name: 'Four Fingers' }
};

/** Reverse lookup: UI gesture type → emoji */
export const GESTURE_TYPE_TO_EMOJI: Record<string, string> = {
    'open-palm': '✋',
    'fist': '✊',
    'thumbs-up': '👍',
    'pointing': '☝️',
    'peace': '✌️',
    'ok-sign': '👌',
    'call-me': '🤙',
    'rock-sign': '🤘',
    'three-fingers': '3️⃣',
    'four-fingers': '4️⃣'
};

// ──────────────────────────────────────────────
// ML Model Configuration
// ──────────────────────────────────────────────

/** Input shape: 21 landmarks × 3 coordinates (x, y, z) */
export const INPUT_FEATURES: number = 63;

/** Minimum confidence to accept a prediction */
export const CONFIDENCE_THRESHOLD: number = 0.60;

// ──────────────────────────────────────────────
// Convenience Helpers
// ──────────────────────────────────────────────

/**
 * Get phrase for a gesture label. Returns waiting message for unknown labels.
 */
export function getPhraseForLabel(label: string): string {
    return (LABEL_TO_PHRASE as Record<string, string>)[label] || 'Waiting for input…';
}

/**
 * Get UI gesture type for a gesture label. Returns null for unknown labels.
 */
export function getGestureTypeForLabel(label: string): string | null {
    return (LABEL_TO_GESTURE_TYPE as Record<string, string>)[label] || null;
}
