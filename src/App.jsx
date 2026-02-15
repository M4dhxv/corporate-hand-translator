import { useState, useRef, useCallback, useEffect } from 'react';
import VideoFeed from './components/VideoFeed';
import PhraseOverlay from './components/PhraseOverlay';
import TrainingMode from './components/TrainingMode';

/**
 * Main Application Component
 * Premium macOS/iOS-inspired design (v3.3.0)
 * All functional logic preserved from v3.2.0
 */
function App() {
    // State management
    const [currentPhrase, setCurrentPhrase] = useState('Waiting for input…');
    const [gestureType, setGestureType] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
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

    // Persist theme preference
    useEffect(() => {
        localStorage.setItem('theme-preference', darkMode ? 'dark' : 'light');
        document.documentElement.classList.toggle('dark', darkMode);
    }, [darkMode]);

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
                    speakPromise.catch(() => {});
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
        if (!ttsEnabledRef.current || !text || text === 'Waiting for input…') return;
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

    const gestures = [
        { gesture: '✋', label: 'Open Palm', key: 'open-palm' },
        { gesture: '✊', label: 'Fist', key: 'fist' },
        { gesture: '👍', label: 'Thumbs Up', key: 'thumbs-up' },
        { gesture: '☝️', label: 'Pointing', key: 'pointing' },
        { gesture: '✌️', label: 'Peace', key: 'peace' },
    ];

    return (
        <div className="min-h-screen bg-mac-bg-light dark:bg-mac-bg-dark transition-colors duration-300 flex flex-col">
            {/* Header */}
            <header className="border-b border-black/10 dark:border-white/10 backdrop-blur-sm bg-mac-bg-light-secondary/50 dark:bg-mac-bg-dark-secondary/20">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-start justify-between">
                        {/* Title Section */}
                        <div className="flex-1">
                            <h1 className="heading-lg text-mac-text-primary-light dark:text-mac-text-primary-dark">
                                Corporate Signal Translator
                            </h1>
                            <p className="text-secondary text-sm mt-1">
                                Translate gestures into professional meeting language
                            </p>
                        </div>

                        {/* Dark Mode Toggle */}
                        <button
                            onClick={() => setDarkMode(!darkMode)}
                            className="p-2.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors duration-200 ml-4"
                            aria-label="Toggle dark mode"
                        >
                            {darkMode ? (
                                <svg className="w-5 h-5 text-mac-text-primary-dark" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                                </svg>
                            ) : (
                                <svg className="w-5 h-5 text-mac-text-primary-light" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.707.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zm5.657-9.193a1 1 0 00-1.414 0l-.707.707A1 1 0 005.05 6.464l.707-.707a1 1 0 011.414 0zM3 11a1 1 0 100-2H2a1 1 0 100 2h1z" clipRule="evenodd" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
                <div className="w-full max-w-5xl space-y-6">
                    {/* Video Card */}
                    <div className="glass-card p-6 sm:p-8 overflow-hidden relative">
                        {isLoading && (
                            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-2xl">
                                <div className="text-center">
                                    <div className="w-10 h-10 border-2 border-mac-accent border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                                    <p className="text-sm text-mac-text-secondary-light dark:text-mac-text-secondary-dark font-medium">
                                        Initializing hand tracking…
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="video-container">
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

                        {/* Status Information */}
                        <div className="mt-6 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`status-dot ${gestureType ? 'active pulse' : 'inactive'}`} />
                                <div>
                                    <p className="text-xs text-secondary font-medium uppercase tracking-wide">Current Gesture</p>
                                    <p className="text-sm font-semibold text-mac-text-primary-light dark:text-mac-text-primary-dark mt-0.5">
                                        {gestureType ? gestureType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Waiting for gesture…'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Gestures Grid */}
                    <div>
                        <h2 className="heading-sm text-mac-text-primary-light dark:text-mac-text-primary-dark mb-4">
                            Recognized Gestures
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                            {gestures.map((item) => (
                                <button
                                    key={item.key}
                                    className={`
                        p-4 rounded-xl transition-all duration-200 text-center
                        border cursor-default
                        ${gestureType === item.key
                            ? 'glass-card ring-2 ring-mac-accent shadow-md scale-105'
                            : 'bg-white/50 dark:bg-white/5 border-black/10 dark:border-white/10 hover:bg-white/70 dark:hover:bg-white/10 hover:shadow-sm'}
                    `}
                                    disabled
                                >
                                    <div className="text-3xl mb-2">{item.gesture}</div>
                                    <p className="text-xs font-medium text-secondary">
                                        {item.label}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="glass-card p-6 space-y-4">
                        <h2 className="heading-sm text-mac-text-primary-light dark:text-mac-text-primary-dark">
                            Settings
                        </h2>

                        {/* Voice Output Toggle */}
                        <div className="flex items-center justify-between py-3">
                            <div>
                                <p className="font-medium text-mac-text-primary-light dark:text-mac-text-primary-dark text-sm">
                                    Voice Output
                                </p>
                                <p className="text-xs text-secondary mt-0.5">
                                    Speak detected gestures aloud
                                </p>
                            </div>
                            <button
                                onClick={() => setTtsEnabled(!ttsEnabled)}
                                className={`toggle-switch ${ttsEnabled ? 'active' : ''}`}
                                aria-label="Toggle voice output"
                            >
                                <div className="toggle-switch-thumb" />
                            </button>
                        </div>

                        {/* Training Mode */}
                        <div className="border-t border-black/5 dark:border-white/10 pt-4">
                            <button
                                onClick={() => setTrainingMode(!trainingMode)}
                                className="w-full btn-mac-secondary text-left flex items-center justify-between py-3 px-4 -mx-6 -mb-6 px-6 py-3 rounded-b-xl"
                            >
                                <div>
                                    <p className="font-medium text-mac-text-primary-light dark:text-mac-text-primary-dark text-sm">
                                        Personalize Gestures
                                    </p>
                                    <p className="text-xs text-secondary mt-0.5">
                                        Train custom hand gestures
                                    </p>
                                </div>
                                <svg className={`w-5 h-5 text-secondary transition-transform duration-200 ${trainingMode ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Training Mode Panel */}
                    {trainingMode && (
                        <div className="animate-scale-in">
                            <TrainingMode
                                landmarksRef={landmarksRef}
                                onClose={() => setTrainingMode(false)}
                            />
                        </div>
                    )}
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-black/10 dark:border-white/10 bg-mac-bg-light-secondary/30 dark:bg-mac-bg-dark-secondary/20 py-4">
                <p className="text-xs text-secondary text-center max-w-5xl mx-auto">
                    Premium gesture recognition powered by MediaPipe Hands • Synergizing human-AI collaboration
                </p>
            </footer>
        </div>
    );
}

export default App;
