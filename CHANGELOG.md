# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.3.0] — 2026-02-15

### ✨ Added - Premium macOS/iOS-Inspired UI Redesign

**Major visual overhaul**: Complete UI refresh inspired by macOS Ventura/Sonoma and iOS system design. All functional improvements from v3.2.0 are fully preserved.

#### Design Philosophy
- **Premium aesthetic**: Calm, polished, professional
- **macOS/iOS inspired**: Native Apple design language (inspired, not copied)
- **Dark/Light modes**: Full theme support with system preference detection
- **Glassmorphism**: Subtle blur and translucency for depth
- **Typography**: Inter font with generous whitespace and clear hierarchy
- **Micro-interactions**: Smooth transitions, subtle animations, intentional states

#### Visual Changes

**Color System**
- Light mode: Soft off-white background (#f5f5f7), white cards with subtle borders
- Dark mode: Deep graphite background (#1d1d1f), frosted glass cards
- New accent colors: macOS system blue (#0071e3), system green (#34c759)
- Semantic grays: Primary, secondary, and tertiary text colors for hierarchy

**Components**
- ✅ Premium glass cards with backdrop blur and subtle shadows
- ✅ Refined video feed container with larger rounded corners
- ✅ macOS-style toggle switches for settings
- ✅ Smooth gesture detection badges with active states
- ✅ Status indicator dots with pulse animation for active gestures
- ✅ Improved header with dark mode toggle
- ✅ Settings panel with grouped controls
- ✅ Better spacing and visual rhythm throughout

**Theme Toggle**
- ✅ Elegant sun/moon icon button in header
- ✅ localStorage persistence of user preference
- ✅ Respects system preference on first visit
- ✅ Smooth color transitions (300ms)
- ✅ Full dark mode support for all components

**Interactions**
- ✅ Smooth hover states on all interactive elements
- ✅ Scale animation on active gesture badges (105% scale)
- ✅ Pulse animation on active status indicator
- ✅ Fade-in animation for training mode panel
- ✅ Disabled button states that feel intentional

#### Modified Files
- `src/App.jsx` — Complete redesign, all logic preserved
- `tailwind.config.js` — macOS color palette, new animations
- `src/index.css` — Premium glass effects, component utilities

#### Notes
- No functional changes to gesture detection, ML, TTS, or training
- All v3.2.0 fixes (Gesture Decision Engine, TTS reliability) intact
- Performance optimized (glass blur effects performant across browsers)
- Fully accessible (proper semantic HTML, ARIA labels)

---

## [3.2.0] — 2026-02-15

### ✨ Added - Gesture Decision Engine

**Major usability improvement**: Fixed real-world gesture confusion and jitter problems without retraining the ML model.

Introduces `gestureDecisionEngine.js` — a deterministic, frame-by-frame decision layer that sits between raw ML predictions and UI triggers. This hardens the gesture recognition system for real-world use.

#### What was fixed:

- **Gesture Confusion (CLOSED_FIST ↔ THUMBS_UP)**
    - Implemented **Thumb Dominance Gate**: THUMBS_UP now requires the thumb to be significantly more extended than all other fingers
    - If thumb is not dominant, the gesture is reclassified as CLOSED_FIST
    - Eliminates false THUMBS_UP when fist has thumb slightly peeking out
    - Threshold: 1.3× (configurable) — thumb distance must be 30% greater than max other finger distance

- **Frame-to-Frame Jitter**
    - Implemented **Stability Voting**: Requires 8 consecutive frames of the same gesture before accepting it
    - Small camera jitter that flip-flops between gestures no longer triggers repeated TTS
    - Smooth, natural interaction that feels intentional

- **Gesture Spam / Repeated TTS**
    - Implemented **Intent Lock with Cooldown**: Once a gesture is accepted, it's locked for 2.5 seconds
    - During cooldown, all new gesture predictions are silently ignored
    - Prevents re-triggering the same corporate phrase when hand jitters
    - Cooldown resets when hand disappears
    - Configurable: `GESTURE_COOLDOWN_MS` (default 2500)

- **Conservative Tie-Breaking** (forward-compatible)
    - Code structure ready for confidence-aware tie-breaking
    - When two gestures have similar confidence, conservative gestures win
    - Example: THUMBS_UP (75% confidence) vs CLOSED_FIST (68% confidence) → prefer CLOSED_FIST if margin < 10%
    - Ranking: OPEN_PALM > POINTING_UP > PEACE_SIGN > CLOSED_FIST > THUMBS_UP

#### New Files:
- `src/ml/gestureDecisionEngine.js` — Core decision logic with all gates and voting

#### Modified Files:
- `src/ml/gestureModel.js` — Now exposes full probability distribution for tie-breaking
- `src/hooks/useHandTracking.js` — Integrated decision engine into frame processing pipeline

#### Code Quality:
- **Fully documented**: Each gate has explicit comments explaining the WHY
- **Debuggable**: `getEngineState()` API for inspecting decision state frame-by-frame
- **Testable**: Pure functions with explicit geometry checks (no hidden heuristics)
- **Zero-cost**: No additional ML, no API calls, 100% browser-side

#### Configuration (in `gestureDecisionEngine.js`):
```javascript
STABILITY_FRAMES = 8              // Frames required to stabilize
GESTURE_COOLDOWN_MS = 2500        // Cooldown after acceptance (ms)
THUMB_DOMINANCE_THRESHOLD = 1.3   // Thumb distance factor (higher = stricter)
CONFIDENCE_TIE_BREAK_THRESHOLD = 0.1  // Confidence margin for tie-breaking
```

---

## [3.1.2] — 2026-02-15

### 🐛 Fixed
- **Text-to-Speech Reliability**: Improved TTS initialization and voice loading across all browsers.
    - Fixed voice event listener using proper `addEventListener()` instead of property assignment to avoid handler conflicts.
    - Added fallback voice loading in `speakPhrase()` to handle timing issues when voices haven't loaded from state.
    - Wrapped TTS priming in try-catch with promise error handling for safer initialization.
    - Enhanced error logging to show specific error types instead of full error objects.
    - Added proper cleanup of voice change event listeners to prevent memory leaks.
    - Added `onstart` and `onend` callbacks for better speech lifecycle tracking.

---

## [3.1.1] — 2026-02-10

### 🐛 Fixed
- **Deployment TTS Failure**: Fixed an issue where Text-to-Speech would fail in production or on new devices due to uninitialized voices or strict browser autoplay policies.
    - Added explicit **voice loading** handling for Chrome/Chromium (`onvoiceschanged`).
    - Added **TTS engine priming**: Clicking "Voice On" now triggers a silent utterance to unlock the audio context.

---

## [3.1.0] — 2026-02-10

### 🐛 Fixed
- **TTS Silence/Stuttering**: Implemented a 500ms stability filter (throttle) in `App.jsx` to prevent gesture flickering from rapidly canceling speech. Text-to-speech now speaks smoothly even if detection jitters.
- **Console Noise**: Removed verbose TTS debugging logs from production code.

---

## [3.0.0] — 2026-02-10

### 🎓 Training Mode — Browser-Side Gesture Personalization

Major release: users can now train their own gesture model entirely in the browser.

### Added
- **Training Mode UI** — "Personalize Gestures" toggle in the header
- **In-browser model training** using TensorFlow.js (Dense 128→64→5 architecture)
- **IndexedDB model persistence** — user models saved to `indexeddb://corporate-gesture-model`
- **Auto-loading** — user model loaded from IndexedDB on startup, falls back to default
- **Hot-swap model** — trained model applies immediately without page reload
- **3-second auto-capture** — records ~30 landmark frames per gesture with visual progress
- **Sample count tracking** — per-gesture sample count badges with color coding
- **Progress indicators** — epoch-by-epoch training progress bar
- **Reset personalization** — clears dataset + model, reverts to default
- `src/ml/localModelManager.js` — IndexedDB load/save/clear/check API
- `src/ml/gestureTrainer.js` — dataset collection, normalization, training pipeline
- `src/components/TrainingMode.jsx` — user-facing training UI panel

### Changed
- `src/ml/gestureModel.js` — IndexedDB-first model loading, model swap/reset API
- `src/hooks/useHandTracking.js` — exposes live landmarks via ref for training capture
- `src/components/VideoFeed.jsx` — passes `landmarksRef` to hand tracking hook
- `src/App.jsx` — Training Mode toggle, landmarks ref, conditional panel rendering
- `package.json` — bumped to v3.0.0

---

## [2.0.0] — 2026-02-10

### 🧠 ML Gesture Classifier

Major release: replaced rule-based gesture detection with a TensorFlow.js neural network.

### Added
- **TensorFlow.js integration** — browser-only ML inference, no backend required
- **Trained neural network** (63→128→64→5) with 100% validation accuracy
- **Model training script** (`npm run train-model`) for offline training with synthetic data
- **Confidence thresholding** (0.65) for robust gesture detection
- **Proper tensor management** — all intermediate tensors disposed to prevent memory leaks
- **Model warm-up** — dummy prediction on load to pre-initialize WebGL
- `src/ml/gestureModel.js` — model loader, preprocessor, and inference engine
- `scripts/trainModel.mjs` — synthetic data generator + training pipeline
- `public/model/` — pre-trained model artifacts (model.json + weights)

### Changed
- `useHandTracking.js` — now uses ML predictions instead of rule-based classifier
- `package.json` — bumped to v2.0.0, added `@tensorflow/tfjs` dependency

### Deprecated
- `src/utils/gestureClassifier.js` — kept as fallback reference but no longer imported

---

## [1.1.0] — 2026-02-09

### 🔊 Text-to-Speech

### Added
- **Text-to-Speech** using Web Speech API — vocalizes detected corporate phrases
- **Voice toggle button** in the header (Voice On / Voice Off)
- TTS ref-based state management to prevent stale closures

### Fixed
- TTS toggle state not syncing with callback via `useRef`

---

## [1.0.0] — 2026-02-09

### 🎉 Initial Release

### Added
- **Real-time hand tracking** using MediaPipe Hands (CDN-loaded)
- **Rule-based gesture classifier** detecting 5 gestures
- **Corporate phrase mapping** for each gesture
- **Hand skeleton overlay** with green landmark visualization
- **Responsive UI** with glassmorphism design, dark theme
- **Gesture legend** with active state highlighting
- **Vercel deployment** support with static hosting
- React 18 + Vite 5 + Tailwind CSS 3 stack

### Gesture Support
- ✋ Open Palm → "Let's put a pin in that for now."
- ✊ Closed Fist → "We need to circle back to the core deliverables."
- 👍 Thumbs Up → "I am fully aligned with this initiative."
- ☝️ Pointing Up → "Let's take this offline."
- ✌️ Peace Sign → "We have verified the cross-functional synergy."
