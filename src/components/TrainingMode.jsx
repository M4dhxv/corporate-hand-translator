import { useState, useRef, useCallback, useEffect } from 'react';
import {
    GESTURE_LABELS,
    MIN_SAMPLES_PER_GESTURE,
    addSample,
    getSampleCounts,
    canTrain,
    trainModel,
    clearDataset
} from '../ml/gestureTrainer';
import { saveUserModel, clearUserModel, hasUserModel } from '../ml/localModelManager';
import { swapModel, resetToDefaultModel, isUsingUserModel } from '../ml/gestureModel';

/**
 * TrainingMode Component
 * 
 * User-facing UI for personalizing gesture recognition.
 * Allows recording gesture samples, training a model,
 * and managing personalization — all in-browser.
 * 
 * No ML math here — delegates to gestureTrainer.js and localModelManager.js.
 */

/** Emoji + display name for each gesture */
const GESTURE_INFO = {
    'OPEN_PALM': { emoji: '✋', name: 'Open Palm' },
    'CLOSED_FIST': { emoji: '✊', name: 'Closed Fist' },
    'THUMBS_UP': { emoji: '👍', name: 'Thumbs Up' },
    'POINTING_UP': { emoji: '☝️', name: 'Pointing Up' },
    'PEACE_SIGN': { emoji: '✌️', name: 'Peace Sign' }
};

/** How long to record samples (ms) */
const RECORD_DURATION = 3000;

/** Interval between frame captures (ms) */
const CAPTURE_INTERVAL = 100;

