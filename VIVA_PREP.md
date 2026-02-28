# 🎓 VIVA PREPARATION GUIDE — Corporate Signal Translator

## READ THIS FIRST

This document has everything you need to clear the viva. Every team member should know ALL of it. Read it 3 times, then test each other.

**Golden Rule:** If you don't know the answer, say "That was handled by [name], but from what I understand..." and give your best attempt. NEVER say "I don't know" or "I didn't do that part."

---

## PART 1: THE 2-MINUTE PROJECT EXPLANATION

Memorize this. This is what you say when they ask "Explain your project."

> "Our project is called **Corporate Signal Translator**. It is a web-based application that uses **Artificial Intelligence** to recognize hand gestures in real-time using the user's webcam, and translates them into funny corporate jargon phrases.
>
> For example, if you show a thumbs up, it says *'I am fully aligned with this initiative.'* If you show an open palm, it says *'Let's put a pin in that for now.'*
>
> The system uses **MediaPipe** from Google to detect 21 landmark points on the hand, and then a **feedforward neural network** classifies these points into one of 5 gesture classes. We also built a **decision engine** that prevents wrong detections by using a voting system.
>
> The unique thing about our project is that **everything runs inside the browser**. There is no server, no cloud, no API calls. The neural network runs on the user's device using TensorFlow.js. This means **zero server cost, zero latency, and complete privacy** — the camera feed never leaves the user's machine.
>
> We also built a **training module** where users can record their own gesture samples and retrain the model inside the browser. The retrained model is saved in the browser's local storage."

**Practice this until you can say it in 2 minutes without reading.**

---

## PART 2: HOW THE SYSTEM WORKS (Step by Step)

### The Pipeline (Draw this on the board if asked)

```
┌──────────┐    ┌───────────┐    ┌────────────────┐    ┌─────────────────┐    ┌──────────┐
│  Webcam  │ →  │ MediaPipe │ →  │ Neural Network │ →  │ Decision Engine │ →  │ Output   │
│ (Camera) │    │ (21 pts)  │    │ (Classification)│   │ (Voting+Gates) │    │ Text+Voice│
└──────────┘    └───────────┘    └────────────────┘    └─────────────────┘    └──────────┘
```

### Step 1: Camera Capture
- The browser opens the user's webcam
- We get a live video feed at 30 frames per second
- Each frame is a single image that gets processed

### Step 2: Hand Detection (MediaPipe)
- **MediaPipe Hands** is a pre-trained AI model made by Google
- It looks at the camera frame and finds the hand
- It outputs **21 landmark points** — these are specific locations on the hand:
  - Point 0 = Wrist
  - Points 1-4 = Thumb (base to tip)
  - Points 5-8 = Index finger (base to tip)
  - Points 9-12 = Middle finger (base to tip)
  - Points 13-16 = Ring finger (base to tip)
  - Points 17-20 = Pinky (base to tip)
- Each point has **3 coordinates**: x (horizontal), y (vertical), z (depth)
- Total data per frame: **21 points × 3 values = 63 numbers**

### Step 3: Preprocessing (Normalization)
- The 63 numbers are **normalized relative to the wrist**
- This means we subtract the wrist position from all other points
- **Why?** So the gesture is recognized regardless of where the hand is on screen
- If your hand is in the top-left corner or bottom-right corner, the relative finger positions are the same

### Step 4: Neural Network Classification
- The 63 normalized values are fed into our **feedforward neural network**
- Architecture:
  - **Input layer**: 63 neurons (one per coordinate)
  - **Hidden layer 1**: 128 neurons, ReLU activation
  - **Dropout layer**: 30% dropout (prevents overfitting during training)
  - **Hidden layer 2**: 64 neurons, ReLU activation
  - **Output layer**: 5 neurons, Softmax activation (one per gesture)
- The output is **5 probabilities** that add up to 1.0
- Example output: `[0.02, 0.05, 0.88, 0.03, 0.02]` → 88% confidence it's Thumbs Up
- If the highest probability is above **0.65 (65%)**, we accept the prediction

### Step 5: Decision Engine (Post-Processing)
The neural network can sometimes be wrong or flicker between guesses. The decision engine fixes this:

**Gate 1 — Stability Voting:**
- We don't trust a single frame
- The AI must predict the **same gesture for 8 consecutive frames** before we accept it
- This prevents flickering (e.g., switching between fist and thumbs-up rapidly)

**Gate 2 — Thumb Dominance Check:**
- Thumbs Up and Closed Fist look very similar to the AI
- Extra check: we measure the distance from wrist to thumb tip, and compare it to distances of other fingers
- If thumb distance is NOT at least **1.3 times greater** than the longest other finger → it's actually a Closed Fist, not Thumbs Up

**Gate 3 — Cooldown:**
- After accepting a gesture, we wait **2.5 seconds** before accepting the next one
- This prevents the same gesture from triggering repeatedly while the user holds their hand still

### Step 6: Output
- The accepted gesture is mapped to a **corporate phrase** (displayed on screen)
- **Text-to-Speech** reads the phrase aloud using the browser's built-in speech API
- A **green skeleton** is drawn over the hand on the video feed so the user sees their landmarks

---

## PART 3: THE 5 GESTURES

| # | Gesture | Emoji | Corporate Phrase |
|---|---------|-------|-----------------|
| 1 | Open Palm | ✋ | "Let's put a pin in that for now." |
| 2 | Closed Fist | ✊ | "We need to circle back to the core deliverables." |
| 3 | Thumbs Up | 👍 | "I am fully aligned with this initiative." |
| 4 | Pointing Up | ☝️ | "Let's take this offline." |
| 5 | Peace Sign | ✌️ | "We have verified the cross-functional synergy." |

---

## PART 4: THE TRAINING MODULE

### What it does:
- Users can **retrain the model** with their own hand gestures
- This is called **transfer learning / personalization**

### How it works:
1. User clicks "Personalize" → opens the training panel
2. For each of the 5 gestures, user holds the gesture and clicks "Record"
3. The system captures **landmark frames** for 3 seconds per gesture
4. Minimum **10 samples per gesture** required (system enforces this)
5. User clicks "Train" → a new neural network is trained **inside the browser**
6. Training takes ~10-15 seconds (50 epochs)
7. The new model **replaces** the default model immediately (hot-swap)
8. The trained model is **saved in the browser's local storage** (IndexedDB)
9. Next time the user opens the app, their personalized model loads automatically

### Training Hyperparameters:
- **Epochs**: 50
- **Batch size**: 32
- **Learning rate**: 0.001
- **Optimizer**: Adam
- **Loss function**: Categorical Cross-Entropy
- **Validation split**: 20%

