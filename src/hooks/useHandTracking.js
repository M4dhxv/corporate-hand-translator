import { useEffect, useRef, useState } from 'react';
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import { classifyGesture } from '../utils/gestureClassifier';

/**
 * Custom React Hook for Hand Tracking
 * Uses MediaPipe Hands for real-time hand detection.
 */
function useHandTracking({ videoRef, canvasRef, onGestureDetected, onLoadingComplete }) {
    const [isInitialized, setIsInitialized] = useState(false);
    const [isHandDetected, setIsHandDetected] = useState(false);

    const handsRef = useRef(null);
    const cameraRef = useRef(null);
    const lastGestureRef = useRef('none');

    useEffect(() => {
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

            // Draw lines
            ctx.strokeStyle = '#00ff88';
            ctx.lineWidth = 3;
            connections.forEach(([s, e]) => {
                ctx.beginPath();
                ctx.moveTo((1 - landmarks[s].x) * width, landmarks[s].y * height);
                ctx.lineTo((1 - landmarks[e].x) * width, landmarks[e].y * height);
                ctx.stroke();
            });

            // Draw points
            landmarks.forEach(lm => {
                const x = (1 - lm.x) * width;
                const y = lm.y * height;
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, 2 * Math.PI);
                ctx.fillStyle = '#00ff88';
                ctx.fill();
            });
        };

        // Initialize MediaPipe
        const hands = new Hands({
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

        // Initialize camera
        const camera = new Camera(video, {
            onFrame: async () => {
                if (handsRef.current) {
                    await handsRef.current.send({ image: video });
                }
            },
            width: 640,
            height: 480
        });

        cameraRef.current = camera;

        camera.start().then(() => {
            setIsInitialized(true);
            onLoadingComplete?.();
        });

        return () => {
            camera?.stop();
            hands?.close();
        };
    }, []);

    return { isInitialized, isHandDetected };
}

export default useHandTracking;
