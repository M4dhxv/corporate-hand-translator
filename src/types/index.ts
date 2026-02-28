/**
 * Shared TypeScript interfaces for the Corporate Signal Translator.
 *
 * All domain types live here — components, hooks, and ML modules
 * import from this single file rather than re-declaring ad-hoc shapes.
 */

// ──────────────────────────────────────────────
// MediaPipe Landmarks
// ──────────────────────────────────────────────

/** A single 3D hand landmark from MediaPipe Hands. */
export interface Landmark {
    x: number;
    y: number;
    z: number;
}

/** MediaPipe Hands result for a single frame. */
export interface HandResults {
    multiHandLandmarks?: Landmark[][];
    multiHandedness?: Array<{ label: string; score: number }>;
}

// ──────────────────────────────────────────────
// ML Prediction
// ──────────────────────────────────────────────

/** Output of predictGesture() — raw ML inference result. */
export interface MLPrediction {
    gestureType: string | null;
    phrase: string;
    label: string;
    confidence: number;
    probabilities: Record<string, number>;
}

// ──────────────────────────────────────────────
// Decision Engine
// ──────────────────────────────────────────────

/** A single stability buffer entry used by the decision engine. */
export interface StabilityEntry {
    label: string;
    confidence: number;
    timestamp: number;
}

/** Output of the decision engine when a gesture is accepted. */
export interface GestureResult {
    label: string;
    gestureType: string | null;
    phrase: string;
    reason: string;
}

/** Snapshot of the decision engine state (for debugging). */
export interface EngineState {
    acceptedGesture: string | null;
    inCooldown: boolean;
    stabilityBufferSize: number;
    cooldownTimeRemaining: number;
}

// ──────────────────────────────────────────────
// Gesture Detection (UI callback payload)
// ──────────────────────────────────────────────

/** Payload passed to onGestureDetected callbacks in the UI layer. */
export interface GestureDetection {
    phrase: string;
    gestureType: string | null;
}

// ──────────────────────────────────────────────
// Config Display
// ──────────────────────────────────────────────

/** UI display info for a gesture (emoji + human-readable name). */
export interface GestureDisplayInfo {
    emoji: string;
    name: string;
}

// ──────────────────────────────────────────────
// Training
// ──────────────────────────────────────────────

/** Progress callback signature for model training. */
export type TrainProgressCallback = (currentEpoch: number, totalEpochs: number) => void;

// ──────────────────────────────────────────────
// Component Props
// ──────────────────────────────────────────────

export interface VideoFeedProps {
    onGestureDetected: (detection: GestureDetection) => void;
    onLoadingComplete: () => void;
    landmarksRef: React.MutableRefObject<Landmark[] | null>;
}

export interface PhraseOverlayProps {
    phrase: string;
    gestureType: string | null;
}

export interface TrainingModeProps {
    landmarksRef: React.MutableRefObject<Landmark[] | null>;
    onClose: () => void;
}

export interface ErrorBoundaryProps {
    children: React.ReactNode;
}

export interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
}