### Why in-browser training?
- No data leaves the user's device → **privacy preserved**
- No server costs for training
- Instant feedback — user sees their model improve in real-time

---

## PART 5: KEY TECHNOLOGIES

| Technology | What it is | Why we used it |
|---|---|---|
| **TensorFlow.js** | Google's ML library for JavaScript | Runs neural networks in the browser, no server needed |
| **MediaPipe Hands** | Google's hand detection AI | Detects 21 hand landmarks accurately and fast |
| **JavaScript/TypeScript** | Programming language | TypeScript adds type-checking to catch bugs before runtime |
| **React** | UI library (by Facebook/Meta) | Makes building interactive interfaces easier |
| **Vite** | Build tool | Compiles and optimizes the code for production |
| **Web Speech API** | Browser's built-in text-to-speech | Reads phrases aloud, no external service needed |
| **IndexedDB** | Browser's built-in database | Saves the trained model locally |

---

## PART 6: PROJECT FEATURES LIST

1. **Real-time hand gesture recognition** using webcam
2. **5 distinct gestures** classified by a neural network
3. **Decision engine** with stability voting, thumb dominance gating, and cooldown
4. **Text-to-Speech** — speaks the corporate phrase aloud
5. **In-browser model training** — users can personalize gesture recognition
6. **Model persistence** — trained model saved in browser, persists across sessions
7. **Model hot-swap** — new model applies instantly without page reload
8. **Dark mode** with system preference detection
9. **Hand skeleton visualization** — green overlay drawn on video
10. **Error recovery** — graceful handling of camera denial, network failure, WebGL issues
11. **Responsive design** — works on different screen sizes
12. **Privacy-first** — zero data sent to any server, everything runs locally
13. **Automated testing** — 32 unit tests covering the decision engine
14. **Type safety** — full TypeScript with strict mode, zero errors
15. **Performance optimized** — 21KB initial load, ML library loads in background

---

## PART 7: ADVANTAGES AND LIMITATIONS

### Advantages:
1. Zero server cost — runs entirely in the browser
2. No internet needed after first load (models cached)
3. Privacy-first — camera feed never leaves the device
4. Users can retrain with their own gestures (personalization)
5. Cross-browser compatible (Chrome, Edge, Firefox)
6. Fast — neural network inference takes ~5ms per frame
7. Accessible — text-to-speech for visually impaired users
8. Lightweight — initial page load is only 21KB

### Limitations:
1. Single hand detection only (not both hands)
2. Requires good lighting for accurate landmark detection
3. Currently supports 5 gestures (expandable)
4. Requires a modern browser with WebGL support
5. Requires webcam access (permission needed)
6. First load requires internet (to download MediaPipe from CDN)
7. TensorFlow.js is large (~1.7MB) though loaded lazily

### Future Scope:
1. Add more gestures (10, 20, or custom)
2. Two-hand gesture recognition
3. Sign language translation (ISL/ASL)
4. Mobile app version (React Native)
5. Chrome Extension deployment
6. Multi-language corporate phrases
7. Gesture-to-email or gesture-to-Slack integration
8. Transfer learning from larger datasets

---

## PART 8: QUESTIONS AND ANSWERS

### Basic Questions

**Q1: What is your project about?**
> It is an AI-based web application that recognizes hand gestures through the webcam and translates them into corporate jargon phrases in real-time. Everything runs in the browser — no server needed.

**Q2: Why did you choose this project?**
> We wanted to explore real-time computer vision and machine learning in the browser. Hand gesture recognition has practical applications in accessibility, sign language, and touchless interfaces. We added the corporate humor angle to make it engaging and demonstrate the full pipeline.

**Q3: What problem does this solve?**
> 1. It demonstrates that ML inference can run entirely client-side, eliminating server costs and latency.
> 2. It shows a privacy-first approach — user's camera feed never leaves their device.
> 3. The personalization feature shows how end-users can adapt AI models without technical knowledge.
> 4. It can be extended to real applications like sign language translation or touchless UI control.

**Q4: What technologies did you use?**
> TensorFlow.js for the neural network, MediaPipe Hands from Google for hand detection, TypeScript as the programming language, React for the user interface, and Vite as the build tool. For speech output, we use the browser's built-in Web Speech API.

**Q5: Why JavaScript/TypeScript and not Python?**
> Python would require a server to run the ML model, which means hosting costs, API latency, and the camera feed leaving the user's device. With TensorFlow.js, the same neural network runs directly in the browser — zero server cost, zero latency, complete privacy.

---

### Neural Network Questions

**Q6: Explain your neural network architecture.**
> It is a feedforward neural network (also called a Multi-Layer Perceptron). Input layer has 63 neurons — 21 hand landmarks times 3 coordinates each. First hidden layer has 128 neurons with ReLU activation. Then a 30% dropout layer to prevent overfitting. Second hidden layer has 64 neurons with ReLU. Output layer has 5 neurons with softmax activation — one for each gesture class.

**Q7: Why ReLU activation?**
> ReLU (Rectified Linear Unit) is computationally efficient — it simply outputs max(0, x). It avoids the vanishing gradient problem that sigmoid and tanh have in deeper networks. It's the standard choice for hidden layers in modern neural networks.

**Q8: Why Softmax in the output layer?**
> Softmax converts the raw output values into probabilities that sum to 1.0. This gives us a probability distribution over all 5 gesture classes. We can then pick the class with the highest probability and also set a confidence threshold (65%) to reject uncertain predictions.

**Q9: What is Dropout and why did you use it?**
> Dropout randomly deactivates 30% of neurons during each training step. This forces the network to not rely on any single neuron and learn more robust features. It prevents **overfitting** — where the model memorizes training data instead of learning general patterns.

**Q10: What loss function did you use and why?**
> Categorical cross-entropy. It measures the difference between the predicted probability distribution and the actual one-hot encoded label. It's the standard loss function for multi-class classification problems.

**Q11: What optimizer did you use?**
> Adam optimizer with a learning rate of 0.001. Adam combines the advantages of AdaGrad (per-parameter learning rates) and RMSProp (moving average of gradients). It converges faster than basic SGD for most problems.

**Q12: How did you preprocess the data?**
> We normalize all 21 landmark coordinates relative to the wrist (landmark 0). We subtract the wrist's x, y, z from every other landmark's x, y, z. This makes the model position-invariant — it recognizes the gesture regardless of where the hand appears on screen.

**Q13: What is the input shape and output shape?**
> Input: [1, 63] — a single sample with 63 features (21 landmarks × 3 coordinates). Output: [1, 5] — 5 probabilities, one per gesture class.

