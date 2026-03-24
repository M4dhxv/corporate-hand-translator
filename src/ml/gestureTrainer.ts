/**
 * gestureTrainer.ts — In-Browser Gesture Training
 *
 * Collects landmark samples from the camera, normalizes them,
 * and trains a lightweight TensorFlow.js classifier entirely
 * in the browser. No data leaves the device.
 *
 * Architecture: Dense(128, relu) → Dropout(0.3) → Dense(64, relu) → Dense(NUM_CLASSES, softmax)
 * Input:  [1, 63] — 21 landmarks × 3 coordinates (normalized to wrist)
 * Output: [1, NUM_CLASSES]  — probability per gesture class
 */

import * as tf from '@tensorflow/tfjs';
import { GESTURE_LABELS, NUM_CLASSES, INPUT_FEATURES } from '../config/gestureConfig';
import type { Landmark, TrainProgressCallback } from '../types';

// Re-export for consumers that imported from here previously
export { GESTURE_LABELS };

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

/** Minimum samples per gesture before training is allowed */
export const MIN_SAMPLES_PER_GESTURE = 10;

/** Training hyperparameters */
const EPOCHS = 50;
const BATCH_SIZE = 32;
const LEARNING_RATE = 0.001;

// ──────────────────────────────────────────────
// Dataset Storage (module-scoped, in-memory)
// ──────────────────────────────────────────────

/**
 * Dataset: Map<string, Float32Array[]>
 * Key = gesture label, Value = array of feature vectors (63 floats each)
 */
let dataset = new Map<string, Float32Array[]>();
resetDataset();

// ──────────────────────────────────────────────
// Dataset API
// ──────────────────────────────────────────────

/**
 * Initialize/reset the dataset with empty arrays for each gesture.
 */
function resetDataset(): void {
    dataset = new Map<string, Float32Array[]>();
    for (const label of GESTURE_LABELS) {
        dataset.set(label, []);
    }
}

/**
 * Normalize 21 MediaPipe landmarks into a 63-element Float32Array.
 * Coordinates are made relative to the wrist (landmark 0).
 */
function normalizeLandmarks(landmarks: Landmark[]): Float32Array {
    const wrist = landmarks[0];
    const values = new Float32Array(63);
    let idx = 0;

    for (const lm of landmarks) {
        values[idx++] = lm.x - wrist.x;
        values[idx++] = lm.y - wrist.y;
        values[idx++] = lm.z - wrist.z;
    }

    return values;
}

/**
 * Add a single landmark sample to the dataset.
 */
export function addSample(landmarks: Landmark[], label: string): boolean {
    if (!landmarks || landmarks.length !== 21) return false;
    if (!(GESTURE_LABELS as readonly string[]).includes(label)) return false;

    const features = normalizeLandmarks(landmarks);
    dataset.get(label)!.push(features);
    return true;
}

/**
 * Get the number of collected samples per gesture.
 */
export function getSampleCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const label of GESTURE_LABELS) {
        counts[label] = dataset.get(label)!.length;
    }
    return counts;
}

/**
 * Get total number of samples across all gestures.
 */
export function getTotalSamples(): number {
    let total = 0;
    for (const label of GESTURE_LABELS) {
        total += dataset.get(label)!.length;
    }
    return total;
}

/**
 * Check if we have enough samples to train.
 */
export function canTrain(): boolean {
    for (const label of GESTURE_LABELS) {
        if (dataset.get(label)!.length < MIN_SAMPLES_PER_GESTURE) return false;
    }
    return true;
}

/**
 * Clear all collected samples.
 */
export function clearDataset(): void {
    resetDataset();
}

// ──────────────────────────────────────────────
// Training
// ──────────────────────────────────────────────

/**
 * Build and train a gesture classification model using collected samples.
 */
export async function trainModel(onProgress?: TrainProgressCallback): Promise<tf.LayersModel> {
    if (!canTrain()) {
        throw new Error(
            `Need at least ${MIN_SAMPLES_PER_GESTURE} samples per gesture. ` +
            `Current: ${JSON.stringify(getSampleCounts())}`
        );
    }

    // ── Prepare training data ──
    const allFeatures: number[][] = [];
    const allLabels: number[][] = [];

    for (let i = 0; i < GESTURE_LABELS.length; i++) {
        const label = GESTURE_LABELS[i];
        const samples = dataset.get(label)!;

        for (const features of samples) {
            allFeatures.push(Array.from(features));
            // One-hot encode the label
            const oneHot = new Array<number>(GESTURE_LABELS.length).fill(0);
            oneHot[i] = 1;
            allLabels.push(oneHot);
        }
    }

    // Shuffle the data (Fisher-Yates)
    for (let i = allFeatures.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allFeatures[i], allFeatures[j]] = [allFeatures[j], allFeatures[i]];
        [allLabels[i], allLabels[j]] = [allLabels[j], allLabels[i]];
    }

    // Convert to tensors
    const xs = tf.tensor2d(allFeatures);
    const ys = tf.tensor2d(allLabels);

    // ── Build model ──
    const model = tf.sequential();

    model.add(tf.layers.dense({
        inputShape: [INPUT_FEATURES],
        units: 128,
        activation: 'relu'
    }));

    model.add(tf.layers.dropout({ rate: 0.3 }));

    model.add(tf.layers.dense({
        units: 64,
        activation: 'relu'
    }));

    model.add(tf.layers.dense({
        units: NUM_CLASSES,
        activation: 'softmax'
    }));

    model.compile({
        optimizer: tf.train.adam(LEARNING_RATE),
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
    });

    // ── Train ──
    await model.fit(xs, ys, {
        epochs: EPOCHS,
        batchSize: BATCH_SIZE,
        shuffle: true,
        validationSplit: 0.2,
        callbacks: {
            onEpochEnd: (epoch) => {
                onProgress?.(epoch + 1, EPOCHS);
            }
        }
    });

    // ── Cleanup tensors ──
    xs.dispose();
    ys.dispose();

    return model;
}
