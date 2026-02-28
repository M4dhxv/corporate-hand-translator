/**
 * Type declarations for MediaPipe CDN globals.
 *
 * MediaPipe Hands and Camera Utils are loaded from CDN at runtime
 * and attach themselves to the global `window` object.
 * These declarations tell TypeScript what shape those globals have.
 */

interface HandsOptions {
    locateFile?: (file: string) => string;
}

interface HandsSetOptions {
    maxNumHands?: number;
    modelComplexity?: number;
    minDetectionConfidence?: number;
    minTrackingConfidence?: number;
}

interface HandsResults {
    multiHandLandmarks?: Array<Array<{ x: number; y: number; z: number }>>;
    multiHandedness?: Array<{ label: string; score: number }>;
}

declare class Hands {
    constructor(options?: HandsOptions);
    setOptions(options: HandsSetOptions): void;
    onResults(callback: (results: HandsResults) => void): void;
    send(input: { image: HTMLVideoElement }): Promise<void>;
    close(): void;
}

interface CameraOptions {
    onFrame: () => Promise<void>;
    width?: number;
    height?: number;
}

declare class Camera {
    constructor(video: HTMLVideoElement, options: CameraOptions);
    start(): Promise<void>;
    stop(): void;
}

declare global {
    interface Window {
        Hands: typeof Hands;
        Camera: typeof Camera;
    }
}

export {};
