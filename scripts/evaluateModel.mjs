/**
 * evaluateModel.mjs — Model Evaluation Script
 *
 * Loads the pre-trained gesture model and evaluates it against
 * synthetic test data to produce:
 *   - Per-class accuracy
 *   - Confusion matrix
 *   - Precision, Recall, F1-Score per class
 *
 * This script generates deterministic test patterns that represent
 * idealized gesture landmark configurations to validate that the
 * model can distinguish between gesture classes.
 *
 * Run: node scripts/evaluateModel.mjs
 */


import * as tf from '@tensorflow/tfjs-node';
import { resolve } from 'path';
import { readFileSync } from 'fs';
console.log('✅ Using @tensorflow/tfjs-node backend for evaluation');

// ──────────────────────────────────────────────
// Config
// ──────────────────────────────────────────────

const GESTURE_LABELS = [
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
];

const MODEL_PATH = `file://${resolve('public/model/model.json')}`;
const SAMPLES_PER_CLASS = 50;

// ──────────────────────────────────────────────
// Synthetic Landmark Generators
// ──────────────────────────────────────────────

/**
 * Generate a base hand with all fingers at rest position.
 * Returns 21 landmarks as {x, y, z} relative to wrist at origin.
 */
function baseHand() {
    const landmarks = [];
    for (let i = 0; i < 21; i++) {
        landmarks.push({ x: 0, y: 0, z: 0 });
    }
    return landmarks;
}

/**
 * Add Gaussian noise to landmarks for more realistic test data.
 */
function addNoise(landmarks, scale = 0.02) {
    return landmarks.map(lm => ({
        x: lm.x + (Math.random() - 0.5) * scale,
        y: lm.y + (Math.random() - 0.5) * scale,
        z: lm.z + (Math.random() - 0.5) * scale * 0.5
    }));
}

/**
 * Generate synthetic OPEN_PALM landmarks.
 * All fingers extended upward from wrist.
 */
function generateOpenPalm() {
    const lm = baseHand();
    // Thumb
    lm[1] = { x: -0.08, y: -0.04, z: 0 };
    lm[2] = { x: -0.15, y: -0.08, z: 0 };
    lm[3] = { x: -0.20, y: -0.14, z: 0 };
    lm[4] = { x: -0.25, y: -0.18, z: 0 };
    // Index
    lm[5] = { x: -0.04, y: -0.10, z: 0 };
    lm[6] = { x: -0.05, y: -0.18, z: 0 };
    lm[7] = { x: -0.05, y: -0.25, z: 0 };
    lm[8] = { x: -0.05, y: -0.32, z: 0 };
    // Middle
    lm[9] = { x: 0.0, y: -0.10, z: 0 };
    lm[10] = { x: 0.0, y: -0.19, z: 0 };
    lm[11] = { x: 0.0, y: -0.26, z: 0 };
    lm[12] = { x: 0.0, y: -0.33, z: 0 };
    // Ring
    lm[13] = { x: 0.04, y: -0.10, z: 0 };
    lm[14] = { x: 0.05, y: -0.18, z: 0 };
    lm[15] = { x: 0.05, y: -0.24, z: 0 };
    lm[16] = { x: 0.05, y: -0.30, z: 0 };
    // Pinky
    lm[17] = { x: 0.08, y: -0.09, z: 0 };
    lm[18] = { x: 0.10, y: -0.15, z: 0 };
    lm[19] = { x: 0.11, y: -0.20, z: 0 };
    lm[20] = { x: 0.12, y: -0.25, z: 0 };
    return addNoise(lm);
}

/**
 * Generate synthetic CLOSED_FIST landmarks.
 * All fingers curled toward palm.
 */
