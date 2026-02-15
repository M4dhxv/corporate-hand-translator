import { useState, useRef, useCallback, useEffect } from 'react';
import VideoFeed from './components/VideoFeed';
import PhraseOverlay from './components/PhraseOverlay';
import TrainingMode from './components/TrainingMode';

/**
 * Corporate Signal Translator - Main App
 * Premium macOS-inspired utility design
 * UI-only redesign: All logic from v3.2.0 preserved
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

    const gestures = [
        { gesture: '✋', label: 'Open Palm', key: 'open-palm' },
        { gesture: '✊', label: 'Fist', key: 'fist' },
        { gesture: '👍', label: 'Thumbs Up', key: 'thumbs-up' },
        { gesture: '☝️', label: 'Pointing', key: 'pointing' },
        { gesture: '✌️', label: 'Peace', key: 'peace' },
    ];

    return (
        <div className={`min-h-screen ${darkMode ? 'dark' : ''}`}>
            {/* Root background */}
            <div className="min-h-screen bg-white dark:bg-neutral-950 transition-colors duration-300">
                
                {/* Header */}
                <header className="sticky top-0 z-40 border-b border-neutral-200/50 dark:border-neutral-800/50 backdrop-blur-xl bg-white/90 dark:bg-neutral-950/90">
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                        <div className="flex items-center justify-between gap-4">
                            {/* Branding */}
                            <div className="flex-1 min-w-0">
                                <h1 className="text-lg font-semibold text-neutral-950 dark:text-white leading-tight">
                                    Corporate Signal Translator
                                </h1>
                                <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                                    Translate gestures into professional language
                                </p>
                            </div>

                            {/* Dark mode toggle */}
                            <button
                                onClick={() => setDarkMode(!darkMode)}
                                className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors duration-200 flex-shrink-0"
                                aria-label="Toggle dark mode"
                            >
                                {darkMode ? (
                                    <svg className="w-5 h-5 text-neutral-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5 text-neutral-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.707.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zm5.657-9.193a1 1 0 00-1.414 0l-.707.707A1 1 0 005.05 6.464l.707-.707a1 1 0 011.414 0zM3 11a1 1 0 100-2H2a1 1 0 100 2h1z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>
                </header>

                {/* Main content */}
                <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
                    <div className="max-w-4xl mx-auto space-y-6">
                        
                        {/* Primary gesture card */}
                        <div className="rounded-2xl overflow-hidden shadow-sm border border-neutral-200/50 dark:border-neutral-800/50 bg-white dark:bg-neutral-900">
                            {/* Loading overlay */}
                            {isLoading && (
                                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/40 backdrop-blur-sm">
                                    <div className="text-center">
                                        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                                        <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                                            Initializing…
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Video feed */}
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

                            {/* Status bar - below video */}
                            <div className="px-6 py-4 border-t border-neutral-200/50 dark:border-neutral-800/50">
                                <div className="flex items-center justify-between gap-4">
                                    {/* Gesture status */}
                                    <div className="flex items-center gap-3 flex-1">
                                        <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
                                            gestureType 
                                                ? 'bg-green-500 animate-pulse' 
                                                : 'bg-neutral-400 dark:bg-neutral-600'
                                        }`} />
                                        <div>
                                            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Gesture</p>
                                            <p className="text-sm font-semibold text-neutral-950 dark:text-white mt-0.5">
                                                {gestureType 
                                                    ? gestureType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                                                    : 'Waiting…'
                                                }
                                            </p>
                                        </div>
                                    </div>

                                    {gestureType && (
                                        <div className="text-right">
                                            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Confidence</p>
                                            <p className="text-sm font-semibold text-neutral-950 dark:text-white mt-0.5">
                                                {Math.round(gestureConfidence * 100)}%
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Gesture reference grid */}
                        <div>
                            <h2 className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wide px-1 mb-3">
                                Recognized Gestures
                            </h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                                {gestures.map((item) => (
                                    <div
                                        key={item.key}
                                        className={`
                                            p-3 rounded-xl text-center transition-all duration-200
                                            border cursor-default select-none
                                            ${gestureType === item.key
                                                ? 'bg-blue-500/10 dark:bg-blue-500/15 border-blue-400 dark:border-blue-500 ring-1 ring-blue-400/50 dark:ring-blue-500/50'
                                                : 'bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700/50 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                                            }
                                        `}
                                    >
                                        <div className="text-2xl mb-1.5">{item.gesture}</div>
                                        <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                                            {item.label}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Settings card */}
                        <div className="rounded-2xl border border-neutral-200/50 dark:border-neutral-800/50 bg-white dark:bg-neutral-900 p-6">
                            <h2 className="text-sm font-semibold text-neutral-950 dark:text-white mb-4">
                                Settings
                            </h2>

                            {/* Training mode button */}
                            <button
                                onClick={() => setTrainingMode(!trainingMode)}
                                className={`
                                    w-full px-4 py-3 rounded-xl text-left transition-all duration-200
                                    flex items-center justify-between
                                    border border-neutral-200 dark:border-neutral-700/50
                                    ${trainingMode
                                        ? 'bg-blue-500/10 dark:bg-blue-500/15 border-blue-400 dark:border-blue-500'
                                        : 'bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                                    }
                                `}
                            >
                                <div>
                                    <p className="font-medium text-neutral-950 dark:text-white text-sm">
                                        Personalize Gestures
                                    </p>
                                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
                                        Train custom hand gestures
                                    </p>
                                </div>
                                <svg 
                                    className={`w-4 h-4 text-neutral-600 dark:text-neutral-400 transition-transform duration-200 flex-shrink-0 ml-3 ${trainingMode ? 'rotate-180' : ''}`}
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                </svg>
                            </button>

                            {/* Voice toggle button */}
                            <div className="border-t border-neutral-200 dark:border-neutral-800/50 mt-4 pt-4">
                                <button
                                    onClick={() => setVoiceEnabled(!voiceEnabled)}
                                    className="w-full px-4 py-3 rounded-xl transition-all duration-200
                                        flex items-center justify-between
                                        bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700
                                        hover:bg-neutral-100 dark:hover:bg-neutral-800 active:scale-95"
                                >
                                    <div className="text-left">
                                        <p className="font-medium text-neutral-950 dark:text-white text-sm">
                                            {voiceEnabled ? '🔊 Voice Enabled' : '🔇 Voice Disabled'}
                                        </p>
                                        <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
                                            Gesture announcements
                                        </p>
                                    </div>
                                    <div className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex-shrink-0 ${
                                        voiceEnabled 
                                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                                            : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                                    }`}>
                                        {voiceEnabled ? 'ON' : 'OFF'}
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Training mode panel */}
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
                <footer className="border-t border-neutral-200/50 dark:border-neutral-800/50 bg-neutral-50/50 dark:bg-neutral-900/50 py-4">
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 text-center max-w-4xl mx-auto">
                        Hand tracking by MediaPipe Hands • Gesture recognition with TensorFlow.js
                    </p>
                </footer>
            </div>
        </div>
    );
}

export default App;
