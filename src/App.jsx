import { useState, useRef, useCallback, useEffect } from 'react';
import VideoFeed from './components/VideoFeed';
import PhraseOverlay from './components/PhraseOverlay';
import TrainingMode from './components/TrainingMode';

/**
 * Main Application Component
 * 
 * Corporate Signal Translator:
 * A satirical web app that translates hand gestures into corporate jargon.
 * Uses MediaPipe Hands for real-time hand tracking and gesture detection.
 * Features Text-to-Speech using Web Speech API.
 * Features Training Mode for personalizing gesture recognition.
 */
function App() {
    // Current detected phrase from gesture recognition
    const [currentPhrase, setCurrentPhrase] = useState('Waiting for input…');

    // Current detected gesture name (for UI display)
    const [gestureType, setGestureType] = useState(null);

    // Loading state for MediaPipe initialization
    const [isLoading, setIsLoading] = useState(true);

    // TTS enabled state
    const [ttsEnabled, setTtsEnabled] = useState(true);

    // State for available voices
    const [voices, setVoices] = useState([]);

    // Training Mode state
    const [trainingMode, setTrainingMode] = useState(false);

    // Ref to track last spoken phrase to avoid repetition
    const lastSpokenRef = useRef('');

    // Ref to track current TTS state (avoids stale closure)
    const ttsEnabledRef = useRef(ttsEnabled);

    // Ref to track last gesture time for throttling (prevents flickering)
    const lastGestureTimeRef = useRef(0);

    // Shared landmarks ref — written by useHandTracking, read by TrainingMode
    const landmarksRef = useRef(null);

    // Keep ref in sync with state
    useEffect(() => {
        ttsEnabledRef.current = ttsEnabled;
        // Cancel speech when TTS is turned off
        if (!ttsEnabled) {
            window.speechSynthesis.cancel();
        } else {
            // Prime the TTS engine with a silent utterance (fixes user gesture requirements on some browsers)
            try {
                const silentUtterance = new SpeechSynthesisUtterance('');
                silentUtterance.volume = 0;
                // Safely attempt to speak, as some browsers may require user interaction first
                const speakPromise = window.speechSynthesis.speak(silentUtterance);
                // Handle promise-based errors (modern browsers)
                if (speakPromise && speakPromise.catch) {
                    speakPromise.catch(() => {
                        // Silently fail if user hasn't interacted with the page yet
                    });
                }
            } catch (err) {
                // Silently fail if speech synthesis is not available
                console.debug('TTS priming failed:', err.message);
            }
        }
    }, [ttsEnabled]);

    // Load voices on mount
    useEffect(() => {
        const loadVoices = () => {
            const availableVoices = window.speechSynthesis.getVoices();
            if (availableVoices.length > 0) {
                setVoices(availableVoices);
            }
        };

        loadVoices();

        // Chrome requires this event listener
        // Use addEventListener to ensure compatibility and avoid overwriting other handlers
        if (typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
            window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
        }

        return () => {
            // Clean up event listener
            if (typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
                window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
            }
        };
    }, []);

    /**
     * Speak a phrase using Web Speech API
     */
    const speakPhrase = useCallback((text) => {
        if (!ttsEnabledRef.current || !text || text === 'Waiting for input…') return;

        // Prevent repeating the same phrase immediately
        if (text === lastSpokenRef.current) return;

        // Cancel any ongoing speech to keep it snappy
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;

        // Try to use a professional-sounding voice from state
        // Handle case where voices might not be loaded yet
        const voicesToUse = voices.length > 0 ? voices : window.speechSynthesis.getVoices();
        const englishVoice = voicesToUse.find(v => v.lang.startsWith('en') && v.name.includes('Google'))
            || voicesToUse.find(v => v.lang.startsWith('en'));

        if (englishVoice) {
            utterance.voice = englishVoice;
        }

        utterance.onerror = (e) => {
            if (e.error !== 'interrupted') {
                console.error('TTS Error:', e.error);
            }
        };

        utterance.onstart = () => {
            // Optional: Track when speech starts
        };

        utterance.onend = () => {
            // Optional: Track when speech ends
        };

        window.speechSynthesis.speak(utterance);
        lastSpokenRef.current = text;
    }, [voices]);

    /**
     * Callback when a gesture is detected by the VideoFeed component
     * @param {Object} gestureData - Contains phrase and gestureType
     */
    const handleGestureDetected = ({ phrase, gestureType }) => {
        setCurrentPhrase(phrase);
        setGestureType(gestureType);

        // Speak the phrase if TTS is enabled, but throttle it to avoid flickering
        // Only speak if we have a valid gesture
        if (gestureType) {
            const now = Date.now();
            // 500ms throttle: waits for the user to hold the new gesture for a moment
            // (or prevents rapid firing if the model flickers between gestures)
            if (now - lastGestureTimeRef.current > 500) {
                speakPhrase(phrase);
                lastGestureTimeRef.current = now;
            }
        }
    };

    /**
     * Callback when MediaPipe finishes loading
     */
    const handleLoadingComplete = () => {
        setIsLoading(false);
    };

    return (
        <div className="min-h-screen flex flex-col">
            {/* Header */}
            <header className="py-6 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-center gap-3">
                        {/* Logo icon */}
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-navy-500 to-navy-700 flex items-center justify-center shadow-lg glow">
                            <svg
                                className="w-7 h-7 text-white"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11"
                                />
                            </svg>
                        </div>

                        {/* Title */}
                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gradient tracking-tight">
                            Corporate Signal Translator
                        </h1>
                    </div>

                    {/* Subtitle */}
                    <p className="text-center mt-3 text-slate-corp-400 text-sm sm:text-base max-w-2xl mx-auto">
                        Transform your hand gestures into professional corporate speak.
                        Perfect for synergizing cross-functional deliverables.
                    </p>

                    {/* Control Buttons */}
                    <div className="flex justify-center gap-3 mt-4">
                        {/* TTS Toggle Button */}
                        <button
                            onClick={() => setTtsEnabled(!ttsEnabled)}
                            className={`
                                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                                transition-all duration-300
                                ${ttsEnabled
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
                                    : 'bg-navy-700/50 text-slate-corp-400 border border-navy-600/30 hover:bg-navy-600/50'}
                            `}
                        >
                            {ttsEnabled ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                </svg>
                            ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                                </svg>
                            )}
                            {ttsEnabled ? 'Voice On' : 'Voice Off'}
                        </button>

                        {/* Training Mode Toggle Button */}
                        <button
                            onClick={() => setTrainingMode(!trainingMode)}
                            className={`
                                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                                transition-all duration-300
                                ${trainingMode
                                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30'
                                    : 'bg-navy-700/50 text-slate-corp-400 border border-navy-600/30 hover:bg-navy-600/50'}
                            `}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            {trainingMode ? 'Training On' : 'Personalize Gestures'}
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 pb-12">
                <div className="w-full max-w-3xl">
                    {/* Main Card Container */}
                    <div className="glass-card p-4 sm:p-6 lg:p-8">
                        {/* Loading Indicator */}
                        {isLoading && (
                            <div className="absolute inset-0 z-50 flex items-center justify-center bg-navy-900/80 backdrop-blur-sm rounded-2xl">
                                <div className="text-center">
                                    <div className="inline-block w-12 h-12 border-4 border-navy-500 border-t-white rounded-full animate-spin mb-4"></div>
                                    <p className="text-white/80 text-sm">Initializing hand tracking...</p>
                                </div>
                            </div>
                        )}

                        {/* Video Feed with Canvas Overlay */}
                        <div className="video-container relative">
                            <VideoFeed
                                onGestureDetected={handleGestureDetected}
                                onLoadingComplete={handleLoadingComplete}
                                landmarksRef={landmarksRef}
                            />

                            {/* Phrase Overlay (positioned at bottom of video) */}
                            <PhraseOverlay
                                phrase={currentPhrase}
                                gestureType={gestureType}
                            />
                        </div>

                        {/* Gesture Legend */}
                        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-center">
                            {[
                                { gesture: '✋', label: 'Open Palm' },
                                { gesture: '✊', label: 'Fist' },
                                { gesture: '👍', label: 'Thumbs Up' },
                                { gesture: '☝️', label: 'Pointing' },
                                { gesture: '✌️', label: 'Peace' },
                            ].map((item, index) => (
                                <div
                                    key={item.label}
                                    className={`
                    p-3 rounded-lg bg-navy-800/50 border border-navy-600/30
                    transition-all duration-300
                    ${gestureType === item.label.toLowerCase().replace(' ', '-')
                                            ? 'ring-2 ring-green-400 bg-navy-700/50 scale-105'
                                            : 'hover:bg-navy-700/50'}
                  `}
                                >
                                    <span className="text-2xl">{item.gesture}</span>
                                    <p className="text-xs mt-1 text-slate-corp-400">{item.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Instructions */}
                        <div className="mt-6 text-center text-sm text-slate-corp-400">
                            <p>Show your hand to the camera to translate gestures into corporate wisdom.</p>
                            <p className="mt-1 text-xs">Hand tracking powered by MediaPipe</p>
                        </div>
                    </div>

                    {/* Training Mode Panel (below the main card) */}
                    {trainingMode && (
                        <TrainingMode
                            landmarksRef={landmarksRef}
                            onClose={() => setTrainingMode(false)}
                        />
                    )}
                </div>
            </main>

            {/* Footer */}
            <footer className="py-4 px-4 text-center text-slate-corp-500 text-xs">
                <p>© 2024 Corporate Signal Translator • Synergizing Human-AI Collaboration</p>
            </footer>
        </div>
    );
}

export default App;