function generateClosedFist() {
    const lm = baseHand();
    // Thumb tucked
    lm[1] = { x: -0.05, y: -0.03, z: 0 };
    lm[2] = { x: -0.08, y: -0.04, z: 0 };
    lm[3] = { x: -0.06, y: -0.02, z: 0.02 };
    lm[4] = { x: -0.04, y: 0.0, z: 0.03 };
    // Index curled
    lm[5] = { x: -0.04, y: -0.08, z: 0 };
    lm[6] = { x: -0.04, y: -0.12, z: 0.02 };
    lm[7] = { x: -0.03, y: -0.08, z: 0.04 };
    lm[8] = { x: -0.02, y: -0.05, z: 0.03 };
    // Middle curled
    lm[9] = { x: 0.0, y: -0.08, z: 0 };
    lm[10] = { x: 0.0, y: -0.12, z: 0.02 };
    lm[11] = { x: 0.0, y: -0.08, z: 0.04 };
    lm[12] = { x: 0.0, y: -0.05, z: 0.03 };
    // Ring curled
    lm[13] = { x: 0.04, y: -0.08, z: 0 };
    lm[14] = { x: 0.04, y: -0.12, z: 0.02 };
    lm[15] = { x: 0.03, y: -0.08, z: 0.04 };
    lm[16] = { x: 0.02, y: -0.05, z: 0.03 };
    // Pinky curled
    lm[17] = { x: 0.07, y: -0.07, z: 0 };
    lm[18] = { x: 0.08, y: -0.10, z: 0.02 };
    lm[19] = { x: 0.07, y: -0.07, z: 0.04 };
    lm[20] = { x: 0.06, y: -0.04, z: 0.03 };
    return addNoise(lm);
}

/**
 * Generate synthetic THUMBS_UP landmarks.
 * Thumb extended up, all others curled.
 */
function generateThumbsUp() {
    const lm = generateClosedFist();
    // Override thumb to point up
    lm[1] = { x: -0.06, y: -0.05, z: 0 };
    lm[2] = { x: -0.10, y: -0.12, z: 0 };
    lm[3] = { x: -0.12, y: -0.20, z: 0 };
    lm[4] = { x: -0.13, y: -0.28, z: 0 };
    return addNoise(lm);
}

/**
 * Generate synthetic POINTING_UP landmarks.
 * Index extended, others curled.
 */
function generatePointingUp() {
    const lm = generateClosedFist();
    // Override index to point up
    lm[5] = { x: -0.04, y: -0.10, z: 0 };
    lm[6] = { x: -0.05, y: -0.18, z: 0 };
    lm[7] = { x: -0.05, y: -0.25, z: 0 };
    lm[8] = { x: -0.05, y: -0.32, z: 0 };
    return addNoise(lm);
}

/**
 * Generate synthetic PEACE_SIGN landmarks.
 * Index + middle extended, others curled.
 */
function generatePeaceSign() {
    const lm = generateClosedFist();
    // Override index
    lm[5] = { x: -0.04, y: -0.10, z: 0 };
    lm[6] = { x: -0.06, y: -0.18, z: 0 };
    lm[7] = { x: -0.07, y: -0.25, z: 0 };
    lm[8] = { x: -0.08, y: -0.32, z: 0 };
    // Override middle
    lm[9] = { x: 0.0, y: -0.10, z: 0 };
    lm[10] = { x: 0.02, y: -0.19, z: 0 };
    lm[11] = { x: 0.03, y: -0.26, z: 0 };
    lm[12] = { x: 0.04, y: -0.33, z: 0 };
    return addNoise(lm);
}

/**
 * Generate synthetic OK_SIGN landmarks.
 * Thumb + index touching, middle/ring/pinky extended.
 */
function generateOkSign() {
    const lm = generateOpenPalm();
    // Bring thumb + index tip together
    lm[8] = { x: -0.12, y: -0.14, z: 0 };
    lm[7] = { x: -0.10, y: -0.15, z: 0 };
    lm[6] = { x: -0.09, y: -0.13, z: 0 };
    lm[4] = { x: -0.12, y: -0.14, z: 0 };
    lm[3] = { x: -0.10, y: -0.12, z: 0 };
    return addNoise(lm);
}

/**
 * Generate synthetic CALL_ME landmarks.
 * Thumb + pinky extended, others curled.
 */
function generateCallMe() {
    const lm = generateClosedFist();
    // Thumb extended out
    lm[1] = { x: -0.07, y: -0.06, z: 0 };
    lm[2] = { x: -0.14, y: -0.10, z: 0 };
    lm[3] = { x: -0.20, y: -0.12, z: 0 };
    lm[4] = { x: -0.26, y: -0.14, z: 0 };
    // Pinky extended
    lm[17] = { x: 0.08, y: -0.09, z: 0 };
    lm[18] = { x: 0.10, y: -0.16, z: 0 };
    lm[19] = { x: 0.12, y: -0.22, z: 0 };
    lm[20] = { x: 0.14, y: -0.28, z: 0 };
    return addNoise(lm);
}

/**
 * Generate synthetic ROCK_SIGN landmarks.
 * Index + pinky extended, middle/ring curled.
 */
