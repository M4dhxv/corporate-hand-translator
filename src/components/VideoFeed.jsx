import { useRef, useEffect, useState } from 'react';
import useHandTracking from '../hooks/useHandTracking';

/**
 * VideoFeed Component
 * 
 * Displays the webcam feed with a canvas overlay for hand skeleton visualization.
 * Uses the useHandTracking hook for MediaPipe integration.
 * 
 * @param {Object} props
 * @param {Function} props.onGestureDetected - Callback when gesture is detected
 * @param {Function} props.onLoadingComplete - Callback when MediaPipe is ready
 */
function VideoFeed({ onGestureDetected, onLoadingComplete }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [dimensions, setDimensions] = useState({ width: 640, height: 480 });

    // Initialize hand tracking hook
    const { isInitialized, isHandDetected } = useHandTracking({
        videoRef,
        canvasRef,
        onGestureDetected,
        onLoadingComplete
    });

    // Handle responsive sizing
    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                const containerWidth = containerRef.current.offsetWidth;
                const aspectRatio = 480 / 640;
                const width = Math.min(containerWidth, 640);
                const height = width * aspectRatio;
                setDimensions({ width, height });
            }
        };

        updateDimensions();
        window.addEventListener('resize', updateDimensions);

        return () => window.removeEventListener('resize', updateDimensions);
    }, []);

    return (
        <div
            ref={containerRef}
            className="relative w-full"
            style={{ aspectRatio: '640/480' }}
        >
            {/* Video Element (hidden, used as source for MediaPipe) */}
            <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover rounded-xl"
                style={{
                    transform: 'scaleX(-1)',  // Mirror the video horizontally
                }}
                autoPlay
                playsInline
                muted
            />

            {/* Canvas Overlay for Hand Skeleton */}
            <canvas
                ref={canvasRef}
                width={640}
                height={480}
                className="absolute inset-0 w-full h-full pointer-events-none rounded-xl"
                style={{
                    zIndex: 10,
                }}
            />

            {/* Status Indicator */}
            <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
                {/* Recording/Active indicator */}
                <div className={`
          flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
          ${isHandDetected
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-navy-700/50 text-slate-corp-400 border border-navy-600/30'}
          backdrop-blur-sm transition-all duration-300
        `}>
                    <span className={`
            w-2 h-2 rounded-full
            ${isHandDetected
                            ? 'bg-green-400 animate-pulse'
                            : 'bg-slate-corp-500'}
          `} />
                    {isHandDetected ? 'Hand Detected' : 'No Hand'}
                </div>
            </div>

            {/* Camera Permission/Loading State */}
            {!isInitialized && (
                <div className="absolute inset-0 flex items-center justify-center bg-navy-900/90 rounded-xl z-30">
                    <div className="text-center">
                        <div className="inline-block w-10 h-10 border-4 border-navy-500 border-t-green-400 rounded-full animate-spin mb-3"></div>
                        <p className="text-white/80 text-sm">Starting camera...</p>
                        <p className="text-slate-corp-500 text-xs mt-1">Please allow camera access</p>
                    </div>
                </div>
            )}

            {/* Corner Decorations */}
            <div className="absolute top-0 left-0 w-6 h-6 border-l-2 border-t-2 border-navy-400/50 rounded-tl-xl pointer-events-none" />
            <div className="absolute top-0 right-0 w-6 h-6 border-r-2 border-t-2 border-navy-400/50 rounded-tr-xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-6 h-6 border-l-2 border-b-2 border-navy-400/50 rounded-bl-xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-r-2 border-b-2 border-navy-400/50 rounded-br-xl pointer-events-none" />
        </div>
    );
}

export default VideoFeed;
