/**
 * localModelManager.js — IndexedDB Model Persistence
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
 * 
 * @returns {Promise<tf.LayersModel|null>}
 */
export async function loadUserModel() {
    try {
        const model = await tf.loadLayersModel(MODEL_KEY);
        console.log('🧠 Loaded user-trained model from IndexedDB');
        return model;
    } catch (err) {
        // No saved model — this is expected on first run
        console.log('ℹ️ No user model in IndexedDB, will use default');
        return null;
    }
}

/**
 * Save a trained model to IndexedDB.
 * Overwrites any previously saved model.
 * 
 * @param {tf.LayersModel} model - The trained model to persist
 * @returns {Promise<void>}
 */
export async function saveUserModel(model) {
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
 * 
 * @returns {Promise<void>}
 */
export async function clearUserModel() {
    try {
        await tf.io.removeModel(MODEL_KEY);
        console.log('🗑️ User model cleared from IndexedDB');
    } catch (err) {
        // Model might not exist — that's fine
        console.log('ℹ️ No user model to clear');
    }
}

/**
 * Check if a user-trained model exists in IndexedDB.
 * 
 * @returns {Promise<boolean>}
 */
export async function hasUserModel() {
    try {
        const models = await tf.io.listModels();
        return MODEL_KEY in models;
    } catch (err) {
        return false;
    }
}
