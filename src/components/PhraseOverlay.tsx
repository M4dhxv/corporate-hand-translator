import { useState, useEffect } from 'react';
import { GESTURE_TYPE_TO_EMOJI } from '../config/gestureConfig';
import type { PhraseOverlayProps } from '../types';

/**
 * PhraseOverlay Component
 * Displays detected gesture phrase in a high-contrast overlay bubble.
 * Smooth fade-in/out animation on phrase changes.
 */
function PhraseOverlay({ phrase, gestureType }: PhraseOverlayProps) {
    const [displayPhrase, setDisplayPhrase] = useState(phrase);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        if (phrase !== displayPhrase) {
            setIsAnimating(true);
            const timeout = setTimeout(() => {
                setDisplayPhrase(phrase);
                setIsAnimating(false);
            }, 150);
            return () => clearTimeout(timeout);
        }
    }, [phrase, displayPhrase]);

    const isActiveGesture = gestureType && gestureType !== 'none';

    return (
        <div className="absolute bottom-6 left-6 right-6 z-20 flex justify-center">
            <div
                className={`
                    backdrop-blur-xl rounded-xl
                    bg-black/80 dark:bg-black/85
                    border border-white/20
                    px-6 py-4 max-w-xl text-center shadow-lg
                    transition-all duration-300 ease-out
                    ${isAnimating ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}
                `}
            >
                {isActiveGesture && (
                    <div className="mb-2 flex items-center justify-center gap-2">
                        <span className="text-lg">
                            {GESTURE_TYPE_TO_EMOJI[gestureType] || '🤚'}
                        </span>
                        <span className="text-xs text-green-400 uppercase tracking-wider font-medium">
                            {gestureType.replace('-', ' ')}
                        </span>
                    </div>
                )}

                <p className="text-white font-medium leading-relaxed text-base">
                    &ldquo;{displayPhrase}&rdquo;
                </p>
            </div>
        </div>
    );
}

export default PhraseOverlay;