**Q14: How do you handle overfitting?**
> Three ways: (1) Dropout layer at 30%, (2) 20% validation split during training to monitor generalization, (3) the model is small (128→64 neurons) relative to the problem, so it doesn't have capacity to overfit severely.

**Q15: What is the confidence threshold?**
> 0.65 (65%). If the highest predicted probability is below 65%, we reject the prediction and show "Waiting for input." This prevents low-confidence guesses from reaching the user.

---

### Decision Engine Questions

**Q16: Why not just use the neural network output directly?**
> Raw neural network output changes every frame (30 times per second). Even small hand movements cause predictions to flicker between classes. If we used raw output, the app would constantly switch between gestures and trigger speech repeatedly. The decision engine adds stability.

**Q17: How does stability voting work?**
> We maintain a buffer of the last 8 predictions. A gesture is only accepted if ALL 8 consecutive frames predict the same class. If even one frame disagrees, the buffer resets. This ensures only deliberate, held gestures trigger output.

**Q18: What is thumb dominance gating?**
> Thumbs Up and Closed Fist are geometrically similar — both have fingers curled. The neural network sometimes confuses them. So we added an extra geometric check: we measure the Euclidean distance from wrist to thumb tip and compare it to the maximum distance of any other finger. If the thumb is NOT at least 1.3 times farther than the longest other finger, we reclassify THUMBS_UP as CLOSED_FIST.

**Q19: What is the cooldown mechanism?**
> After a gesture is accepted and the phrase is spoken, we ignore all new gestures for 2.5 seconds. This prevents the same gesture from triggering repeatedly while the user holds their hand still. It also prevents speech from overlapping.

**Q20: Why 8 frames for stability? Why not 5 or 15?**
> 8 frames at 30fps = ~267 milliseconds. This is long enough to filter out random flickers but short enough that the user doesn't notice a delay. 5 frames was too sensitive (still got false triggers). 15 frames felt sluggish (noticeable lag). 8 was the sweet spot found through testing.

---

### System Design Questions

**Q21: Draw/explain the system architecture.**
> The system has 4 layers:
> 1. **Configuration Layer** — single source of truth for all gesture labels, phrases, and mappings
> 2. **ML Layer** — model loading, inference, training, and persistence
> 3. **Logic Layer** — hooks that connect camera to ML and manage state
> 4. **UI Layer** — React components that display video, phrases, and training interface
>
> Data flows one way: Camera → MediaPipe → Neural Network → Decision Engine → UI

**Q22: What is "single source of truth" in your project?**
> All gesture labels, phrases, emoji mappings, and model configuration are defined in ONE file (gestureConfig). Every other file imports from it. This prevents bugs where one file says there are 5 gestures but another file says 6.

**Q23: How does the model load?**
> Priority system: First, we check if the user has a personalized model saved in IndexedDB. If yes, load that. If no, load the default pre-trained model from the server. The model is cached in memory — loaded only once.

**Q24: What happens if the internet is slow or down?**
> MediaPipe is loaded from a CDN (Content Delivery Network). If it fails, we retry up to 2 times with a 15-second timeout each. If all retries fail, we show a user-friendly error message with a "Try Again" button. The app never shows a blank screen.

**Q25: What is model hot-swap?**
> When the user trains a new model, we replace the old model in memory immediately without reloading the page. The old model is disposed (freed from memory) and the new model takes over. The user sees the change instantly.

---

### Training Module Questions

**Q26: How does in-browser training work?**
> The user records gesture samples through the webcam. For each frame, we capture the 21 hand landmarks and normalize them. After collecting at least 10 samples per gesture, we create a new neural network, convert the samples to tensors, and call model.fit() — which runs backpropagation entirely in the browser using WebGL (GPU acceleration).

**Q27: What is the training data format?**
> Each sample is a Float32Array of 63 values (21 landmarks × 3 coordinates, normalized to wrist). Labels are one-hot encoded vectors of length 5. Example: Thumbs Up = [0, 0, 1, 0, 0].

**Q28: How long does training take?**
> About 10-15 seconds for 50 epochs with the default configuration. The browser uses WebGL to run matrix operations on the GPU, which makes it fast enough.

**Q29: Where is the trained model saved?**
> In IndexedDB — a database built into every modern browser. TensorFlow.js has built-in support for saving and loading models from IndexedDB. The model persists even if the user closes the browser.

**Q30: What is one-hot encoding?**
> Converting categorical labels into binary vectors. With 5 classes: Open Palm = [1,0,0,0,0], Closed Fist = [0,1,0,0,0], Thumbs Up = [0,0,1,0,0], Pointing Up = [0,0,0,1,0], Peace Sign = [0,0,0,0,1].

---

### Testing Questions

**Q31: How did you test the project?**
> We wrote 32 automated unit tests for the decision engine — the most critical component. Tests cover: stability voting (requires 8 frames), thumb dominance gating, cooldown enforcement, hand disappearance reset, NONE prediction handling, mixed-frame detection, gesture deduplication, phrase correctness for all 5 gestures, and fresh detection after hand loss and return.

**Q32: What is a unit test?**
> A small, automated function that tests one specific behavior. For example: "If I feed 8 identical OPEN_PALM frames, the engine should accept it. If I feed only 5, it should NOT accept." We run all 32 tests with one command and verify they all pass.

**Q33: How do you run the tests?**
> Command: `npm run test`. This runs a Node.js script that executes all 32 tests and reports pass/fail. All 32 pass.

**Q34: Do you have a model evaluation script?**
> Yes. It generates synthetic hand landmarks for all 5 gestures, adds noise, runs them through the model, and produces a **confusion matrix** with per-class **precision, recall, and F1-score**. Command: `npm run evaluate`.

---

### Performance Questions

**Q35: How fast is the inference?**
> Neural network inference takes approximately **5 milliseconds per frame**. At 30fps, we have a budget of 33ms per frame. So inference uses only 15% of the frame budget, leaving plenty of room for rendering and other tasks.

**Q36: How big is the application?**
> Initial page load is **21KB**. The ML library (TensorFlow.js, ~1.7MB) loads lazily in the background after the page is already visible. The user sees the interface immediately while the AI loads behind the scenes.

**Q37: What is lazy loading?**
> Loading resources only when they are needed, not upfront. We don't load TensorFlow.js until the camera is ready. We don't load the training module until the user clicks "Personalize." This makes the initial page load very fast.

**Q38: How do you prevent memory leaks?**
> TensorFlow.js creates tensors (multi-dimensional arrays) for every calculation. If not cleaned up, they accumulate and crash the browser. We use `tf.tidy()` which automatically disposes all intermediate tensors after each prediction. We verified zero tensor leaks.

