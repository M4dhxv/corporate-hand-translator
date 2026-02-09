import { useState, useEffect } from 'react';

/**
 * PhraseOverlay Component
 * 
 * Displays the detected gesture phrase in a glass-morphism bubble overlay.
 * Includes smooth fade-in animation when the phrase changes.
 * 
 * @param {Object} props
 * @param {string} props.phrase - The corporate phrase to display
 * @param {string} props.gestureType - The type of gesture detected (for styling)
 */
function PhraseOverlay({ phrase, gestureType }) {
    const [displayPhrase, setDisplayPhrase] = useState(phrase);
    const [isAnimating, setIsAnimating] = useState(false);

    // Animate phrase changes
    useEffect(() => {
        if (phrase !== displayPhrase) {
            setIsAnimating(true);

            // Short delay for fade out, then update text
            const timeout = setTimeout(() => {
                setDisplayPhrase(phrase);
                setIsAnimating(false);
            }, 150);

            return () => clearTimeout(timeout);
        }
    }, [phrase, displayPhrase]);

    // Determine if we have an active gesture
    const isActiveGesture = gestureType && gestureType !== 'none';

    return (
        <div className="absolute bottom-4 left-4 right-4 z-20 flex justify-center">
            <div
                className={`
          glass-bubble px-6 py-4 max-w-lg text-center
          transition-all duration-300 ease-out
          ${isAnimating ? 'opacity-0 transform translate-y-2' : 'opacity-100 transform translate-y-0'}
          ${isActiveGesture ? 'ring-2 ring-green-400/30' : ''}
        `}
            >
                {/* Gesture Icon */}
                {isActiveGesture && (
                    <div className="mb-2 flex items-center justify-center gap-2">
                        <span className="text-green-400 text-lg">
                            {gestureType === 'open-palm' && '✋'}
                            {gestureType === 'fist' && '✊'}
                            {gestureType === 'thumbs-up' && '👍'}
                            {gestureType === 'pointing' && '☝️'}
                            {gestureType === 'peace' && '✌️'}
                        </span>
                        <span className="text-xs text-green-400/80 uppercase tracking-wider font-medium">
                            {gestureType.replace('-', ' ')}
                        </span>
                    </div>
                )}

                {/* Phrase Text */}
                <p className={`
          text-white font-medium leading-relaxed
          ${isActiveGesture ? 'text-base sm:text-lg' : 'text-sm sm:text-base text-white/70'}
        `}>
                    "{displayPhrase}"
                </p>

                {/* Decorative quotation marks */}
                <div className="absolute -top-2 -left-1 text-4xl text-white/10 font-serif leading-none pointer-events-none">
                    "
                </div>
                <div className="absolute -bottom-4 -right-1 text-4xl text-white/10 font-serif leading-none pointer-events-none">
                    „
                </div>
            </div>
        </div>
    );
}

export default PhraseOverlay;