function generateRockSign() {
    const lm = generateClosedFist();
    // Index extended
    lm[5] = { x: -0.04, y: -0.10, z: 0 };
    lm[6] = { x: -0.05, y: -0.18, z: 0 };
    lm[7] = { x: -0.05, y: -0.25, z: 0 };
    lm[8] = { x: -0.05, y: -0.32, z: 0 };
    // Pinky extended
    lm[17] = { x: 0.08, y: -0.09, z: 0 };
    lm[18] = { x: 0.10, y: -0.16, z: 0 };
    lm[19] = { x: 0.12, y: -0.22, z: 0 };
    lm[20] = { x: 0.14, y: -0.28, z: 0 };
    return addNoise(lm);
}

/**
 * Generate synthetic THREE_FINGERS landmarks.
 * Index + middle + ring extended, thumb+pinky curled.
 */
function generateThreeFingers() {
    const lm = generateClosedFist();
    // Index
    lm[5] = { x: -0.04, y: -0.10, z: 0 };
    lm[6] = { x: -0.05, y: -0.18, z: 0 };
    lm[7] = { x: -0.05, y: -0.25, z: 0 };
    lm[8] = { x: -0.05, y: -0.32, z: 0 };
    // Middle
    lm[9] = { x: 0.0, y: -0.10, z: 0 };
    lm[10] = { x: 0.0, y: -0.19, z: 0 };
    lm[11] = { x: 0.0, y: -0.26, z: 0 };
    lm[12] = { x: 0.0, y: -0.33, z: 0 };
    // Ring
    lm[13] = { x: 0.04, y: -0.10, z: 0 };
    lm[14] = { x: 0.05, y: -0.18, z: 0 };
    lm[15] = { x: 0.05, y: -0.24, z: 0 };
    lm[16] = { x: 0.05, y: -0.30, z: 0 };
    return addNoise(lm);
}

/**
 * Generate synthetic FOUR_FINGERS landmarks.
 * Index + middle + ring + pinky extended, thumb curled.
 */
function generateFourFingers() {
    const lm = generateClosedFist();
    // Index
    lm[5] = { x: -0.04, y: -0.10, z: 0 };
    lm[6] = { x: -0.05, y: -0.18, z: 0 };
    lm[7] = { x: -0.05, y: -0.25, z: 0 };
    lm[8] = { x: -0.05, y: -0.32, z: 0 };
    // Middle
    lm[9] = { x: 0.0, y: -0.10, z: 0 };
    lm[10] = { x: 0.0, y: -0.19, z: 0 };
    lm[11] = { x: 0.0, y: -0.26, z: 0 };
    lm[12] = { x: 0.0, y: -0.33, z: 0 };
    // Ring
    lm[13] = { x: 0.04, y: -0.10, z: 0 };
    lm[14] = { x: 0.05, y: -0.18, z: 0 };
    lm[15] = { x: 0.05, y: -0.24, z: 0 };
    lm[16] = { x: 0.05, y: -0.30, z: 0 };
    // Pinky
    lm[17] = { x: 0.08, y: -0.09, z: 0 };
    lm[18] = { x: 0.10, y: -0.15, z: 0 };
    lm[19] = { x: 0.11, y: -0.20, z: 0 };
    lm[20] = { x: 0.12, y: -0.25, z: 0 };
    return addNoise(lm);
}

const GENERATORS = {
    'OPEN_PALM': generateOpenPalm,
    'CLOSED_FIST': generateClosedFist,
    'THUMBS_UP': generateThumbsUp,
    'POINTING_UP': generatePointingUp,
    'PEACE_SIGN': generatePeaceSign,
    'OK_SIGN': generateOkSign,
    'CALL_ME': generateCallMe,
    'ROCK_SIGN': generateRockSign,
    'THREE_FINGERS': generateThreeFingers,
    'FOUR_FINGERS': generateFourFingers
};

// ──────────────────────────────────────────────
// Preprocessing (must match gestureModel.js)
// ──────────────────────────────────────────────

function preprocessLandmarks(landmarks) {
    const wrist = landmarks[0];
    const values = [];
    for (const lm of landmarks) {
        values.push(lm.x - wrist.x);
        values.push(lm.y - wrist.y);
        values.push(lm.z - wrist.z);
    }
    return values;
}

// ──────────────────────────────────────────────
// Main Evaluation
// ──────────────────────────────────────────────

