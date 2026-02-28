/**
 * localModelManager.ts — IndexedDB Model Persistence
 *
 * Handles saving, loading, and clearing user-trained gesture models
 * in the browser's IndexedDB via TensorFlow.js built-in I/O.
 *
 * Storage key: indexeddb://corporate-gesture-model
 *
 * Privacy: All data stays in the user's browser.
 * No uploads, no server calls, no file downloads.
 */

import * as tf from '@tensorflow/tfjs';

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const MODEL_KEY = 'indexeddb://corporate-gesture-model';

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Attempt to load a user-trained model from IndexedDB.
 * Returns the model if found, or null if no saved model exists.
 */
export async function loadUserModel(): Promise<tf.LayersModel | null> {
    try {
        const model = await tf.loadLayersModel(MODEL_KEY);
        console.log('🧠 Loaded user-trained model from IndexedDB');
        return model;
    } catch {
        // No saved model — this is expected on first run
        console.log('ℹ️ No user model in IndexedDB, will use default');
        return null;
    }
}

/**
 * Save a trained model to IndexedDB.
 * Overwrites any previously saved model.
 */
export async function saveUserModel(model: tf.LayersModel): Promise<void> {
    try {
        await model.save(MODEL_KEY);
        console.log('💾 User model saved to IndexedDB');
    } catch (err) {
        console.error('Failed to save user model:', err);
        throw err;
    }
}

/**
 * Remove the user-trained model from IndexedDB.
 * After clearing, the app will fall back to the default model on next load.
 */
export async function clearUserModel(): Promise<void> {
    try {
        await tf.io.removeModel(MODEL_KEY);
        console.log('🗑️ User model cleared from IndexedDB');
    } catch {
        // Model might not exist — that's fine
        console.log('ℹ️ No user model to clear');
    }
}

/**
 * Check if a user-trained model exists in IndexedDB.
 */
export async function hasUserModel(): Promise<boolean> {
    try {
        const models = await tf.io.listModels();
        return MODEL_KEY in models;
    } catch {
        return false;
    }
}
