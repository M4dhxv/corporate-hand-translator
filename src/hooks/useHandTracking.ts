/**
 * Custom React Hook for Hand Tracking with ML Gesture Classification
 *
 * Pipeline:
 * 1. MediaPipe Hands (CDN) → detects 21 hand landmarks per frame
 * 2. TensorFlow.js model (lazy-loaded) → classifies landmarks into gesture labels
 * 3. Gesture Decision Engine → stability voting, gating, cooldown
 * 4. Final gesture + corporate phrase → parent via callback
 *
 * Engineering decisions:
 * - MediaPipe loaded from CDN with timeout + retry for resilience
 * - TF.js model loaded via dynamic import() for code splitting
 * - All ML runs on main thread (~5ms/frame, within 33ms budget at 30fps)
 */

import { useEffect, useRef, useState } from 'react';
import { processGestureFrame, onHandLost } from '../ml/gestureDecisionEngine';
import type { Landmark, GestureDetection } from '../types';
import type { predictGesture as PredictGestureFn, loadGestureModel as LoadGestureModelFn } from '../ml/gestureModel';

/** CDN load timeout (ms) — fail fast if CDN is unreachable */
const CDN_TIMEOUT_MS = 15000;

/** Number of CDN load retries before giving up */
const CDN_MAX_RETRIES = 2;

interface UseHandTrackingParams {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    onGestureDetected?: (detection: GestureDetection) => void;
    onLoadingComplete?: () => void;
    landmarksRef?: React.MutableRefObject<Landmark[] | null>;
}

interface UseHandTrackingReturn {
    isInitialized: boolean;
    isHandDetected: boolean;
}

/** Lazy-loaded ML module shape */
interface GestureModule {
    loadGestureModel: typeof LoadGestureModelFn;
    predictGesture: typeof PredictGestureFn;
}