async function evaluate() {
    console.log('\n📊 Model Evaluation — Corporate Signal Translator\n');
    console.log(`Model: ${MODEL_PATH}`);
    console.log(`Test samples per class: ${SAMPLES_PER_CLASS}`);
    console.log(`Total test samples: ${SAMPLES_PER_CLASS * GESTURE_LABELS.length}\n`);

    // Load model
    let model;
    try {
        model = await tf.loadLayersModel(MODEL_PATH);
        console.log('✅ Model loaded successfully');
        console.log(`   Parameters: ${model.countParams().toLocaleString()}\n`);
    } catch (err) {
        console.error('❌ Failed to load model:', err.message);
        console.error('   Make sure public/model/model.json exists.');
        process.exit(1);
    }

    // Generate test data and predict
    const confusionMatrix = GESTURE_LABELS.map(() =>
        new Array(GESTURE_LABELS.length).fill(0)
    );

    let totalCorrect = 0;
    let totalSamples = 0;

    for (let trueIdx = 0; trueIdx < GESTURE_LABELS.length; trueIdx++) {
        const trueLabel = GESTURE_LABELS[trueIdx];
        const generator = GENERATORS[trueLabel];

        for (let s = 0; s < SAMPLES_PER_CLASS; s++) {
            const landmarks = generator();
            const features = preprocessLandmarks(landmarks);
            const input = tf.tensor2d([features], [1, 63]);
            const prediction = model.predict(input);
            const probs = prediction.dataSync();

            let predIdx = 0;
            let maxProb = probs[0];
            for (let i = 1; i < probs.length; i++) {
                if (probs[i] > maxProb) {
                    maxProb = probs[i];
                    predIdx = i;
                }
            }

            confusionMatrix[trueIdx][predIdx]++;
            if (predIdx === trueIdx) totalCorrect++;
            totalSamples++;

            input.dispose();
            prediction.dispose();
        }
    }

    // ── Print Results ──

    const overallAccuracy = (totalCorrect / totalSamples * 100).toFixed(1);
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  OVERALL ACCURACY: ${overallAccuracy}% (${totalCorrect}/${totalSamples})`);
    console.log(`${'═'.repeat(60)}\n`);

    // Per-class metrics
    console.log('Per-Class Metrics:');
    console.log(`${'─'.repeat(60)}`);
    console.log(`${'Gesture'.padEnd(15)} ${'Precision'.padEnd(12)} ${'Recall'.padEnd(12)} ${'F1-Score'.padEnd(12)} ${'Support'.padEnd(10)}`);
    console.log(`${'─'.repeat(60)}`);

    for (let i = 0; i < GESTURE_LABELS.length; i++) {
        const tp = confusionMatrix[i][i];
        const fp = confusionMatrix.reduce((sum, row, r) => sum + (r !== i ? row[i] : 0), 0);
        const fn = confusionMatrix[i].reduce((sum, val, c) => sum + (c !== i ? val : 0), 0);
        const support = confusionMatrix[i].reduce((a, b) => a + b, 0);

        const precision = tp + fp > 0 ? (tp / (tp + fp)) : 0;
        const recall = tp + fn > 0 ? (tp / (tp + fn)) : 0;
        const f1 = precision + recall > 0 ? (2 * precision * recall / (precision + recall)) : 0;

        console.log(
            `${GESTURE_LABELS[i].padEnd(15)} ${(precision * 100).toFixed(1).padStart(6)}%     ${(recall * 100).toFixed(1).padStart(6)}%     ${(f1 * 100).toFixed(1).padStart(6)}%     ${String(support).padStart(5)}`
        );
    }
    console.log(`${'─'.repeat(60)}\n`);

    // Confusion Matrix
    console.log('Confusion Matrix (rows=true, cols=predicted):');
    console.log(`${'─'.repeat(60)}`);
    const shortLabels = GESTURE_LABELS.map(l => l.substring(0, 7));
    console.log(`${''.padEnd(15)} ${shortLabels.map(l => l.padStart(8)).join('')}`);
    console.log(`${'─'.repeat(60)}`);

    for (let i = 0; i < GESTURE_LABELS.length; i++) {
        const row = confusionMatrix[i].map(v => String(v).padStart(8)).join('');
        console.log(`${GESTURE_LABELS[i].padEnd(15)} ${row}`);
    }
    console.log(`${'─'.repeat(60)}\n`);

    model.dispose();
}

evaluate().catch(console.error);