---

### Security and Privacy Questions

**Q39: Is the camera feed sent to any server?**
> No. The camera feed is processed entirely in the browser. MediaPipe and TensorFlow.js both run client-side. No frame, no landmark data, and no model ever leaves the user's device. This is a **privacy-first architecture**.

**Q40: What if the user denies camera permission?**
> We show a friendly error screen with the message "Camera permission was denied" and options to retry or reload. The app never crashes on permission denial.

---

### Comparison Questions

**Q41: How is this different from existing projects/tutorials?**
> Most hand gesture tutorials stop at "detect gesture, print label." Our project adds:
> 1. A decision engine with voting, gating, and cooldown (no tutorial has this)
> 2. In-browser training with model persistence (not from any tutorial)
> 3. 32 automated tests (tutorials never include tests)
> 4. Error recovery with retry logic (production-grade)
> 5. TypeScript with strict type checking (tutorials use plain JavaScript)
> 6. Performance optimization with lazy loading (tutorials load everything upfront)

**Q42: Why not use Python + OpenCV?**
> That would require: (1) a Python server running 24/7, (2) sending camera frames to the server (privacy risk), (3) server hosting costs, (4) network latency (100-500ms vs our 5ms). Our approach has zero server cost, zero latency, and complete privacy.

**Q43: Why not use a CNN (Convolutional Neural Network)?**
> CNNs work on raw images. We don't use raw images — MediaPipe already extracts the 21 landmark points for us. Our input is structured numerical data (63 numbers), not a 640×480 pixel image. For structured numerical inputs, a feedforward Dense network is more appropriate and much faster than a CNN.

---

### Tricky/Edge-Case Questions

**Q44: What if two hands are shown?**
> We configured MediaPipe for single-hand detection (maxNumHands: 1). It will track whichever hand is detected first. This simplifies the pipeline and avoids confusion.

**Q45: What if the lighting is bad?**
> MediaPipe's accuracy decreases in low light. The landmarks become noisy, which reduces classification confidence. Most frames will fall below our 65% threshold and show "Waiting for input" — the system degrades gracefully rather than giving wrong answers.

**Q46: What if the user makes a gesture not in the 5 classes?**
> The neural network will still output 5 probabilities. But for an unknown gesture, all probabilities will be low and spread out. Our 65% confidence threshold will reject it. The decision engine's 8-frame stability requirement adds another layer of protection.

**Q47: Can this work on mobile?**
> Yes, technically. MediaPipe and TensorFlow.js both support mobile browsers. The webcam would be the front camera. However, we haven't optimized the UI specifically for mobile in this version.

**Q48: What happens if the browser tab is in the background?**
> Most browsers throttle background tabs. The camera feed and processing would slow down or pause. When the user returns to the tab, everything resumes automatically.

---

### Theory Questions They Might Ask

**Q49: What is a feedforward neural network?**
> A neural network where data flows in one direction — from input to output — through hidden layers. There are no cycles or loops (unlike RNNs). Each layer is fully connected to the next. It's also called a Multi-Layer Perceptron (MLP).

**Q50: What is backpropagation?**
> The algorithm used to train neural networks. After a forward pass (prediction), we calculate the error (loss). Then we propagate this error backwards through the network, computing how much each weight contributed to the error. We then adjust the weights to reduce the error. This process repeats for each training epoch.

**Q51: What is gradient descent?**
> An optimization algorithm that minimizes the loss function by iteratively adjusting weights in the direction of steepest descent (negative gradient). Adam optimizer is an advanced version that adapts the learning rate for each parameter.

**Q52: What is overfitting?**
> When a model performs well on training data but poorly on unseen data. It has memorized the training examples instead of learning general patterns. We prevent it using dropout and validation split.

**Q53: What is a confusion matrix?**
> A table that shows predicted vs actual classes. Rows = actual class, columns = predicted class. Diagonal entries = correct predictions. Off-diagonal = mistakes. It shows which gestures get confused with which. Our evaluation script generates this.

**Q54: What is precision and recall?**
> **Precision**: Of all predictions for class X, how many were actually X? (Accuracy of positive predictions)
> **Recall**: Of all actual class X samples, how many did we correctly predict? (Completeness)
> High precision = few false positives. High recall = few false negatives.

**Q55: What is the F1 Score?**
> The harmonic mean of precision and recall: F1 = 2 × (P × R) / (P + R). It balances both metrics. Useful when you want a single number to evaluate per-class performance.

**Q56: What is an epoch?**
> One complete pass through the entire training dataset. In 50 epochs, the model sees every training sample 50 times. More epochs = more learning, but too many can cause overfitting.

**Q57: What is a batch?**
> A subset of training data processed together before updating weights. Our batch size is 32. This means we process 32 samples, compute the average loss, update weights, then move to the next 32.

**Q58: What is WebGL?**
> A browser API for GPU-accelerated graphics. TensorFlow.js uses WebGL to run matrix multiplications on the GPU instead of the CPU. This makes neural network inference fast enough for real-time (30fps).

---

## PART 9: THE DEMO SCRIPT

**Follow these exact steps during the live demo:**

1. Open the app in Chrome → "As you can see, the interface loads immediately"
2. Allow camera → "The green skeleton shows the 21 landmarks MediaPipe detects"
3. Show **Open Palm** → wait for phrase → "The AI recognized Open Palm with our voting system"
4. Show **Thumbs Up** → "Notice it says 'I am fully aligned' — and the voice reads it out"
5. Show **Peace Sign** → "Different gesture, different phrase"
6. Quickly flicker between gestures → "See how it doesn't trigger — the 8-frame voting prevents false positives"
7. Click **Personalize** → "Users can retrain the model. Let me record a few samples..."
8. Record 2-3 gestures briefly → "Each recording captures hand landmark data for supervised training"
9. Click **Dark Mode toggle** → "We also support dark mode with system preference detection"
10. Toggle **Voice Off** → "Voice can be toggled for environments where audio isn't appropriate"

**Total demo time: 3-4 minutes.**

---

## PART 10: NUMBERS TO REMEMBER

| Metric | Value |
|---|---|
| Hand landmarks | 21 points, 63 features |
| Gesture classes | 5 |
| Neural network layers | 4 (Input → 128 → 64 → 5) |
| Confidence threshold | 65% |
| Stability frames | 8 consecutive |
| Cooldown | 2.5 seconds |
| Thumb dominance ratio | 1.3× |
| Training epochs | 50 |
| Batch size | 32 |
| Learning rate | 0.001 |
| Min samples per gesture | 10 |
| Inference time | ~5ms per frame |
| Initial page load | 21KB |
| TF.js library size | ~1.7MB (lazy loaded) |
| Unit tests | 32, all passing |
| Dropout rate | 30% |
| Validation split | 20% |

