# Corporate Signal Translator 🖐️💼

> *Translate your hand gestures into peak corporate jargon — powered by AI, running entirely in your browser.*

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen?style=flat-square)](https://corporate-hand-translator.vercel.app)
[![Version](https://img.shields.io/badge/version-3.2.0-blue?style=flat-square)](#changelog)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![TensorFlow.js](https://img.shields.io/badge/TensorFlow.js-v4.17-orange?style=flat-square&logo=tensorflow)](https://www.tensorflow.org/js)
[![Vercel](https://img.shields.io/badge/deployed%20on-Vercel-black?style=flat-square&logo=vercel)](https://vercel.com)

---

## ✨ What Is This?

A satirical web app that uses **real-time hand tracking** and a **TensorFlow.js neural network** to detect your gestures and translate them into the finest corporate speak. No backend. No API keys. Just pure, client-side machine learning.

Show your hand to the camera → AI detects the gesture → You get a corporate power phrase.

---

## 🎯 Features

| Feature | Description |
|---------|-------------|
| 🧠 **ML Gesture Recognition** | TensorFlow.js neural network classifies gestures in real-time |
| 🎓 **Training Mode** | Personalize gesture recognition in-browser — no servers, no uploads |
| 🎥 **Hand Tracking** | MediaPipe Hands detects 21 landmarks per hand at 30fps |
| 🦴 **Skeleton Overlay** | Live hand skeleton visualization on the video feed |
| 🔊 **Text-to-Speech** | Reads corporate phrases aloud (toggleable) |
| 📱 **Responsive Design** | Glassmorphism UI that works on desktop and mobile |
| ☁️ **Zero Backend** | Everything runs in the browser — deploy as static files |

---

## 🤝 Gesture Translations

| Gesture | Emoji | Corporate Translation |
|---------|-------|-----------------------|
| Open Palm | ✋ | *"Let's put a pin in that for now."* |
| Closed Fist | ✊ | *"We need to circle back to the core deliverables."* |
| Thumbs Up | 👍 | *"I am fully aligned with this initiative."* |
| Pointing Up | ☝️ | *"Let's take this offline."* |
| Peace Sign | ✌️ | *"We have verified the cross-functional synergy."* |

---

## 🏗️ Architecture

```
Webcam → MediaPipe Hands → 21 Landmarks (x,y,z)
    ↓
Preprocessing → 63-float vector (normalized to wrist)
    ↓
TF.js Neural Network (63 → 128 → 64 → 5)
    ↓
Gesture Label + Confidence Score
    ↓
Corporate Phrase → UI + TTS

─── Training Mode ───
Record Gestures → Collect Landmarks → Train in Browser
    ↓
Save to IndexedDB → Auto-load on next visit
```

### ML Model Details

| Property | Value |
|----------|-------|
| Input shape | `[1, 63]` — 21 landmarks × 3 coordinates |
| Architecture | Dense(128, ReLU) → Dropout(0.3) → Dense(64, ReLU) → Dropout(0.2) → Dense(5, Softmax) |
| Parameters | 16,773 |
| Model size | ~67 KB |
| Training accuracy | 100% |
| Confidence threshold | 0.65 |
| Inference time | < 5ms per frame |

---

## �️ Gesture Decision Engine (v3.2+)

**The problem**: Raw ML predictions jitter frame-to-frame, causing false gesture triggers and repeated TTS.

**The solution**: A deterministic decision layer that hardens real-world reliability without retraining.

### What It Does

| Problem | Solution | Benefit |
|---------|----------|---------|
| CLOSED_FIST misclassified as THUMBS_UP | **Thumb Dominance Gate** — requires thumb 30% more extended than other fingers | No more false "I am fully aligned" when making a fist |
| Camera jitter flips between gestures | **Stability Voting** — requires 8 consecutive frames of same gesture | Smooth, intentional-feeling gestures |
| Same gesture triggers TTS repeatedly | **Intent Lock** — 2.5s cooldown after acceptance | Corporate phrases don't spam |

### Configuration

Located in `src/ml/gestureDecisionEngine.js`:

```javascript
STABILITY_FRAMES = 8              // Frames to stabilize (higher = stricter)
GESTURE_COOLDOWN_MS = 2500        // Cooldown after acceptance
THUMB_DOMINANCE_THRESHOLD = 1.3   // Thumb extension factor (higher = stricter)
CONFIDENCE_TIE_BREAK_THRESHOLD = 0.1  // Confidence tie-breaker margin
```

### For Developers

Debug gesture decisions in the browser console:

```javascript
import { getEngineState } from './src/ml/gestureDecisionEngine';

// Check engine state at any time
console.log(getEngineState());
// Output: {
//   acceptedGesture: 'THUMBS_UP',
//   inCooldown: true,
//   stabilityBufferSize: 8,
//   cooldownTimeRemaining: 1500
// }
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React 18 + Vite 5 |
| **Styling** | Tailwind CSS 3 |
| **Hand Tracking** | MediaPipe Hands (CDN) |
| **ML Inference** | TensorFlow.js 4.17 |
| **Decision Logic** | Gesture Decision Engine (in-browser) |
| **Speech** | Web Speech API (native) |
| **Hosting** | Vercel (static) |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and **npm**
- A **webcam** (built-in or external)
- A modern browser (Chrome, Edge, Firefox)

### Installation

```bash
# Clone the repository
git clone https://github.com/M4dhxv/corporate-hand-translator.git
cd corporate-hand-translator

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and allow camera access.

### Building for Production

```bash
npm run build
npm run preview  # Preview the production build locally
```

---

## 🎓 Personalize Gestures (Training Mode)

Users can train their own gesture model **entirely in the browser** — no servers, no uploads, no accounts.

### How It Works

1. Click **"Personalize Gestures"** in the header
2. Hold each gesture steady in front of the camera
3. Click the **Record** button for each gesture (auto-captures ~30 frames in 3 seconds)
4. Collect at least **10 samples per gesture**
5. Click **"Train My Gestures"** — training runs in-browser (~15 seconds)
6. Done! Your personalized model is saved to **IndexedDB** and loads automatically on future visits

### Technical Details

| Property | Value |
|----------|-------|
| Storage | `indexeddb://corporate-gesture-model` |
| Model size | < 500 KB |
| Training epochs | 50 |
| Privacy | All data stays in your browser |
| Reset | Click "Reset Personalization" to revert to the default model |

---

## 🧠 Default Model Training

The default ML model is pre-trained and included in the repo (`public/model/`). To retrain:

```bash
# Generate synthetic data + train the neural network
npm run train-model
```

This runs `scripts/trainModel.mjs`, which:
1. Generates 4,000 synthetic hand landmark samples (800 per class)
2. Trains a feed-forward neural network for 100 epochs
3. Saves the model to `public/model/` as static assets

> The training script uses synthetic data based on realistic hand poses. No external datasets or GPU required.

---

## 📁 Project Structure

```
corporate-hand-translator/
├── public/
│   └── model/                     # Default TF.js model (static assets)
│       ├── model.json             # Model topology + weights manifest
│       └── group1-shard1of1.bin   # Model weights
├── scripts/
│   └── trainModel.mjs             # Offline model training script
├── src/
│   ├── ml/
│   │   ├── gestureModel.js        # Model loader + inference engine
│   │   ├── localModelManager.js   # IndexedDB model persistence
│   │   └── gestureTrainer.js      # In-browser training pipeline
│   ├── hooks/
│   │   └── useHandTracking.js     # MediaPipe + ML integration hook
│   ├── components/
│   │   ├── VideoFeed.jsx          # Camera feed + canvas overlay
│   │   ├── PhraseOverlay.jsx      # Gesture phrase display
│   │   └── TrainingMode.jsx       # Training Mode UI panel
│   ├── utils/
│   │   └── gestureClassifier.js   # Legacy rule-based classifier
│   ├── App.jsx                    # Main application component
│   ├── index.css                  # Global styles + design system
│   └── main.jsx                   # Application entry point
├── package.json
├── vite.config.js
├── tailwind.config.js
├── vercel.json
├── CHANGELOG.md
└── LICENSE
```

---

## ☁️ Deployment

### Vercel (Recommended)

The app is designed for Vercel's static hosting. Just push to GitHub — Vercel auto-deploys.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/M4dhxv/corporate-hand-translator)

### Any Static Host

```bash
npm run build
# Upload the `dist/` folder to any static host (Netlify, GitHub Pages, etc.)
```

> **Note:** The ML model files in `public/model/` are automatically copied to `dist/model/` during build and served as static assets.

---

## 🔒 Privacy & Security

- **All processing is client-side** — video frames and landmarks never leave your browser
- **No data collection** — zero telemetry, zero analytics
- **No API keys** — everything is open-source and self-contained
- **Camera access** is only used for hand tracking and is not recorded

---

## 🤝 Contributing

Contributions are welcome! Here's how:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-gesture`)
3. Commit your changes (`git commit -m 'Add amazing gesture'`)
4. Push to the branch (`git push origin feature/amazing-gesture`)
5. Open a Pull Request

### Adding New Gestures

1. Add a new generator function in `scripts/trainModel.mjs`
2. Add the class to `GESTURE_CLASSES` array
3. Run `npm run train-model` to retrain
4. Add phrase mapping in `src/ml/gestureModel.js`

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [MediaPipe](https://mediapipe.dev/) by Google for hand landmark detection
- [TensorFlow.js](https://www.tensorflow.org/js) for browser-based ML inference
- [Vite](https://vitejs.dev/) for blazing-fast development
- [Tailwind CSS](https://tailwindcss.com/) for utility-first styling

---

<p align="center">
  <em>Built with ❤️ and excessive corporate synergy</em>
</p>