function useHandTracking({ videoRef, canvasRef, onGestureDetected, onLoadingComplete, landmarksRef }: UseHandTrackingParams): UseHandTrackingReturn {
    const [isInitialized, setIsInitialized] = useState(false);
    const [isHandDetected, setIsHandDetected] = useState(false);

    const handsRef = useRef<InstanceType<typeof window.Hands> | null>(null);
    const cameraRef = useRef<InstanceType<typeof window.Camera> | null>(null);
    const initRef = useRef(false);

    /** Lazy-loaded ML module — loaded via dynamic import for code splitting */
    const mlModuleRef = useRef<GestureModule | null>(null);

    useEffect(() => {
        if (initRef.current) return;
        initRef.current = true;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        // ── Draw hand landmarks on canvas overlay ──
        const drawLandmarks = (ctx: CanvasRenderingContext2D, landmarks: Landmark[], width: number, height: number): void => {
            ctx.clearRect(0, 0, width, height);

            const connections: [number, number][] = [
                [0, 1], [1, 2], [2, 3], [3, 4],
                [0, 5], [5, 6], [6, 7], [7, 8],
                [0, 9], [9, 10], [10, 11], [11, 12],
                [0, 13], [13, 14], [14, 15], [15, 16],
                [0, 17], [17, 18], [18, 19], [19, 20],
                [5, 9], [9, 13], [13, 17], [0, 17]
            ];

            // Skeleton lines
            ctx.strokeStyle = '#00ff88';
            ctx.lineWidth = 3;
            connections.forEach(([s, e]) => {
                ctx.beginPath();
                ctx.moveTo((1 - landmarks[s].x) * width, landmarks[s].y * height);
                ctx.lineTo((1 - landmarks[e].x) * width, landmarks[e].y * height);
                ctx.stroke();
            });

            // Landmark dots
            landmarks.forEach(lm => {
                const x = (1 - lm.x) * width;
                const y = lm.y * height;
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, 2 * Math.PI);
                ctx.fillStyle = '#00ff88';
                ctx.fill();
            });
        };

        // ── Load CDN script with timeout + retry ──
        const loadScript = (src: string, retries = CDN_MAX_RETRIES): Promise<void> => {
            return new Promise((resolve, reject) => {
                // Skip if already loaded
                if (document.querySelector(`script[src="${src}"]`)) {
                    resolve();
                    return;
                }

                const script = document.createElement('script');
                script.src = src;
                script.crossOrigin = 'anonymous';

                // Timeout: fail fast if CDN is unreachable
                const timeout = setTimeout(() => {
                    script.remove();
                    if (retries > 0) {
                        console.warn(`⏱️ CDN timeout for ${src}, retrying (${retries} left)...`);
                        loadScript(src, retries - 1).then(resolve).catch(reject);
                    } else {
                        reject(new Error(`CDN load timeout: ${src}`));
                    }
                }, CDN_TIMEOUT_MS);

                script.onload = () => {
                    clearTimeout(timeout);
                    resolve();
                };

                script.onerror = () => {
                    clearTimeout(timeout);
                    script.remove();
                    if (retries > 0) {
                        console.warn(`❌ CDN error for ${src}, retrying (${retries} left)...`);
                        loadScript(src, retries - 1).then(resolve).catch(reject);
                    } else {
                        reject(new Error(`CDN load failed after ${CDN_MAX_RETRIES + 1} attempts: ${src}`));
                    }
                };

                document.head.appendChild(script);
            });
        };

        // ── Main initialization ──
        const init = async () => {
            try {
                // Step 1: Load MediaPipe from CDN (with retry + timeout)
                console.log('📡 Loading MediaPipe from CDN...');
                await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js');
                await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
                await new Promise(r => setTimeout(r, 100));
                console.log('✅ MediaPipe loaded');

                // Step 2: Lazy-load TF.js gesture model via dynamic import (code splitting)
                console.log('🧠 Loading ML model (lazy)...');
                const gestureModule = await import('../ml/gestureModel') as GestureModule;
                mlModuleRef.current = gestureModule;
                await gestureModule.loadGestureModel();
                console.log('✅ ML gesture model ready');

                // Step 3: Initialize MediaPipe Hands
                const hands = new window.Hands({
                    locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
                });

                hands.setOptions({
                    maxNumHands: 1,
                    modelComplexity: 1,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });

                // ── Frame processing: landmarks → ML → gesture ──
                hands.onResults((results) => {
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return;
                    ctx.clearRect(0, 0, canvas.width, canvas.height);

                    if (results.multiHandLandmarks?.length && results.multiHandLandmarks.length > 0) {
                        const landmarks = results.multiHandLandmarks[0] as Landmark[];
                        setIsHandDetected(true);
                        drawLandmarks(ctx, landmarks, canvas.width, canvas.height);

                        // Expose landmarks for Training Mode capture
                        if (landmarksRef) landmarksRef.current = landmarks;

                        // ML classification via lazy-loaded module
                        if (mlModuleRef.current) {
                            const mlPrediction = mlModuleRef.current.predictGesture(landmarks);

                            // Pass through decision engine for stability voting, gating, cooldown
                            const finalGesture = processGestureFrame(mlPrediction, landmarks);

                            // Only trigger UI update if gesture was accepted by decision engine
                            if (finalGesture) {
                                onGestureDetected?.({
                                    phrase: finalGesture.phrase,
                                    gestureType: finalGesture.gestureType
                                });
                            }
                        }
                    } else {
                        // Hand disappeared
                        setIsHandDetected(false);
                        if (landmarksRef) landmarksRef.current = null;

                        // Notify decision engine that hand is gone
                        onHandLost();

                        // Trigger "waiting" state
                        onGestureDetected?.({
                            phrase: 'Waiting for input…',
                            gestureType: null
                        });
                    }
                });

                handsRef.current = hands;

                // Step 4: Initialize camera
                const camera = new window.Camera(video, {
                    onFrame: async () => {
                        if (handsRef.current) {
                            await handsRef.current.send({ image: video });
                        }
                    },
                    width: 640,
                    height: 480
                });

                cameraRef.current = camera;
                await camera.start();

                setIsInitialized(true);
                onLoadingComplete?.();
            } catch (err) {
                console.error('Failed to initialize hand tracking:', err);
                // Surface error to user instead of silently failing
                throw err;
            }
        };

        init();

        return () => {
            cameraRef.current?.stop();
            handsRef.current?.close();
        };
    }, []);

    return { isInitialized, isHandDetected };
}

export default useHandTracking;
