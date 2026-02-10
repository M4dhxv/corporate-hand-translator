/**
 * gestureModel.js — Browser-side ML Gesture Classifier
 * 
 * Loads a pre-trained TensorFlow.js model from /model/ and runs
 * inference on MediaPipe hand landmarks entirely client-side.
 * 
 * Why browser ML?
 * - Zero server costs — runs on user's device
 * - No API keys or backend required
 * - Works on Vercel static hosting (model files served as static assets)
 * - Privacy-first: landmarks never leave the browser
 * 
 * Why this is Vercel-safe:
 * - Model files live in public/model/ and are served as static assets
 * - TensorFlow.js runs entirely in the browser via WebGL/WASM
 * - No Node.js APIs are used at runtime
 */

import * as tf from '@tensorflow/tfjs';

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

/** Gesture class labels — order matches model output indices */
const GESTURE_LABELS = [
    'OPEN_PALM',
    'CLOSED_FIST',
    'THUMBS_UP',
    'POINTING_UP',
    'PEACE_SIGN'
];

/** Map ML labels to corporate phrases */
const LABEL_TO_PHRASE = {
    'OPEN_PALM': "Let's put a pin in that for now.",
    'CLOSED_FIST': "We need to circle back to the core deliverables.",
    'THUMBS_UP': "I am fully aligned with this initiative.",
    'POINTING_UP': "Let's take this offline.",
    'PEACE_SIGN': "We have verified the cross-functional synergy."
};

/** Map ML labels to UI gesture types (matching existing UI) */
const LABEL_TO_GESTURE_TYPE = {
    'OPEN_PALM': 'open-palm',
    'CLOSED_FIST': 'fist',
    'THUMBS_UP': 'thumbs-up',
    'POINTING_UP': 'pointing',
    'PEACE_SIGN': 'peace'
};

/** Minimum confidence to accept a prediction */
const CONFIDENCE_THRESHOLD = 0.65;

// ──────────────────────────────────────────────
// Module-scoped model cache (loaded once)
// ──────────────────────────────────────────────

let cachedModel = null;
let isLoading = false;
let loadPromise = null;

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Load the gesture classification model.
 * Loads from /model/model.json (served as a static asset).
 * Model is cached — subsequent calls return immediately.
 * 
 * @returns {Promise<tf.LayersModel>} The loaded model
 */
export async function loadGestureModel() {
    if (cachedModel) return cachedModel;

    // Prevent concurrent loads
    if (isLoading && loadPromise) return loadPromise;

    isLoading = true;
    loadPromise = (async () => {
        try {
            // Load from public/model/ directory (Vite serves public/ at root)
            cachedModel = await tf.loadLayersModel('/model/model.json');
            console.log('🧠 TF.js gesture model loaded successfully');

            // Warm up the model with a dummy prediction to initialize WebGL
            const dummy = tf.zeros([1, 63]);
            const warmup = cachedModel.predict(dummy);
            warmup.dispose();
            dummy.dispose();

            return cachedModel;
        } catch (err) {
            console.error('Failed to load gesture model:', err);
            cachedModel = null;
            throw err;
        } finally {
            isLoading = false;
        }
    })();

    return loadPromise;
}

/**
 * Preprocess MediaPipe landmarks into a tensor suitable for inference.
 * 
 * Steps:
 * 1. Flatten 21 landmarks (x, y, z) into 63 values
 * 2. Normalize relative to wrist position (landmark 0)
 * 3. Return as [1, 63] tensor2d
 * 
 * @param {Array<{x: number, y: number, z: number}>} landmarks - 21 MediaPipe landmarks
 * @returns {tf.Tensor2D} Shape [1, 63] tensor
 */
export function preprocessLandmarks(landmarks) {
    const wrist = landmarks[0];
    const values = [];

    for (const lm of landmarks) {
        values.push(lm.x - wrist.x);
        values.push(lm.y - wrist.y);
        values.push(lm.z - wrist.z);
    }

    return tf.tensor2d([values], [1, 63]);
}

/**
 * Run gesture prediction on MediaPipe hand landmarks.
 * 
 * Handles full pipeline: preprocess → infer → postprocess.
 * All intermediate tensors are properly disposed to prevent memory leaks.
 * 
 * @param {Array<{x: number, y: number, z: number}>} landmarks - 21 MediaPipe landmarks
 * @returns {{ gestureType: string|null, phrase: string, label: string, confidence: number }}
 */
export function predictGesture(landmarks) {
    if (!cachedModel || !landmarks || landmarks.length !== 21) {
        return {
            gestureType: null,
            phrase: 'Waiting for input…',
            label: 'NONE',
            confidence: 0
        };
    }

    // Use tf.tidy to automatically dispose all intermediate tensors
    const result = tf.tidy(() => {
        const input = preprocessLandmarks(landmarks);
        const prediction = cachedModel.predict(input);

        // Get class probabilities
        const probabilities = prediction.dataSync(); // Float32Array

        // Find the class with highest confidence
        let maxIdx = 0;
        let maxConf = probabilities[0];
        for (let i = 1; i < probabilities.length; i++) {
            if (probabilities[i] > maxConf) {
                maxConf = probabilities[i];
                maxIdx = i;
            }
        }

        return { maxIdx, maxConf };
    });

    const { maxIdx, maxConf } = result;

    // Apply confidence threshold
    if (maxConf < CONFIDENCE_THRESHOLD) {
        return {
            gestureType: null,
            phrase: 'Waiting for input…',
            label: 'NONE',
            confidence: maxConf
        };
    }

    const label = GESTURE_LABELS[maxIdx];

    return {
        gestureType: LABEL_TO_GESTURE_TYPE[label],
        phrase: LABEL_TO_PHRASE[label],
        label,
        confidence: maxConf
    };
}

/**
 * Check if the model is loaded and ready for inference.
 * @returns {boolean}
 */
export function isModelReady() {
    return cachedModel !== null;
}
