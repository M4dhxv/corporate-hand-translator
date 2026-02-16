import { useState, useRef, useCallback, useEffect } from 'react';
import VideoFeed from './components/VideoFeed';
import PhraseOverlay from './components/PhraseOverlay';
import TrainingMode from './components/TrainingMode';

/**
 * Corporate Signal Translator - Main App
 * macOS utility-style interface with fixed video card
 * Zero scrolling, always-visible controls
 */
function App() {
    // State management
    const [currentPhrase, setCurrentPhrase] = useState('Waiting for input…');
    const [gestureType, setGestureType] = useState(null);
    const [gestureConfidence, setGestureConfidence] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [voiceEnabled, setVoiceEnabled] = useState(true);
    const [ttsEnabled, setTtsEnabled] = useState(true);
    const [voices, setVoices] = useState([]);
    const [trainingMode, setTrainingMode] = useState(false);
    const [darkMode, setDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('theme-preference');
            if (saved) return saved === 'dark';
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return false;
    });

    // Refs
    const lastSpokenRef = useRef('');
    const ttsEnabledRef = useRef(ttsEnabled);
    const lastGestureTimeRef = useRef(0);
    const landmarksRef = useRef(null);
    const voiceEnabledRef = useRef(voiceEnabled);

    // Persist theme preference
    useEffect(() => {
        localStorage.setItem('theme-preference', darkMode ? 'dark' : 'light');
        document.documentElement.classList.toggle('dark', darkMode);
    }, [darkMode]);

    // Keep voice state ref in sync
    useEffect(() => {
        voiceEnabledRef.current = voiceEnabled;
    }, [voiceEnabled]);

    // TTS logic (unchanged from v3.1.2+)
    useEffect(() => {
        ttsEnabledRef.current = ttsEnabled;
        if (!ttsEnabled) {
            window.speechSynthesis.cancel();
        } else {
            try {
                const silentUtterance = new SpeechSynthesisUtterance('');
                silentUtterance.volume = 0;
                const speakPromise = window.speechSynthesis.speak(silentUtterance);
                if (speakPromise && speakPromise.catch) {
                    speakPromise.catch(() => { });
                }
            } catch (err) {
                console.debug('TTS priming failed:', err.message);
            }
        }
    }, [ttsEnabled]);

    // Voice loading (unchanged from v3.1.2+)
    useEffect(() => {
        const loadVoices = () => {
            const availableVoices = window.speechSynthesis.getVoices();
            if (availableVoices.length > 0) {
                setVoices(availableVoices);
            }
        };

        loadVoices();
        if (typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
            window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
        }

        return () => {
            if (typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
                window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
            }
        };
    }, []);

    // Speak phrase (unchanged from v3.1.2+)
    const speakPhrase = useCallback((text) => {
        if (!voiceEnabledRef.current || !ttsEnabledRef.current || !text || text === 'Waiting for input…') return;
        if (text === lastSpokenRef.current) return;

        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;

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

        window.speechSynthesis.speak(utterance);
        lastSpokenRef.current = text;
    }, [voices]);

    // Gesture detection (unchanged from v3.2.0)
    const handleGestureDetected = ({ phrase, gestureType }) => {
        setCurrentPhrase(phrase);
        setGestureType(gestureType);

        if (gestureType) {
            const now = Date.now();
            if (now - lastGestureTimeRef.current > 500) {
                speakPhrase(phrase);
                lastGestureTimeRef.current = now;
            }
        }
    };

    const handleLoadingComplete = () => {
        setIsLoading(false);
    };

    return (
        <div className={`${darkMode ? 'dark' : ''}`}>
            {/* Root container - fixed viewport utility layout */}
            <div className="h-screen w-screen bg-white dark:bg-neutral-950 transition-colors duration-300 flex flex-col overflow-hidden">

                {/* Minimalist header */}
                <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-neutral-200/50 dark:border-neutral-800/50 flex-shrink-0">
                    <div className="min-w-0">
                        <h1 className="text-sm font-semibold text-neutral-950 dark:text-white">
                            Corporate Signal Translator
                        </h1>
                    </div>
                    <button
                        onClick={() => setDarkMode(!darkMode)}
                        className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors duration-200 flex-shrink-0"
                        aria-label="Toggle dark mode"
                    >
                        {darkMode ? (
                            <svg className="w-4 h-4 text-neutral-400" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                            </svg>
                        ) : (
                            <svg className="w-4 h-4 text-neutral-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.707.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zm5.657-9.193a1 1 0 00-1.414 0l-.707.707A1 1 0 005.05 6.464l.707-.707a1 1 0 011.414 0zM3 11a1 1 0 100-2H2a1 1 0 100 2h1z" clipRule="evenodd" />
                            </svg>
                        )}
                    </button>
                </header>

                {/* Main content area - centered video card with controls */}
                <main className="flex-1 flex items-center justify-center px-4 sm:px-6 overflow-hidden relative">

                    {/* Fixed video card - the product */}
                    <div className="relative w-full max-w-3xl">

                        {/* Video container with rounded corners */}
                        <div className="rounded-3xl overflow-hidden shadow-2xl border border-neutral-200/50 dark:border-neutral-800/50 bg-black">

                            {/* Loading state */}
                            {isLoading && (
                                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                                    <div className="text-center">
                                        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                                        <p className="text-xs font-medium text-white">Initializing…</p>
                                    </div>
                                </div>
                            )}

                            {/* Aspect video feed */}
                            <div className="relative bg-black aspect-video flex items-center justify-center">
                                <VideoFeed
                                    onGestureDetected={handleGestureDetected}
                                    onLoadingComplete={handleLoadingComplete}
                                    landmarksRef={landmarksRef}
                                />
                                <PhraseOverlay
                                    phrase={currentPhrase}
                                    gestureType={gestureType}
                                />
                            </div>

                            {/* Integrated status bar */}
                            <div className="px-4 py-3 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm border-t border-neutral-200/50 dark:border-neutral-800/50">
                                <div className="flex items-center justify-between gap-3 text-xs">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all ${gestureType ? 'bg-green-500 animate-pulse' : 'bg-neutral-300 dark:bg-neutral-600'
                                            }`} />
                                        <div className="min-w-0">
                                            <p className="text-neutral-500 dark:text-neutral-400 leading-tight">
                                                {gestureType
                                                    ? gestureType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                                                    : 'Waiting…'
                                                }
                                            </p>
                                        </div>
                                    </div>
                                    {gestureType && (
                                        <div className="text-neutral-600 dark:text-neutral-400 flex-shrink-0">
                                            {Math.round(gestureConfidence * 100)}%
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Control buttons - top-right of video feed */}
                        <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
                            {/* Voice toggle */}
                            <button
                                onClick={() => setVoiceEnabled(!voiceEnabled)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                                    bg-white/90 dark:bg-neutral-900/90 border border-neutral-200/50 dark:border-neutral-800/50
                                    hover:bg-white dark:hover:bg-neutral-900
                                    shadow-lg backdrop-blur-sm"
                                title={voiceEnabled ? 'Voice On' : 'Voice Off'}
                            >
                                <span>{voiceEnabled ? '🔊' : '🔇'}</span>
                                <span className="text-neutral-700 dark:text-neutral-300 hidden sm:inline">
                                    {voiceEnabled ? 'Voice' : 'Muted'}
                                </span>
                            </button>

                            {/* Personalize button */}
                            <button
                                onClick={() => setTrainingMode(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                                    bg-white/90 dark:bg-neutral-900/90 border border-neutral-200/50 dark:border-neutral-800/50
                                    hover:bg-white dark:hover:bg-neutral-900
                                    shadow-lg backdrop-blur-sm
                                    text-neutral-700 dark:text-neutral-300"
                                title="Personalize Gestures"
                            >
                                <span>✏️</span>
                                <span className="hidden sm:inline">Personalize</span>
                            </button>
                        </div>

                        {/* Gesture legend - bottom of video feed */}
                        <div className="absolute bottom-3 left-3 right-3 z-20">
                            <div className="grid grid-cols-5 gap-2 text-center">
                                {[
                                    { gesture: '✋', label: 'Open Palm', key: 'open-palm' },
                                    { gesture: '✊', label: 'Fist', key: 'fist' },
                                    { gesture: '👍', label: 'Thumbs Up', key: 'thumbs-up' },
                                    { gesture: '☝️', label: 'Pointing', key: 'pointing' },
                                    { gesture: '✌️', label: 'Peace', key: 'peace' },
                                ].map((item) => (
                                    <div
                                        key={item.key}
                                        className={`
                                            p-2 rounded-lg backdrop-blur-sm transition-all duration-300
                                            ${gestureType === item.key
                                                ? 'bg-green-500/30 border border-green-400/50 scale-105'
                                                : 'bg-white/40 dark:bg-neutral-900/40 border border-neutral-200/30 dark:border-neutral-800/30 hover:bg-white/60 dark:hover:bg-neutral-900/60'}
                                        `}
                                    >
                                        <span className="text-xl sm:text-2xl">{item.gesture}</span>
                                        <p className="text-[10px] sm:text-xs mt-0.5 text-neutral-700 dark:text-neutral-300 hidden sm:block">
                                            {item.label}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </main>

                {/* Footer - minimal */}
                <footer className="px-4 sm:px-6 py-2 text-center text-xs text-neutral-500 dark:text-neutral-500 border-t border-neutral-200/50 dark:border-neutral-800/50 flex-shrink-0">
                    MediaPipe Hands • TensorFlow.js
                </footer>
            </div>

            {/* Training mode modal overlay */}
            {trainingMode && (
                <div className="fixed inset-0 z-50 bg-black/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="relative w-full max-w-2xl max-h-[90vh] rounded-3xl overflow-hidden bg-white dark:bg-neutral-900 shadow-2xl border border-neutral-200/50 dark:border-neutral-800/50">
                        <TrainingMode
                            landmarksRef={landmarksRef}
                            onClose={() => setTrainingMode(false)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