---

## PART 11: WORDS YOU MUST KNOW

If a professor uses any of these words, you should be able to explain them:

| Term | Simple Explanation |
|---|---|
| Inference | Using a trained model to make predictions |
| Training | Teaching the model by showing it examples |
| Epoch | One full pass through all training data |
| Loss function | Measures how wrong the model's predictions are |
| Backpropagation | Algorithm that adjusts weights to reduce loss |
| Gradient descent | Moving weights in the direction that reduces loss |
| Overfitting | Model memorizes data instead of learning patterns |
| Dropout | Randomly disabling neurons to prevent overfitting |
| Softmax | Converts numbers into probabilities that sum to 1 |
| ReLU | max(0, x) — simple activation that avoids vanishing gradients |
| One-hot encoding | Representing categories as binary vectors |
| Tensor | A multi-dimensional array used in ML |
| Confusion matrix | Table showing correct vs incorrect predictions |
| Precision | Of positive predictions, how many were correct |
| Recall | Of actual positives, how many were found |
| F1 score | Harmonic mean of precision and recall |
| Normalization | Scaling data to a standard range |
| Landmark | A specific detected point on the hand |
| WebGL | Browser API for GPU acceleration |
| IndexedDB | Browser's local database |
| Latency | Delay between input and output |
| CDN | Server network that delivers files quickly worldwide |

---

## PART 12: RED FLAGS TO AVOID

❌ **NEVER say:**
- "I didn't do that part" — say "That module was primarily handled by [name], but from my understanding..."
- "I don't know" — say "That's an interesting question. Based on our design..."
- "We used ChatGPT" — say "We referenced TensorFlow.js documentation and Google's MediaPipe research papers"
- "It's just a website" — say "It's a client-side AI application that runs in the browser"
- "React hooks" — say "state management functions"
- "useState/useEffect" — say "React's state management API"
- Any framework-specific jargon the professor won't know

✅ **ALWAYS say:**
- "Neural network" instead of "model" (sounds more technical)
- "Client-side inference" instead of "runs in the browser"
- "Supervised learning" when talking about training
- "Cross-entropy loss" when asked about the loss function
- "We validated with 32 automated test cases"

---

**Last tip: Whoever gets asked first sets the tone. If the first person answers confidently, the panel assumes the whole team is strong. If the first person hesitates, they'll grill everyone harder. Decide who goes first and make sure that person is SOLID.**

---

## PART 13: CORE CSE / SOFTWARE ENGINEERING QUESTIONS

These are the questions old-school CS professors WILL ask. They think in terms of SDLC, ER diagrams, DFD, client-server, DBMS, OS, networking, data structures, and algorithms. You MUST be ready for these.

---

### Frontend / Backend / Architecture

**Q59: Where is the frontend and where is the backend?**
> Our project is a **frontend-only application**. There is no backend server. The entire application — including the AI model — runs inside the user's browser. The browser itself acts as both the client and the processing engine. We chose this architecture to eliminate server costs and protect user privacy.

**Q60: Why is there no backend?**
> Traditional ML applications need a backend to run the model on a server. But TensorFlow.js allows us to run the neural network directly in the browser using the GPU (via WebGL). Since our model is small (few hundred KB) and inference is fast (5ms), there's no need for a server. This is called a **serverless architecture** or **client-side architecture**.

**Q61: Explain the client-server architecture of your project.**
> In a traditional client-server model, the client (browser) sends requests to a server, and the server processes and responds. Our project modifies this:
> - **Client (Browser)**: Does everything — UI rendering, camera capture, ML inference, decision logic, speech output
> - **CDN Server (read-only)**: Serves static files — the HTML, CSS, JavaScript, and the pre-trained model file. This is like a file server, it does no processing.
> - There is **no application server** and **no database server**
>
> After the initial page load, the application works **completely offline**.

**Q62: What is the three-tier architecture? Does your project follow it?**
> Three-tier architecture = Presentation Layer + Business Logic Layer + Data Layer.
> Our project has all three, but they all run in the browser:
> - **Presentation Layer**: React components (VideoFeed, PhraseOverlay, TrainingMode)
> - **Business Logic Layer**: Gesture Decision Engine, Neural Network inference, preprocessing
> - **Data Layer**: IndexedDB for model persistence, in-memory dataset for training samples
>
> The difference from traditional three-tier is that our logic and data layers run on the client, not on a server.

**Q63: What design pattern did you use?**
> 1. **Singleton Pattern** — The gesture decision engine is a singleton (one shared instance across the app)
> 2. **Observer Pattern** — MediaPipe's onResults callback notifies our code when new hand data is available (event-driven)
> 3. **Strategy Pattern** — The model can be swapped at runtime (default model vs user-trained model) without changing the inference code
> 4. **Module Pattern** — Each file exports a clean API and hides internal state (encapsulation)

**Q64: What is MVC? How does your project relate to it?**
> MVC = Model-View-Controller.
> - **Model**: The neural network (gestureModel), decision engine state, training dataset
> - **View**: React components — VideoFeed, PhraseOverlay, TrainingMode
> - **Controller**: The useHandTracking hook — it connects the camera (input), passes data through the model, and updates the view
>
> We don't follow strict MVC, but the separation of concerns is equivalent.

---

### Software Development Life Cycle (SDLC)

**Q65: What SDLC model did you follow?**
> We followed the **Iterative / Agile model**.
> - **Iteration 1**: Basic hand detection + hardcoded gesture output
> - **Iteration 2**: Added neural network classification replacing rule-based logic
> - **Iteration 3**: Added decision engine (voting, gating, cooldown) to fix false positives
> - **Iteration 4**: Added in-browser training module and model persistence
> - **Iteration 5**: Added TypeScript, error handling, testing, and performance optimization
>
> Each iteration was a working version that was tested and improved in the next cycle.

**Q66: What are the phases of SDLC you followed?**
> 1. **Requirement Analysis** — Identified the need for real-time gesture recognition without a server
> 2. **System Design** — Designed the 4-layer architecture (Config → ML → Hooks → UI)
> 3. **Implementation** — Coded in TypeScript with React, TensorFlow.js, MediaPipe
> 4. **Testing** — 32 automated unit tests + manual testing with live webcam
> 5. **Deployment** — Deployed on Vercel (static hosting, zero server)
> 6. **Maintenance** — Iterative improvements (added decision engine, TypeScript, error recovery)

