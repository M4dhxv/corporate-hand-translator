import { useEffect, useRef, useState } from 'react';
import { classifyGesture } from '../utils/gestureClassifier';

/**
 * Custom React Hook for Hand Tracking
 * Uses MediaPipe Hands loaded from CDN for production compatibility.
 */
function useHandTracking({ videoRef, canvasRef, onGestureDetected, onLoadingComplete }) {
    const [isInitialized, setIsInitialized] = useState(false);
    const [isHandDetected, setIsHandDetected] = useState(false);

    const handsRef = useRef(null);
    const cameraRef = useRef(null);
    const lastGestureRef = useRef('none');
    const initRef = useRef(false);

    useEffect(() => {
        if (initRef.current) return;
        initRef.current = true;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        // Draw hand landmarks
        const drawLandmarks = (ctx, landmarks, width, height) => {
            ctx.clearRect(0, 0, width, height);

            const connections = [
                [0, 1], [1, 2], [2, 3], [3, 4],
                [0, 5], [5, 6], [6, 7], [7, 8],
                [0, 9], [9, 10], [10, 11], [11, 12],
                [0, 13], [13, 14], [14, 15], [15, 16],
                [0, 17], [17, 18], [18, 19], [19, 20],
                [5, 9], [9, 13], [13, 17], [0, 17]
            ];

            ctx.strokeStyle = '#00ff88';
            ctx.lineWidth = 3;
            connections.forEach(([s, e]) => {
                ctx.beginPath();
                ctx.moveTo((1 - landmarks[s].x) * width, landmarks[s].y * height);
                ctx.lineTo((1 - landmarks[e].x) * width, landmarks[e].y * height);
                ctx.stroke();
            });

            landmarks.forEach(lm => {
                const x = (1 - lm.x) * width;
                const y = lm.y * height;
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, 2 * Math.PI);
                ctx.fillStyle = '#00ff88';
                ctx.fill();
            });
        };

        // Load MediaPipe from CDN (works in production)
        const loadScript = (src) => {
            return new Promise((resolve, reject) => {
                if (document.querySelector(`script[src="${src}"]`)) {
                    resolve();
                    return;
                }
                const script = document.createElement('script');
                script.src = src;
                script.crossOrigin = 'anonymous';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        };

        const init = async () => {
            try {
                // Load MediaPipe scripts from CDN
                await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js');
                await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');

                // Wait a tick for scripts to initialize
                await new Promise(r => setTimeout(r, 100));

                const hands = new window.Hands({
                    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
                });

                hands.setOptions({
                    maxNumHands: 1,
                    modelComplexity: 1,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });

                hands.onResults((results) => {
                    const ctx = canvas.getContext('2d');
                    ctx.clearRect(0, 0, canvas.width, canvas.height);

                    if (results.multiHandLandmarks?.length > 0) {
                        const landmarks = results.multiHandLandmarks[0];
                        setIsHandDetected(true);
                        drawLandmarks(ctx, landmarks, canvas.width, canvas.height);

                        const { gestureType, phrase } = classifyGesture(landmarks);
                        if (gestureType !== lastGestureRef.current) {
                            lastGestureRef.current = gestureType;
                            onGestureDetected?.({ phrase, gestureType });
                        }
                    } else {
                        setIsHandDetected(false);
                        if (lastGestureRef.current !== 'none') {
                            lastGestureRef.current = 'none';
                            onGestureDetected?.({ phrase: 'Waiting for input…', gestureType: null });
                        }
                    }
                });

                handsRef.current = hands;

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
