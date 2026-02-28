/**
 * gestureModel.ts — Browser-side ML Gesture Classifier
 *
 * Loads a TensorFlow.js gesture model and runs inference on
 * MediaPipe hand landmarks entirely client-side.
 *
 * Model loading priority:
 * 1. User-trained model from IndexedDB (personalized)
 * 2. Default pre-trained model from /model/ (static asset)
 *
 * Why browser ML?
 * - Zero server costs — runs on user's device
 * - No API keys or backend required
 * - Works on Vercel static hosting (model files served as static assets)
 * - Privacy-first: landmarks never leave the browser
 */

import * as tf from '@tensorflow/tfjs';
import { loadUserModel } from './localModelManager';
import {
    GESTURE_LABELS,
    LABEL_TO_PHRASE,
    LABEL_TO_GESTURE_TYPE,
    CONFIDENCE_THRESHOLD,
    INPUT_FEATURES
} from '../config/gestureConfig';
import type { Landmark, MLPrediction } from '../types';

// ──────────────────────────────────────────────
// Module-scoped model cache (loaded once)
// ──────────────────────────────────────────────

let cachedModel: tf.LayersModel | null = null;
let isLoading = false;
let loadPromise: Promise<tf.LayersModel> | null = null;
let isUserModel = false;

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Load the gesture classification model.
 *
 * Priority:
 * 1. User-trained model from IndexedDB (if exists)
 * 2. Default model from /model/model.json (static asset)
 *
 * Model is cached — subsequent calls return immediately.
 */
export async function loadGestureModel(): Promise<tf.LayersModel> {
    if (cachedModel) return cachedModel;

    // Prevent concurrent loads
    if (isLoading && loadPromise) return loadPromise;

    isLoading = true;
    loadPromise = (async () => {
        try {
            // Try loading user-trained model from IndexedDB first
            const userModel = await loadUserModel();
            if (userModel) {
                cachedModel = userModel;
                isUserModel = true;
                console.log('🧠 Using personalized gesture model from IndexedDB');
            } else {
                // Fall back to default model from public/model/
                cachedModel = await tf.loadLayersModel('/model/model.json');
                isUserModel = false;
                console.log('🧠 Using default gesture model from /model/');
            }

            // Warm up the model with a dummy prediction to initialize WebGL
            const dummy = tf.zeros([1, 63]);
            const warmup = cachedModel.predict(dummy) as tf.Tensor;
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
 * Hot-swap the active model with a newly trained one.
 * Used after in-browser training to apply the new model
 * immediately without a page reload.
 */
export function swapModel(newModel: tf.LayersModel): void {
    if (cachedModel && cachedModel !== newModel) {
        cachedModel.dispose();
    }
    cachedModel = newModel;
    isUserModel = true;
    console.log('🔄 Model hot-swapped to user-trained model');
}

/**
 * Reset to the default model from /model/model.json.
 * Used after clearing personalization.
 */
export async function resetToDefaultModel(): Promise<tf.LayersModel> {
    if (cachedModel) {
        cachedModel.dispose();
        cachedModel = null;
    }
    isUserModel = false;
    isLoading = false;
    loadPromise = null;

    // Force reload from default
    cachedModel = await tf.loadLayersModel('/model/model.json');
    console.log('🧠 Reset to default gesture model');

    // Warm up
    const dummy = tf.zeros([1, 63]);
    const warmup = cachedModel.predict(dummy) as tf.Tensor;
    warmup.dispose();
    dummy.dispose();

    return cachedModel;
}

/**
 * Check if the currently active model is user-trained.
 */
export function isUsingUserModel(): boolean {
    return isUserModel;
}

/**
 * Preprocess MediaPipe landmarks into a tensor suitable for inference.
 *
 * Steps:
 * 1. Flatten 21 landmarks (x, y, z) into 63 values
 * 2. Normalize relative to wrist position (landmark 0)
 * 3. Return as [1, 63] tensor2d
 */
export function preprocessLandmarks(landmarks: Landmark[]): tf.Tensor2D {
    const wrist = landmarks[0];
    const values: number[] = [];

    for (const lm of landmarks) {
        values.push(lm.x - wrist.x);
        values.push(lm.y - wrist.y);
        values.push(lm.z - wrist.z);
    }

    return tf.tensor2d([values], [1, INPUT_FEATURES]);
}

/**
 * Run gesture prediction on MediaPipe hand landmarks.
 *
 * Handles full pipeline: preprocess → infer → postprocess.
 * All intermediate tensors are properly disposed to prevent memory leaks.
 *
 * Returns full probability distribution (for decision engine tie-breaking)
 * and top prediction for backward compatibility.
 */
export function predictGesture(landmarks: Landmark[]): MLPrediction {
    if (!cachedModel || !landmarks || landmarks.length !== 21) {
        return {
            gestureType: null,
            phrase: 'Waiting for input…',
            label: 'NONE',
            confidence: 0,
            probabilities: {}
        };
    }

    // Use tf.tidy to automatically dispose all intermediate tensors
    const result = tf.tidy(() => {
        const input = preprocessLandmarks(landmarks);
        const prediction = cachedModel!.predict(input) as tf.Tensor;

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

        // Build probability distribution map for decision engine
        const probMap: Record<string, number> = {};
        for (let i = 0; i < GESTURE_LABELS.length; i++) {
            probMap[GESTURE_LABELS[i]] = probabilities[i];
        }

        return { maxIdx, maxConf, probMap };
    });

    const { maxIdx, maxConf, probMap } = result;

    // Apply confidence threshold
    if (maxConf < CONFIDENCE_THRESHOLD) {
        return {
            gestureType: null,
            phrase: 'Waiting for input…',
            label: 'NONE',
            confidence: maxConf,
            probabilities: probMap
        };
    }

    const label = GESTURE_LABELS[maxIdx];

    return {
        gestureType: LABEL_TO_GESTURE_TYPE[label],
        phrase: LABEL_TO_PHRASE[label],
        label,
        confidence: maxConf,
        probabilities: probMap
    };
}

/**
 * Check if the model is loaded and ready for inference.
 */
export function isModelReady(): boolean {
    return cachedModel !== null;
}