**Q67: What testing did you perform?**
> 1. **Unit Testing** — 32 automated tests on the decision engine (stability voting, cooldown, thumb gating, edge cases)
> 2. **Integration Testing** — End-to-end pipeline testing (camera → MediaPipe → model → engine → UI) manually
> 3. **Model Evaluation** — Synthetic evaluation script with confusion matrix, precision, recall, F1
> 4. **User Testing** — Tested with multiple users to verify gesture recognition accuracy
> 5. **Regression Testing** — After each change, ran all 32 tests to ensure nothing broke

---

### Data Flow Diagram (DFD)

**Q68: Draw/explain the DFD of your project.**

> **Level 0 (Context Diagram):**
> ```
> [User] → (Camera Feed) → [Corporate Signal Translator System] → (Phrase + Voice) → [User]
> ```
>
> **Level 1 DFD:**
> ```
> [User/Camera] → (Video Frame) → [1.0 Hand Detection] → (21 Landmarks) → [2.0 Preprocessing]
>       → (63 Features) → [3.0 Neural Network] → (Prediction) → [4.0 Decision Engine]
>       → (Accepted Gesture) → [5.0 Output Generator] → (Text + Speech) → [User]
>
> [User] → (Gesture Samples) → [6.0 Training Module] → (New Model) → [Model Store / IndexedDB]
> [Model Store] → (Saved Model) → [3.0 Neural Network]
> ```
>
> **Data Stores:**
> - D1: IndexedDB (saved user model)
> - D2: In-memory dataset (training samples)
> - D3: gestureConfig (labels, phrases, thresholds)

---

### ER Diagram / Database

**Q69: What database did you use?**
> We use **IndexedDB**, which is a built-in database in every modern browser. It is a **NoSQL, key-value store** that supports structured data. We use it to store the user's trained TensorFlow.js model. No external database like MySQL or MongoDB is needed.

**Q70: Draw the ER diagram.**
> Our data model is simple since we don't have a traditional database:
>
> ```
> Entity: GestureModel
>   - Key: "corporate-gesture-model" (String, Primary Key)
>   - Value: TensorFlow.js model weights (Binary)
>   - Metadata: topology, weight specs (JSON)
>
> Entity: GestureConfig (in-memory, not stored in DB)
>   - label: String (PK) — e.g., "OPEN_PALM"
>   - phrase: String — "Let's put a pin in that"
>   - gestureType: String — "open-palm"
>   - emoji: String — "✋"
>   - displayName: String — "Open Palm"
> ```
>
> Since we don't use a relational database, there are no foreign keys or relationships between tables. The config is static (hardcoded), and the model is a binary blob stored in IndexedDB.

**Q71: Why not use MySQL/MongoDB?**
> 1. We don't have user accounts or multi-user data — no need for a relational database
> 2. The only persistent data is the trained model (a binary blob) — IndexedDB handles this perfectly
> 3. Using MySQL would require a backend server, hosting, and security — unnecessary complexity
> 4. IndexedDB is built into the browser — zero setup, zero cost, works offline

---

### Data Structures and Algorithms

**Q72: What data structures did you use?**
> 1. **Array** — Stability buffer (last 8 predictions), landmark arrays (21 elements), training dataset
> 2. **Map** — Training dataset storage: `Map<string, Float32Array[]>` mapping gesture labels to arrays of feature vectors
> 3. **Float32Array** — Typed array for normalized landmark features (63 elements). More memory-efficient than regular arrays for numerical data
> 4. **Object/Record** — Configuration lookups (label → phrase, label → emoji). O(1) hash-based access
> 5. **Queue (conceptual)** — Stability buffer acts as a sliding window queue (FIFO: shift oldest, push newest)

**Q73: What algorithms did you use?**
> 1. **Backpropagation** — Core training algorithm for the neural network (computes gradients via chain rule)
> 2. **Adam Optimizer** — Gradient descent variant with adaptive learning rates
> 3. **Euclidean Distance** — Used in thumb dominance check: `sqrt(dx² + dy² + dz²)` to measure finger extension
> 4. **Sliding Window / Majority Voting** — 8-frame stability buffer to filter noise
> 5. **Fisher-Yates Shuffle** — Randomizes training data before each training run (prevents ordering bias)
> 6. **Argmax** — Finds the gesture class with highest predicted probability
> 7. **Min-Max Normalization** — Landmark coordinates normalized relative to wrist position

**Q74: What is the time complexity of inference?**
> For one frame:
> - Preprocessing (normalization): O(n) where n = 21 landmarks = O(1) constant
> - Neural network forward pass: O(63×128 + 128×64 + 64×5) = O(1) constant (fixed matrix multiplications)
> - Decision engine: O(8) for stability buffer scan = O(1) constant
> - Total: **O(1) per frame** — constant time, does not scale with any variable input
> - Actual wall-clock time: ~5 milliseconds

**Q75: What is the space complexity?**
> - Neural network weights: 63×128 + 128 + 128×64 + 64 + 64×5 + 5 = **16,709 parameters** ≈ 65KB
> - Stability buffer: 8 entries × ~20 bytes = 160 bytes
> - Training dataset: 10 samples × 5 gestures × 63 floats × 4 bytes = ~12.6KB (minimum)
> - Total runtime memory: < 1MB for all application state (excluding TF.js library itself)

---

### Operating System Concepts

**Q76: Does your project use multithreading?**
> JavaScript in the browser runs on a **single thread** (the main thread). However:
> - **WebGL operations** (used by TensorFlow.js) are offloaded to the **GPU**, which processes them in parallel
> - **MediaPipe** uses the GPU for hand detection
> - The browser's **event loop** handles asynchronous operations (camera frames, promises) without blocking the UI
>
> So while our code is single-threaded, the GPU provides parallelism for heavy computation.

**Q77: What is the event loop and how does your project use it?**
> The browser's event loop processes tasks in a queue. Our project uses it for:
> 1. Camera frames arrive as callbacks → added to the event queue
> 2. Neural network inference is synchronous (~5ms) → runs on the main thread
> 3. Speech synthesis is asynchronous → browser handles it in the background
> 4. Model training uses async/await → yields control between epochs so the UI doesn't freeze
>
> This is similar to how an OS scheduler manages processes, but at the browser level.

