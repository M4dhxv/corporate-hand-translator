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
        <div className="mt-6 glass-card p-5 sm:p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">Personalize Gestures</h2>
                        <p className="text-xs text-slate-corp-400">Train the AI to recognize your unique hand gestures</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="text-slate-corp-400 hover:text-white transition-colors p-1"
                    title="Close Training Mode"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Status Badge */}
            {hasPersonalized && !isTraining && trainStatus !== 'success' && (
                <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/15 border border-purple-500/30">
                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                    <span className="text-sm text-purple-300">Using your personalized model</span>
                </div>
            )}

            {/* Instructions */}
            <div className="mb-5 p-3 rounded-lg bg-navy-800/60 border border-navy-600/30">
                <p className="text-sm text-slate-corp-300 leading-relaxed">
                    📋 <strong className="text-white">How it works:</strong> Hold each gesture steady in front of the camera,
                    then click the corresponding button to record. Collect at least <strong className="text-green-400">{MIN_SAMPLES_PER_GESTURE} samples</strong> per
                    gesture, then train your personalized model.
                </p>
            </div>

            {/* Gesture Recording Buttons */}
            <div className="space-y-2.5 mb-5">
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
                                        ? 'bg-red-500/20 border-red-500/50 text-red-300 animate-pulse'
                                        : recording || isTraining
                                            ? 'bg-navy-800/30 border-navy-700/30 text-slate-corp-500 cursor-not-allowed'
                                            : 'bg-navy-700/40 border-navy-600/30 text-white hover:bg-navy-600/50 hover:border-navy-500/40'
                                    }
                                `}
                            >
                                <span className="text-xl">{info.emoji}</span>
                                <span className="flex-1 text-left">
                                    {isRecording ? `Recording ${info.name}…` : `Record ${info.name}`}
                                </span>

                                {/* Recording progress bar */}
                                {isRecording && (
                                    <div className="w-20 h-1.5 bg-navy-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-red-400 rounded-full transition-all duration-100"
                                            style={{ width: `${recordProgress}%` }}
                                        />
                                    </div>
                                )}
                            </button>

                            {/* Sample Count Badge */}
                            <div className={`
                                min-w-[52px] text-center px-2.5 py-1.5 rounded-lg text-xs font-bold
                                transition-all duration-300 border
                                ${isEnough
                                    ? 'bg-green-500/15 text-green-400 border-green-500/30'
                                    : count > 0
                                        ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                                        : 'bg-navy-800/50 text-slate-corp-500 border-navy-700/30'
                                }
                            `}>
                                {count}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Train Button */}
            <div className="space-y-3">
                <button
                    onClick={handleTrain}
                    disabled={!allReady || isTraining || recording}
                    className={`
                        w-full py-3 px-6 rounded-lg font-semibold text-sm
                        transition-all duration-300 border
                        ${allReady && !isTraining && !recording
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border-purple-500/30 shadow-lg hover:shadow-xl hover:scale-[1.02]'
                            : 'bg-navy-800/40 text-slate-corp-500 border-navy-700/30 cursor-not-allowed'
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

                {/* Training Progress Bar */}
                {isTraining && (
                    <div className="w-full h-2 bg-navy-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-300"
                            style={{ width: `${trainProgress.total > 0 ? (trainProgress.epoch / trainProgress.total) * 100 : 0}%` }}
                        />
                    </div>
                )}

                {/* Status Messages */}
                {trainStatus === 'success' && (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-green-500/15 border border-green-500/30">
                        <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm text-green-300 font-medium">Your gestures have been personalized.</span>
                    </div>
                )}

                {trainStatus === 'error' && (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/15 border border-red-500/30">
                        <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm text-red-300">Training failed. Please try recording more samples.</span>
                    </div>
                )}

                {/* Minimum samples hint */}
                {!allReady && !isTraining && (
                    <p className="text-xs text-slate-corp-500 text-center">
                        Record at least {MIN_SAMPLES_PER_GESTURE} samples per gesture to enable training
                    </p>
                )}
            </div>

            {/* Reset Button */}
            {(hasPersonalized || Object.values(sampleCounts).some(c => c > 0)) && (
                <div className="mt-4 pt-4 border-t border-navy-600/30">
                    <button
                        onClick={handleReset}
                        disabled={isTraining || recording}
                        className="w-full py-2.5 px-4 rounded-lg text-sm font-medium
                            text-slate-corp-400 hover:text-red-400
                            bg-navy-800/30 hover:bg-red-500/10
                            border border-navy-700/30 hover:border-red-500/30
                            transition-all duration-300
                            disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        🗑️ Reset Personalization
                    </button>
                </div>
            )}
        </div>
    );
}

export default TrainingMode;