function TrainingMode({ landmarksRef, onClose }) {
    const [sampleCounts, setSampleCounts] = useState(getSampleCounts());
    const [recording, setRecording] = useState(null); // currently recording gesture label
    const [recordProgress, setRecordProgress] = useState(0); // 0-100
    const [isTraining, setIsTraining] = useState(false);
    const [trainProgress, setTrainProgress] = useState({ epoch: 0, total: 0 });
    const [trainStatus, setTrainStatus] = useState(null); // 'success' | 'error' | null
    const [hasPersonalized, setHasPersonalized] = useState(false);

    const recordTimerRef = useRef(null);
    const captureIntervalRef = useRef(null);

    // Check if user already has a personalized model
    useEffect(() => {
        hasUserModel().then(setHasPersonalized);
    }, []);

    // Also check the in-memory flag
    useEffect(() => {
        setHasPersonalized(isUsingUserModel());
    }, []);

    /**
     * Start recording samples for a specific gesture.
     * Auto-captures landmark frames for RECORD_DURATION ms.
     */
    const startRecording = useCallback((label) => {
        if (recording || isTraining) return;

        setRecording(label);
        setRecordProgress(0);
        setTrainStatus(null);

        const startTime = Date.now();
        let framesCollected = 0;

        // Capture frames at regular intervals
        captureIntervalRef.current = setInterval(() => {
            const landmarks = landmarksRef.current;
            if (landmarks && landmarks.length === 21) {
                const added = addSample(landmarks, label);
                if (added) framesCollected++;
            }

            // Update progress
            const elapsed = Date.now() - startTime;
            setRecordProgress(Math.min(100, (elapsed / RECORD_DURATION) * 100));
        }, CAPTURE_INTERVAL);

        // Stop after duration
        recordTimerRef.current = setTimeout(() => {
            clearInterval(captureIntervalRef.current);
            captureIntervalRef.current = null;
            setRecording(null);
            setRecordProgress(0);
            setSampleCounts(getSampleCounts());
        }, RECORD_DURATION);
    }, [recording, isTraining, landmarksRef]);

    /**
     * Train the model using collected samples.
     */
    const handleTrain = useCallback(async () => {
        if (!canTrain() || isTraining) return;

        setIsTraining(true);
        setTrainStatus(null);
        setTrainProgress({ epoch: 0, total: 50 });

        try {
            const model = await trainModel((epoch, total) => {
                setTrainProgress({ epoch, total });
            });

            // Save to IndexedDB
            await saveUserModel(model);

            // Hot-swap the active model
            swapModel(model);

            setTrainStatus('success');
            setHasPersonalized(true);
        } catch (err) {
            console.error('Training failed:', err);
            setTrainStatus('error');
        } finally {
            setIsTraining(false);
        }
    }, [isTraining]);

    /**
     * Reset personalization — clear dataset, model, revert to default.
     */
    const handleReset = useCallback(async () => {
        if (isTraining || recording) return;

        clearDataset();
        await clearUserModel();
        await resetToDefaultModel();

        setSampleCounts(getSampleCounts());
        setTrainStatus(null);
        setTrainProgress({ epoch: 0, total: 0 });
        setHasPersonalized(false);
    }, [isTraining, recording]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (recordTimerRef.current) clearTimeout(recordTimerRef.current);
            if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
        };
    }, []);

    const allReady = canTrain();

    return (
        <div className="h-full flex flex-col overflow-hidden bg-white dark:bg-neutral-900">
            {/* Sticky header with close button */}
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-neutral-200/50 dark:border-neutral-800/50">
                <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">
                        Personalize Gestures
                    </h2>
                </div>
                <button
                    onClick={onClose}
                    className="ml-4 p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex-shrink-0"
                    title="Close"
                >
                    <svg className="w-5 h-5 text-neutral-600 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {/* Status badge */}
                {hasPersonalized && !isTraining && trainStatus !== 'success' && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                        <span className="text-sm text-blue-700 dark:text-blue-400">Using your personalized model</span>
                    </div>
                )}

                {/* Instructions */}
                <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
                    <p className="text-sm text-neutral-700 dark:text-neutral-300">
                        <strong>How to train:</strong> Hold each gesture steady, then click "Record" to collect samples. 
                        Gather at least <strong>{MIN_SAMPLES_PER_GESTURE} samples</strong> per gesture, then train your model.
                    </p>
                </div>

                {/* Gesture recording buttons */}
                <div className="space-y-2.5">
                    {GESTURE_LABELS.map((label) => {
                        const info = GESTURE_INFO[label];
                        const count = sampleCounts[label] || 0;
                        const isRecording = recording === label;
                        const isEnough = count >= MIN_SAMPLES_PER_GESTURE;

                        return (
                            <div key={label} className="flex items-center gap-3">
                                {/* Record Button */}
                                <button
                                    onClick={() => startRecording(label)}
                                    disabled={recording !== null || isTraining}
                                    className={`
                                        flex-1 flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium
                                        transition-all duration-300 border
                                        ${isRecording
                                            ? 'bg-red-100 dark:bg-red-500/15 border-red-300 dark:border-red-500/30 text-red-700 dark:text-red-400 animate-pulse'
                                            : recording || isTraining
                                                ? 'bg-neutral-100 dark:bg-neutral-800/30 border-neutral-200 dark:border-neutral-700 text-neutral-500 cursor-not-allowed'
                                                : 'bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700 text-neutral-950 dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800'
                                        }
                                    `}
                                >
                                    <span className="text-xl flex-shrink-0">{info.emoji}</span>
                                    <span className="flex-1 text-left">
                                        {isRecording ? `Recording ${info.name}…` : `Record ${info.name}`}
                                    </span>

                                    {/* Recording progress */}
                                    {isRecording && (
                                        <div className="w-20 h-1.5 bg-neutral-300 dark:bg-neutral-700 rounded-full overflow-hidden flex-shrink-0">
                                            <div
                                                className="h-full bg-red-500 rounded-full transition-all duration-100"
                                                style={{ width: `${recordProgress}%` }}
                                            />
                                        </div>
                                    )}
                                </button>

                                {/* Sample count */}
                                <div className={`
                                    min-w-[52px] text-center px-2.5 py-1.5 rounded-lg text-xs font-bold
                                    transition-all duration-300 border flex-shrink-0
                                    ${isEnough
                                        ? 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400 border-green-300 dark:border-green-500/30'
                                        : count > 0
                                            ? 'bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-500/30'
                                            : 'bg-neutral-100 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-500 border-neutral-200 dark:border-neutral-700'
                                    }
                                `}>
                                    {count}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Train button and messages */}
                <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
                    <button
                        onClick={handleTrain}
                        disabled={!allReady || isTraining || recording}
                        className={`
                            w-full py-3 px-6 rounded-lg font-semibold text-sm
                            transition-all duration-300 border
                            ${allReady && !isTraining && !recording
                                ? 'bg-blue-500 hover:bg-blue-600 text-white border-blue-600 shadow-md hover:shadow-lg'
                                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border-neutral-200 dark:border-neutral-700 cursor-not-allowed'
                            }
                        `}
                    >
                        {isTraining ? (
                            <span className="flex items-center justify-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Training… ({trainProgress.epoch}/{trainProgress.total})
                            </span>
                        ) : (
                            '🧠 Train My Gestures'
                        )}
                    </button>

                    {/* Training progress */}
                    {isTraining && (
                        <div className="mt-3 w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                                style={{ width: `${trainProgress.total > 0 ? (trainProgress.epoch / trainProgress.total) * 100 : 0}%` }}
                            />
                        </div>
                    )}

                    {/* Success message */}
                    {trainStatus === 'success' && (
                        <div className="mt-3 flex items-center gap-2 px-4 py-3 rounded-lg bg-green-100 dark:bg-green-500/15 border border-green-300 dark:border-green-500/30">
                            <svg className="w-5 h-5 text-green-700 dark:text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-sm text-green-700 dark:text-green-400">Your gestures are personalized.</span>
                        </div>
                    )}

                    {/* Error message */}
                    {trainStatus === 'error' && (
                        <div className="mt-3 flex items-center gap-2 px-4 py-3 rounded-lg bg-red-100 dark:bg-red-500/15 border border-red-300 dark:border-red-500/30">
                            <svg className="w-5 h-5 text-red-700 dark:text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-sm text-red-700 dark:text-red-400">Training failed. Try recording more samples.</span>
                        </div>
                    )}

                    {!allReady && !isTraining && (
                        <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-400 text-center">
                            Record at least {MIN_SAMPLES_PER_GESTURE} samples per gesture to train
                        </p>
                    )}
                </div>

                {/* Reset button */}
                {(hasPersonalized || Object.values(sampleCounts).some(c => c > 0)) && (
                    <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
                        <button
                            onClick={handleReset}
                            disabled={isTraining || recording}
                            className="w-full py-2.5 px-4 rounded-lg text-sm font-medium
                                text-neutral-700 dark:text-neutral-300
                                bg-neutral-100 dark:bg-neutral-800/50
                                border border-neutral-200 dark:border-neutral-700
                                hover:text-red-700 dark:hover:text-red-400
                                hover:bg-red-100 dark:hover:bg-red-500/10
                                hover:border-red-300 dark:hover:border-red-500/30
                                transition-all duration-300
                                disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            🗑️ Reset Personalization
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default TrainingMode;
