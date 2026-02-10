# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
