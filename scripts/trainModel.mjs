/**
 * trainModel.mjs — Offline Model Training Script
 * 
 * Generates synthetic hand landmark data for 10 gesture classes,
 * trains a small feed-forward neural network, and saves the model
 * to public/model/ for browser-side inference via TensorFlow.js.
 * 
 * Usage: node scripts/trainModel.mjs
 * 
 * Why offline training?
 * - Keeps the browser bundle small (no training code shipped)
 * - Ensures deterministic, high-quality model weights
 * - Training happens once; inference is instant at runtime
 */

import * as tf from '@tensorflow/tfjs';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODEL_DIR = join(__dirname, '..', 'public', 'model');

// Gesture classes — order matches model output indices
const GESTURE_CLASSES = [
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

const SAMPLES_PER_CLASS = 800;
const EPOCHS = 100;
const BATCH_SIZE = 32;

// ──────────────────────────────────────────────
// Synthetic Data Generators
// ──────────────────────────────────────────────

/** Add gaussian noise to a value */
function noise(val, stddev = 0.03) {
    return val + (Math.random() - 0.5) * 2 * stddev;
}

/** Random float in range */
function rand(min, max) {
    return min + Math.random() * (max - min);
}

/**
 * Generate a base hand skeleton with realistic proportions.
 * Returns 21 landmarks [{x, y, z}, ...] in normalized [0,1] space.
 */
function generateBaseHand() {
    const wrist = { x: 0.5, y: 0.8, z: 0 };

    // MCP joints (base of each finger)
    const thumbCMC = { x: wrist.x + 0.08, y: wrist.y - 0.05, z: 0 };
    const thumbMCP = { x: wrist.x + 0.12, y: wrist.y - 0.10, z: 0 };
    const indexMCP = { x: wrist.x + 0.06, y: wrist.y - 0.22, z: 0 };
    const middleMCP = { x: wrist.x + 0.02, y: wrist.y - 0.24, z: 0 };
    const ringMCP = { x: wrist.x - 0.02, y: wrist.y - 0.22, z: 0 };
    const pinkyMCP = { x: wrist.x - 0.06, y: wrist.y - 0.20, z: 0 };

    return {
        wrist, thumbCMC, thumbMCP,
        indexMCP, middleMCP, ringMCP, pinkyMCP
    };
}

/**
 * Generate extended finger landmarks (tip above MCP).
 */
function extendedFinger(mcpX, mcpY, length = 0.15, spreadX = 0) {
    const pip = { x: noise(mcpX + spreadX * 0.3), y: noise(mcpY - length * 0.4), z: noise(0) };
    const dip = { x: noise(mcpX + spreadX * 0.6), y: noise(mcpY - length * 0.7), z: noise(0) };
    const tip = { x: noise(mcpX + spreadX), y: noise(mcpY - length), z: noise(0) };
    return { pip, dip, tip };
}

/**
 * Generate curled finger landmarks (tip below PIP, near palm).
 */
function curledFinger(mcpX, mcpY) {
    const pip = { x: noise(mcpX), y: noise(mcpY - 0.03), z: noise(0) };
    const dip = { x: noise(mcpX), y: noise(mcpY + 0.02), z: noise(0) };
    const tip = { x: noise(mcpX), y: noise(mcpY + 0.04), z: noise(0) };
    return { pip, dip, tip };
}

/**
 * Assemble 21 landmarks from finger components.
 * Order: wrist, thumb(4), index(4), middle(4), ring(4), pinky(4)
 */
function assembleLandmarks(wrist, thumb, index, middle, ring, pinky) {
    return [
        wrist,                                              // 0: Wrist
        thumb.cmc, thumb.mcp, thumb.ip, thumb.tip,          // 1-4: Thumb
        index.mcp, index.pip, index.dip, index.tip,         // 5-8: Index
        middle.mcp, middle.pip, middle.dip, middle.tip,     // 9-12: Middle
        ring.mcp, ring.pip, ring.dip, ring.tip,             // 13-16: Ring
        pinky.mcp, pinky.pip, pinky.dip, pinky.tip          // 17-20: Pinky
    ];
}

/** Generate OPEN_PALM: all 5 fingers extended */
function generateOpenPalm() {
    const base = generateBaseHand();
    const w = base.wrist;

    const thumbIP = { x: noise(w.x + 0.16), y: noise(w.y - 0.14), z: noise(0) };
    const thumbTip = { x: noise(w.x + 0.20), y: noise(w.y - 0.18), z: noise(0) };
    const thumb = { cmc: base.thumbCMC, mcp: base.thumbMCP, ip: thumbIP, tip: thumbTip };

    const idx = extendedFinger(base.indexMCP.x, base.indexMCP.y, rand(0.12, 0.18), rand(-0.01, 0.02));
    const mid = extendedFinger(base.middleMCP.x, base.middleMCP.y, rand(0.13, 0.19), rand(-0.01, 0.01));
    const rng = extendedFinger(base.ringMCP.x, base.ringMCP.y, rand(0.11, 0.16), rand(-0.02, 0.01));
    const pnk = extendedFinger(base.pinkyMCP.x, base.pinkyMCP.y, rand(0.09, 0.14), rand(-0.02, -0.01));

    const index = { mcp: base.indexMCP, ...idx };
    const middle = { mcp: base.middleMCP, ...mid };
    const ring = { mcp: base.ringMCP, ...rng };
    const pinky = { mcp: base.pinkyMCP, ...pnk };

    return assembleLandmarks(w, thumb, index, middle, ring, pinky);
}

/** Generate CLOSED_FIST: all fingers curled, thumb wrapped */
function generateClosedFist() {
    const base = generateBaseHand();
    const w = base.wrist;

    const thumbIP = { x: noise(w.x + 0.06), y: noise(w.y - 0.08), z: noise(0) };
    const thumbTip = { x: noise(w.x + 0.04), y: noise(w.y - 0.06), z: noise(0) };
    const thumb = { cmc: base.thumbCMC, mcp: base.thumbMCP, ip: thumbIP, tip: thumbTip };

    const idxC = curledFinger(base.indexMCP.x, base.indexMCP.y);
    const midC = curledFinger(base.middleMCP.x, base.middleMCP.y);
    const rngC = curledFinger(base.ringMCP.x, base.ringMCP.y);
    const pnkC = curledFinger(base.pinkyMCP.x, base.pinkyMCP.y);

    const index = { mcp: base.indexMCP, ...idxC };
    const middle = { mcp: base.middleMCP, ...midC };
    const ring = { mcp: base.ringMCP, ...rngC };
    const pinky = { mcp: base.pinkyMCP, ...pnkC };

    return assembleLandmarks(w, thumb, index, middle, ring, pinky);
}

/** Generate THUMBS_UP: thumb extended upward, all fingers curled */
function generateThumbsUp() {
    const base = generateBaseHand();
    const w = base.wrist;

    // Thumb pointing straight up
    const thumbIP = { x: noise(w.x + 0.10, 0.02), y: noise(w.y - 0.20), z: noise(0) };
    const thumbTip = { x: noise(w.x + 0.10, 0.02), y: noise(w.y - 0.28), z: noise(0) };
    const thumb = { cmc: base.thumbCMC, mcp: base.thumbMCP, ip: thumbIP, tip: thumbTip };

    const idxC = curledFinger(base.indexMCP.x, base.indexMCP.y);
    const midC = curledFinger(base.middleMCP.x, base.middleMCP.y);
    const rngC = curledFinger(base.ringMCP.x, base.ringMCP.y);
    const pnkC = curledFinger(base.pinkyMCP.x, base.pinkyMCP.y);

    const index = { mcp: base.indexMCP, ...idxC };
    const middle = { mcp: base.middleMCP, ...midC };
    const ring = { mcp: base.ringMCP, ...rngC };
    const pinky = { mcp: base.pinkyMCP, ...pnkC };

    return assembleLandmarks(w, thumb, index, middle, ring, pinky);
}

/** Generate POINTING_UP: only index finger extended */
function generatePointingUp() {
    const base = generateBaseHand();
    const w = base.wrist;

    const thumbIP = { x: noise(w.x + 0.06), y: noise(w.y - 0.08), z: noise(0) };
    const thumbTip = { x: noise(w.x + 0.04), y: noise(w.y - 0.06), z: noise(0) };
    const thumb = { cmc: base.thumbCMC, mcp: base.thumbMCP, ip: thumbIP, tip: thumbTip };

    const idx = extendedFinger(base.indexMCP.x, base.indexMCP.y, rand(0.13, 0.19), rand(-0.01, 0.01));
    const midC = curledFinger(base.middleMCP.x, base.middleMCP.y);
    const rngC = curledFinger(base.ringMCP.x, base.ringMCP.y);
    const pnkC = curledFinger(base.pinkyMCP.x, base.pinkyMCP.y);

    const index = { mcp: base.indexMCP, ...idx };
    const middle = { mcp: base.middleMCP, ...midC };
    const ring = { mcp: base.ringMCP, ...rngC };
    const pinky = { mcp: base.pinkyMCP, ...pnkC };

    return assembleLandmarks(w, thumb, index, middle, ring, pinky);
}

/** Generate PEACE_SIGN: index + middle extended, rest curled */
function generatePeaceSign() {
    const base = generateBaseHand();
    const w = base.wrist;

    const thumbIP = { x: noise(w.x + 0.06), y: noise(w.y - 0.08), z: noise(0) };
    const thumbTip = { x: noise(w.x + 0.04), y: noise(w.y - 0.06), z: noise(0) };
    const thumb = { cmc: base.thumbCMC, mcp: base.thumbMCP, ip: thumbIP, tip: thumbTip };

    const idx = extendedFinger(base.indexMCP.x, base.indexMCP.y, rand(0.13, 0.19), rand(0.01, 0.03));
    const mid = extendedFinger(base.middleMCP.x, base.middleMCP.y, rand(0.13, 0.19), rand(-0.03, -0.01));
    const rngC = curledFinger(base.ringMCP.x, base.ringMCP.y);
    const pnkC = curledFinger(base.pinkyMCP.x, base.pinkyMCP.y);

    const index = { mcp: base.indexMCP, ...idx };
    const middle = { mcp: base.middleMCP, ...mid };
    const ring = { mcp: base.ringMCP, ...rngC };
    const pinky = { mcp: base.pinkyMCP, ...pnkC };

    return assembleLandmarks(w, thumb, index, middle, ring, pinky);
}

/** Generate OK_SIGN: thumb + index touch, middle/ring/pinky extended */
function generateOkSign() {
    const base = generateBaseHand();
    const w = base.wrist;

    const indexMCP = base.indexMCP;
    const thumbTip = {
        x: noise(indexMCP.x + 0.01),
        y: noise(indexMCP.y - 0.02),
        z: noise(0)
    };
    const thumbIP = {
        x: noise((base.thumbMCP.x + thumbTip.x) * 0.5),
        y: noise((base.thumbMCP.y + thumbTip.y) * 0.5),
        z: noise(0)
    };
    const thumb = { cmc: base.thumbCMC, mcp: base.thumbMCP, ip: thumbIP, tip: thumbTip };

    const indexPip = { x: noise(indexMCP.x + 0.01), y: noise(indexMCP.y - 0.04), z: noise(0) };
    const indexDip = { x: noise(indexMCP.x + 0.015), y: noise(indexMCP.y - 0.03), z: noise(0) };
    const index = { mcp: indexMCP, pip: indexPip, dip: indexDip, tip: thumbTip };

    const mid = extendedFinger(base.middleMCP.x, base.middleMCP.y, rand(0.13, 0.19), rand(-0.01, 0.01));
    const rng = extendedFinger(base.ringMCP.x, base.ringMCP.y, rand(0.11, 0.17), rand(-0.01, 0.01));
    const pnk = extendedFinger(base.pinkyMCP.x, base.pinkyMCP.y, rand(0.10, 0.15), rand(-0.02, -0.005));

    const middle = { mcp: base.middleMCP, ...mid };
    const ring = { mcp: base.ringMCP, ...rng };
    const pinky = { mcp: base.pinkyMCP, ...pnk };

    return assembleLandmarks(w, thumb, index, middle, ring, pinky);
}

/** Generate CALL_ME: thumb + pinky extended, other fingers curled
 *  - Randomizes left/right hand and palm/knuckle facing
 */
function generateCallMe() {
    // Randomly choose left/right hand
    const isLeft = Math.random() < 0.5;
    // Randomly choose palm or knuckle facing camera
    const palmFacing = Math.random() < 0.5;

    // Mirror base hand for left hand
    function maybeMirrorX(val) {
        return isLeft ? 1 - val : val;
    }

    // For palm/knuckle, flip y axis (simulate back of hand)
    function maybeFlipY(val) {
        return palmFacing ? val : 1 - val;
    }

    const base = generateBaseHand();
    const w = { x: maybeMirrorX(base.wrist.x), y: maybeFlipY(base.wrist.y), z: base.wrist.z };

    // Thumb extended (direction depends on hand)
    const thumbIP = { x: maybeMirrorX(w.x + (isLeft ? -0.18 : 0.18)), y: maybeFlipY(w.y - 0.10), z: noise(0) };
    const thumbTip = { x: maybeMirrorX(w.x + (isLeft ? -0.25 : 0.25)), y: maybeFlipY(w.y - 0.12), z: noise(0) };
    const thumb = {
        cmc: { x: maybeMirrorX(base.thumbCMC.x), y: maybeFlipY(base.thumbCMC.y), z: base.thumbCMC.z },
        mcp: { x: maybeMirrorX(base.thumbMCP.x), y: maybeFlipY(base.thumbMCP.y), z: base.thumbMCP.z },
        ip: thumbIP,
        tip: thumbTip
    };

    // Pinky extended (direction depends on hand)
    const pnk = extendedFinger(
        maybeMirrorX(base.pinkyMCP.x),
        maybeFlipY(base.pinkyMCP.y),
        rand(0.14, 0.20),
        rand(isLeft ? 0.015 : -0.03, isLeft ? 0.03 : -0.015)
    );

    // Other fingers curled
    const idxC = curledFinger(maybeMirrorX(base.indexMCP.x), maybeFlipY(base.indexMCP.y));
    const midC = curledFinger(maybeMirrorX(base.middleMCP.x), maybeFlipY(base.middleMCP.y));
    const rngC = curledFinger(maybeMirrorX(base.ringMCP.x), maybeFlipY(base.ringMCP.y));

    const index = { mcp: { x: maybeMirrorX(base.indexMCP.x), y: maybeFlipY(base.indexMCP.y), z: base.indexMCP.z }, ...idxC };
    const middle = { mcp: { x: maybeMirrorX(base.middleMCP.x), y: maybeFlipY(base.middleMCP.y), z: base.middleMCP.z }, ...midC };
    const ring = { mcp: { x: maybeMirrorX(base.ringMCP.x), y: maybeFlipY(base.ringMCP.y), z: base.ringMCP.z }, ...rngC };
    const pinky = { mcp: { x: maybeMirrorX(base.pinkyMCP.x), y: maybeFlipY(base.pinkyMCP.y), z: base.pinkyMCP.z }, ...pnk };

    return assembleLandmarks(w, thumb, index, middle, ring, pinky);
}

/** Generate ROCK_SIGN: index + pinky extended, middle/ring curled, thumb tucked */
function generateRockSign() {
    const base = generateBaseHand();
    const w = base.wrist;

    const thumbIP = { x: noise(w.x + 0.06), y: noise(w.y - 0.08), z: noise(0) };
    const thumbTip = { x: noise(w.x + 0.04), y: noise(w.y - 0.06), z: noise(0) };
    const thumb = { cmc: base.thumbCMC, mcp: base.thumbMCP, ip: thumbIP, tip: thumbTip };

    const idx = extendedFinger(base.indexMCP.x, base.indexMCP.y, rand(0.13, 0.19), rand(-0.01, 0.01));
    const midC = curledFinger(base.middleMCP.x, base.middleMCP.y);
    const rngC = curledFinger(base.ringMCP.x, base.ringMCP.y);
    const pnk = extendedFinger(base.pinkyMCP.x, base.pinkyMCP.y, rand(0.12, 0.18), rand(-0.03, -0.015));

    const index = { mcp: base.indexMCP, ...idx };
    const middle = { mcp: base.middleMCP, ...midC };
    const ring = { mcp: base.ringMCP, ...rngC };
    const pinky = { mcp: base.pinkyMCP, ...pnk };

    return assembleLandmarks(w, thumb, index, middle, ring, pinky);
}

/** Generate THREE_FINGERS: index/middle/ring extended, thumb+pinky curled */
function generateThreeFingers() {
    const base = generateBaseHand();
    const w = base.wrist;

    const thumbIP = { x: noise(w.x + 0.06), y: noise(w.y - 0.08), z: noise(0) };
    const thumbTip = { x: noise(w.x + 0.04), y: noise(w.y - 0.06), z: noise(0) };
    const thumb = { cmc: base.thumbCMC, mcp: base.thumbMCP, ip: thumbIP, tip: thumbTip };

    const idx = extendedFinger(base.indexMCP.x, base.indexMCP.y, rand(0.13, 0.19), rand(-0.01, 0.01));
    const mid = extendedFinger(base.middleMCP.x, base.middleMCP.y, rand(0.13, 0.19), rand(-0.01, 0.01));
    const rng = extendedFinger(base.ringMCP.x, base.ringMCP.y, rand(0.11, 0.17), rand(-0.01, 0.01));
    const pnkC = curledFinger(base.pinkyMCP.x, base.pinkyMCP.y);

    const index = { mcp: base.indexMCP, ...idx };
    const middle = { mcp: base.middleMCP, ...mid };
    const ring = { mcp: base.ringMCP, ...rng };
    const pinky = { mcp: base.pinkyMCP, ...pnkC };

    return assembleLandmarks(w, thumb, index, middle, ring, pinky);
}

/** Generate FOUR_FINGERS: index/middle/ring/pinky extended, thumb curled */
function generateFourFingers() {
    const base = generateBaseHand();
    const w = base.wrist;

    const thumbIP = { x: noise(w.x + 0.06), y: noise(w.y - 0.08), z: noise(0) };
    const thumbTip = { x: noise(w.x + 0.04), y: noise(w.y - 0.06), z: noise(0) };
    const thumb = { cmc: base.thumbCMC, mcp: base.thumbMCP, ip: thumbIP, tip: thumbTip };

    const idx = extendedFinger(base.indexMCP.x, base.indexMCP.y, rand(0.13, 0.19), rand(-0.01, 0.02));
    const mid = extendedFinger(base.middleMCP.x, base.middleMCP.y, rand(0.13, 0.19), rand(-0.01, 0.01));
    const rng = extendedFinger(base.ringMCP.x, base.ringMCP.y, rand(0.11, 0.17), rand(-0.01, 0.01));
    const pnk = extendedFinger(base.pinkyMCP.x, base.pinkyMCP.y, rand(0.10, 0.15), rand(-0.02, -0.005));

    const index = { mcp: base.indexMCP, ...idx };
    const middle = { mcp: base.middleMCP, ...mid };
    const ring = { mcp: base.ringMCP, ...rng };
    const pinky = { mcp: base.pinkyMCP, ...pnk };

    return assembleLandmarks(w, thumb, index, middle, ring, pinky);
}

const GENERATORS = [
    generateOpenPalm,
    generateClosedFist,
    generateThumbsUp,
    generatePointingUp,
    generatePeaceSign,
    generateOkSign,
    generateCallMe,
    generateRockSign,
    generateThreeFingers,
    generateFourFingers
];

// ──────────────────────────────────────────────
// Preprocessing (must match browser-side logic)
// ──────────────────────────────────────────────

/**
 * Flatten 21 landmarks to 63 values, normalized relative to wrist.
 */
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
// Dataset Generation
// ──────────────────────────────────────────────

function generateDataset() {
    const inputs = [];
    const labels = [];

    for (let classIdx = 0; classIdx < GENERATORS.length; classIdx++) {
        const generator = GENERATORS[classIdx];
        for (let i = 0; i < SAMPLES_PER_CLASS; i++) {
            const landmarks = generator();
            const features = preprocessLandmarks(landmarks);
            inputs.push(features);
            labels.push(classIdx);
        }
    }

    // Shuffle
    const indices = Array.from({ length: inputs.length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    const shuffledInputs = indices.map(i => inputs[i]);
    const shuffledLabels = indices.map(i => labels[i]);

    return {
        xs: tf.tensor2d(shuffledInputs),
        ys: tf.oneHot(tf.tensor1d(shuffledLabels, 'int32'), GESTURE_CLASSES.length)
    };
}

// ──────────────────────────────────────────────
// Model Architecture
// ──────────────────────────────────────────────

function buildModel() {
    const model = tf.sequential();

    // Input layer: 63 features (21 landmarks × 3 coordinates)
    model.add(tf.layers.dense({
        inputShape: [63],
        units: 128,
        activation: 'relu',
        kernelInitializer: 'heNormal'
    }));

    model.add(tf.layers.dropout({ rate: 0.3 }));

    model.add(tf.layers.dense({
        units: 64,
        activation: 'relu',
        kernelInitializer: 'heNormal'
    }));

    model.add(tf.layers.dropout({ rate: 0.2 }));

    // Output layer: N gesture classes with softmax
    model.add(tf.layers.dense({
        units: GESTURE_CLASSES.length,
        activation: 'softmax'
    }));

    model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
    });

    return model;
}

// ──────────────────────────────────────────────
// Main Training Routine
// ──────────────────────────────────────────────

async function main() {
    console.log('🧠 Generating synthetic training data...');
    console.log(`   ${SAMPLES_PER_CLASS} samples × ${GESTURE_CLASSES.length} classes = ${SAMPLES_PER_CLASS * GESTURE_CLASSES.length} total`);

    const { xs, ys } = generateDataset();

    console.log(`🏗️  Building model (63 → 128 → 64 → ${GESTURE_CLASSES.length})...`);
    const model = buildModel();
    model.summary();

    console.log(`\n🏋️  Training for ${EPOCHS} epochs...\n`);

    await model.fit(xs, ys, {
        epochs: EPOCHS,
        batchSize: BATCH_SIZE,
        validationSplit: 0.2,
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                if ((epoch + 1) % 10 === 0) {
                    console.log(
                        `  Epoch ${(epoch + 1).toString().padStart(3)}: ` +
                        `loss=${logs.loss.toFixed(4)} acc=${logs.acc.toFixed(4)} | ` +
                        `val_loss=${logs.val_loss.toFixed(4)} val_acc=${logs.val_acc.toFixed(4)}`
                    );
                }
            }
        }
    });

    // Save model using custom file handler (pure tfjs has no file:// support)
    if (!existsSync(MODEL_DIR)) {
        mkdirSync(MODEL_DIR, { recursive: true });
    }

    const saveHandler = {
        async save(modelArtifacts) {
            // Build model.json topology + weightsManifest
            const weightsManifestEntry = {
                paths: ['group1-shard1of1.bin'],
                weights: modelArtifacts.weightSpecs
            };

            const modelJSON = {
                modelTopology: modelArtifacts.modelTopology,
                format: modelArtifacts.format,
                generatedBy: modelArtifacts.generatedBy,
                convertedBy: modelArtifacts.convertedBy,
                weightsManifest: [weightsManifestEntry]
            };

            // Write model.json
            writeFileSync(
                join(MODEL_DIR, 'model.json'),
                JSON.stringify(modelJSON),
                'utf8'
            );

            // Write weights binary
            const weightsBuffer = Buffer.from(modelArtifacts.weightData);
            writeFileSync(
                join(MODEL_DIR, 'group1-shard1of1.bin'),
                weightsBuffer
            );

            return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: 'JSON' } };
        }
    };

    await model.save(saveHandler);

    console.log(`\n✅ Model saved to ${MODEL_DIR}`);
    console.log('   Files: model.json + group1-shard1of1.bin');
    console.log('   Ready for browser inference via TensorFlow.js');

    // Cleanup
    xs.dispose();
    ys.dispose();
    model.dispose();
}

main().catch(console.error);