**Q78: How does your project handle concurrency?**
> We use **asynchronous programming** with Promises and async/await:
> - Model loading is async (doesn't block the UI)
> - Camera initialization is async
> - Model training is async (with progress callbacks)
> - We prevent race conditions using:
>   - Module-scoped flags (`isLoading`) to prevent duplicate model loads
>   - `useRef` for mutable state that shouldn't trigger re-renders
>   - Cleanup functions in useEffect to prevent memory leaks on component unmount

**Q79: How does your project manage memory?**
> 1. **TensorFlow.js tensors**: We use `tf.tidy()` which automatically disposes all intermediate tensors after each computation — similar to garbage collection
> 2. **Model disposal**: When swapping models, the old model is explicitly disposed with `model.dispose()` — frees GPU memory
> 3. **Event listener cleanup**: All event listeners (camera, resize, voice) are removed when the component unmounts
> 4. **JavaScript Garbage Collection**: The V8 engine handles regular JS object cleanup automatically (mark-and-sweep algorithm)

---

### Networking

**Q80: What protocols does your project use?**
> 1. **HTTPS** — The app is served over HTTPS (required for camera access in modern browsers)
> 2. **HTTP/2** — Static files are served from Vercel's CDN with HTTP/2 for faster parallel downloads
> 3. **WebRTC (getUserMedia)** — Browser API used to access the webcam (part of the WebRTC specification)
> 4. No WebSocket, no REST API, no GraphQL — because we have no backend server

**Q81: What is a CDN and how do you use it?**
> CDN = Content Delivery Network. It's a network of servers worldwide that cache files closer to the user.
> - We load **MediaPipe** from jsDelivr CDN (Google's open-source CDN)
> - The CDN serves the hand detection model files and JavaScript library
> - Benefit: faster download because the file comes from a server geographically close to the user
> - We added **timeout (15 seconds) + 2 retries** in case the CDN is slow or unreachable

**Q82: What happens if there is no internet?**
> - **First visit**: Internet is required to download the app and MediaPipe library
> - **Subsequent visits**: The browser caches everything. If a service worker is added, the app can work fully offline
> - **Model persistence**: The user's trained model is in IndexedDB (local), so it survives offline. Only the default model needs the initial download

---

### Software Engineering

**Q83: What is cohesion and coupling in your project?**
> - **High Cohesion**: Each module does ONE thing well. `gestureModel.ts` only handles model loading and inference. `gestureDecisionEngine.ts` only handles post-processing. `gestureTrainer.ts` only handles training. They don't mix responsibilities.
> - **Low Coupling**: Modules communicate through well-defined interfaces. The decision engine doesn't know about React. The UI doesn't know about TensorFlow internals. The config module is the only shared dependency. Changing one module doesn't break another.

**Q84: How did you handle error handling?**
> 1. **ErrorBoundary component** — catches any uncaught runtime error in the UI and shows a recovery screen instead of a blank page
> 2. **CDN retry logic** — if MediaPipe fails to load, automatically retries 2 times with 15-second timeout
> 3. **Model load fallback** — if user model in IndexedDB is corrupt, falls back to default model
> 4. **Camera denial handling** — if user denies camera permission, shows a clear error message
> 5. **TTS error handling** — if speech synthesis fails, errors are caught and logged without crashing the app
> 6. **Training failure handling** — if model training fails, shows error message with suggestion to record more samples

**Q85: What is the difference between functional and non-functional requirements?**
> **Functional Requirements** (what the system DOES):
> 1. Detect hand gestures from webcam in real-time
> 2. Classify gestures into 5 categories
> 3. Display corresponding corporate phrase
> 4. Speak the phrase aloud
> 5. Allow users to train custom gestures
> 6. Save trained model locally
>
> **Non-Functional Requirements** (HOW the system performs):
> 1. Inference time < 33ms per frame (real-time at 30fps)
> 2. Initial page load < 100KB
> 3. Works on Chrome, Edge, Firefox
> 4. No server dependency after first load
> 5. User data never leaves the device (privacy)
> 6. Graceful error recovery (no blank screens)

**Q86: Draw the UML Use Case Diagram.**
> ```
> Actor: User
>
> Use Cases:
> ┌─────────────────────────────────────────┐
> │        Corporate Signal Translator      │
> │                                         │
> │  (1) View Live Camera Feed              │
> │  (2) Perform Hand Gesture               │
> │  (3) See Translated Phrase              │
> │  (4) Hear Phrase via Voice              │
> │  (5) Toggle Voice On/Off               │
> │  (6) Toggle Dark Mode                  │
> │  (7) Open Training Module              │
> │  (8) Record Gesture Samples            │
> │  (9) Train Custom Model                │
> │  (10) Reset Personalization            │
> │  (11) Reset Application                │
> └─────────────────────────────────────────┘
>
> User ──→ all use cases
> Use case (8) «includes» (7)
> Use case (9) «includes» (8)
> Use case (3) «includes» (2)
> Use case (4) «includes» (3)
> ```

**Q87: Draw the UML Class Diagram (simplified).**
> ```
> ┌─────────────────────────┐
> │   GestureDecisionEngine │
> ├─────────────────────────┤
> │ - stabilityBuffer[]     │
> │ - acceptedGesture       │
> │ - acceptedTimestamp      │
> │ - inCooldown            │
> ├─────────────────────────┤
> │ + processFrame()        │
> │ + onHandDisappear()     │
> │ + reset()               │
> │ - _validateThumbDominance() │
> │ - _updateStabilityBuffer()  │
> │ - _isInCooldown()       │
> │ - _applyDecisionGates() │
> └─────────────────────────┘
>         ▲ uses
>         │
> ┌───────────────────┐     ┌──────────────────┐
> │   GestureModel    │     │  GestureTrainer   │
> ├───────────────────┤     ├──────────────────┤
> │ - cachedModel     │     │ - dataset: Map   │
> │ - isUserModel     │     │ - EPOCHS: 50     │
> ├───────────────────┤     ├──────────────────┤
> │ + loadModel()     │     │ + addSample()    │
> │ + predictGesture()│     │ + trainModel()   │
> │ + swapModel()     │     │ + canTrain()     │
> │ + resetToDefault()│     │ + clearDataset() │
> └───────────────────┘     └──────────────────┘
>         ▲ uses                    ▲ uses
>         │                        │
> ┌───────────────────┐     ┌──────────────────┐
> │ LocalModelManager │     │  GestureConfig   │
> ├───────────────────┤     ├──────────────────┤
> │ - MODEL_KEY       │     │ + GESTURE_LABELS │
> ├───────────────────┤     │ + LABEL_TO_PHRASE│
> │ + loadUserModel() │     │ + NUM_CLASSES    │
> │ + saveUserModel() │     │ + INPUT_FEATURES │
> │ + clearUserModel()│     └──────────────────┘
> │ + hasUserModel()  │
> └───────────────────┘
> ```

**Q88: What is the sequence of events when a user shows a gesture? (UML Sequence Diagram)**
> ```
> User    Camera    MediaPipe    GestureModel    DecisionEngine    UI
>  │        │          │             │                │            │
>  │──show──▶│          │             │                │            │
>  │        │──frame──▶│             │                │            │
>  │        │          │──landmarks──▶│               │            │
>  │        │          │             │──prediction───▶│            │
>  │        │          │             │                │──accepted──▶│
>  │        │          │             │                │            │──phrase──▶User
>  │        │          │             │                │            │──voice──▶User
> ```
> This happens **30 times per second**. Most frames result in "not accepted" (filtered by voting/cooldown). Only stable gestures reach the UI.

---

### Security

**Q89: What security measures did you implement?**
> 1. **No data transmission** — Camera feed and gesture data never leave the browser. No server = no data breach possibility
> 2. **HTTPS only** — Browser requires HTTPS for camera access (prevents man-in-the-middle attacks on the video stream)
> 3. **Camera permission** — Browser enforces explicit user consent before camera access
> 4. **No authentication needed** — No user accounts, no passwords to leak
> 5. **CDN integrity** — Scripts loaded from CDN with crossOrigin attribute
> 6. **Input validation** — Landmark arrays validated (must be exactly 21 points) before processing. Prevents malformed data from reaching the neural network

**Q90: What if someone tampers with the model file?**
> The default model is served from our deployment as a static file. If someone replaced it, the model would either fail to load (triggering our error boundary) or produce incorrect predictions (which the 65% confidence threshold and 8-frame voting would likely reject). The user's personalized model in IndexedDB is protected by the browser's same-origin policy — only our domain can access it.

---

### Miscellaneous CSE Questions

**Q91: What is the difference between AI, ML, and Deep Learning?**
> - **AI**: Any system that mimics human intelligence (broad term)
> - **ML**: A subset of AI where systems learn from data instead of being explicitly programmed
> - **Deep Learning**: A subset of ML that uses neural networks with multiple layers
> Our project uses **ML** (specifically a shallow neural network with 2 hidden layers). It's not deep learning since we don't use CNNs, RNNs, or networks with many layers.

**Q92: What is supervised learning? Is your project supervised?**
> **Supervised learning** = training a model with labeled data (input + correct answer pairs). Yes, our project uses supervised learning:
> - Input: 63 landmark features
> - Label: gesture name (OPEN_PALM, THUMBS_UP, etc.)
> - The model learns to map inputs to correct labels during training
> - Both the default model and the user-trained model use supervised learning

**Q93: What is the difference between classification and regression?**
> - **Classification**: Predicting a category/class (discrete output). Example: "This is THUMBS_UP"
> - **Regression**: Predicting a continuous number. Example: "The temperature will be 35.7°C"
> Our project does **multi-class classification** — classifying input into one of 5 discrete gesture classes.

**Q94: What is cross-validation?**
> Splitting data into training and validation sets to evaluate model performance. We use a **80/20 validation split** — 80% of samples for training, 20% for validation. TensorFlow.js reports validation accuracy after each epoch so we can monitor if the model is overfitting.

**Q95: Explain how deployment works.**
> 1. We run `npm run build` — this compiles TypeScript to JavaScript, bundles all files, and optimizes them
> 2. The output goes to a `dist/` folder — just static HTML, CSS, and JS files
> 3. We upload to **Vercel** (a static hosting platform, like a CDN)
> 4. Vercel assigns a URL (e.g., corporate-hand-translator.vercel.app)
> 5. Users visit the URL in their browser — no installation needed
> 6. The browser downloads the files, runs the JavaScript, and the app starts
> 7. No Docker, no server configuration, no database setup — it's just static files

---

## PART 14: DIAGRAMS TO DRAW ON THE BOARD

If a professor says "draw the architecture" or "show me the flow", draw ONE of these. Practice drawing each one in under 60 seconds.

### Diagram 1: System Architecture (Most Important)
```
┌─────────────────── Browser (Client) ───────────────────┐
│                                                         │
│  ┌─────────┐   ┌──────────┐   ┌──────────┐            │
│  │ Camera  │──▶│MediaPipe │──▶│ Neural   │            │
│  │ (WebRTC)│   │(21 pts)  │   │ Network  │            │
│  └─────────┘   └──────────┘   └────┬─────┘            │
│                                     │                   │
│                              ┌──────▼──────┐           │
│                              │  Decision   │           │
│                              │  Engine     │           │
│                              └──────┬──────┘           │
│                                     │                   │
│                    ┌────────────────┼────────────┐     │
│                    │                │            │     │
│               ┌────▼───┐     ┌─────▼──┐  ┌─────▼──┐  │
│               │ Display│     │ Voice  │  │IndexedDB│  │
│               │ (React)│     │ (TTS)  │  │(Model) │  │
│               └────────┘     └────────┘  └────────┘  │
│                                                       │
└───────────────────────────────────────────────────────┘
         ▲ First load only
         │
    ┌────┴────┐
    │  CDN    │ (static files + MediaPipe)
    └─────────┘
```

### Diagram 2: Neural Network (For ML Questions)
```
Input (63)    Hidden 1 (128)    Dropout    Hidden 2 (64)    Output (5)
  ○              ○                           ○               ○ Open Palm
  ○              ○                           ○               ○ Closed Fist
  ○    ───▶      ○      ───▶    30%  ───▶   ○     ───▶     ○ Thumbs Up
  ○              ○              drop         ○               ○ Pointing Up
  ...            ...                         ...             ○ Peace Sign

        ReLU activation          ReLU activation     Softmax activation
```

### Diagram 3: Data Flow (For DFD Questions)
```
Camera Frame ──▶ MediaPipe ──▶ 21 Landmarks ──▶ Normalize ──▶ 63 Features
                                                                    │
                                                              ┌─────▼─────┐
                                                              │  Model    │
                                                              │ Predict   │
                                                              └─────┬─────┘
                                                                    │
              User ◀── Voice ◀── Phrase ◀── Accept ◀── Voting ◀────┘
```

### Diagram 4: Training Flow (For ML Questions)
```
User holds gesture ──▶ Capture landmarks (3 sec) ──▶ Normalize to 63 features
                                                              │
                                                     Store in dataset Map
                                                              │
                                                  (repeat for 5 gestures)
                                                              │
                                                    ┌─────────▼─────────┐
                                                    │  Build new model  │
                                                    │  Train 50 epochs  │
                                                    └─────────┬─────────┘
                                                              │
                                                    ┌─────────▼─────────┐
                                                    │  Save to IndexedDB│
                                                    │  Hot-swap model   │
                                                    └───────────────────┘
```

---

Good luck. You've got a great project. Own it. 💪
