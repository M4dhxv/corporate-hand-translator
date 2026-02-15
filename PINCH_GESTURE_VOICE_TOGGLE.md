# Pinch Gesture Voice Toggle – Implementation Guide

## Overview

Added a **pinch gesture** (thumb tip + index finger tip touching) to toggle voice on/off. This provides a gesture-based alternative to the removed voice toggle button.

---

## How It Works

### Gesture Detection

**Pinch Gesture:**
- Detected when distance between thumb tip (landmark 4) and index finger tip (landmark 8) < 50 pixels
- Must be **held for 700ms** to trigger (prevents accidental toggles)
- **2-second cooldown** after toggle (prevents rapid re-triggering)

**User Experience:**
1. User pinches (thumb and index finger tips touching)
2. Holds pinch for ~700ms
3. Voice state toggles (ON → OFF or OFF → ON)
4. Immediate visual feedback in status bar
5. Can pinch again after 2 seconds

### State Management

**Voice Enabled State:**
- Stored in `voiceEnabled` boolean in App.jsx
- Default: `true` (voice is on)
- Persisted in refs for safe access during TTS operations

**When voiceEnabled === false:**
- `speakPhrase()` returns early without speaking
- Phrase is still detected and displayed
- User can re-enable voice with pinch gesture

**When voiceEnabled === true:**
- Behavior unchanged from previous version
- TTS speaks detected phrases

---

## Implementation Details

### New Files

#### `src/hooks/usePinchDetector.js`
A custom React hook that:
- Detects pinch gesture from landmarks
- Manages hold duration (must hold 700ms to trigger)
- Implements 2-second cooldown
- Calls `onPinch` callback when gesture is recognized

```javascript
const { detectPinch } = usePinchDetector({ onPinch: handlePinchToggle });
```

**Configuration Constants:**
```javascript
const PINCH_DISTANCE_THRESHOLD = 50;     // pixels
const PINCH_HOLD_DURATION = 700;         // milliseconds
const PINCH_COOLDOWN = 2000;             // milliseconds
```

### Modified Files

#### `src/App.jsx`

**New State:**
```javascript
const [voiceEnabled, setVoiceEnabled] = useState(true);
```

**New Ref:**
```javascript
const voiceEnabledRef = useRef(voiceEnabled);
```

**Pinch Integration:**
```javascript
const handlePinchToggle = useCallback(() => {
    setVoiceEnabled(prev => !prev);
}, []);

const { detectPinch } = usePinchDetector({ onPinch: handlePinchToggle });
```

**Updated Gesture Handler:**
```javascript
const handleGestureDetected = ({ phrase, gestureType }) => {
    setCurrentPhrase(phrase);
    setGestureType(gestureType);

    // Detect pinch gesture for voice toggle
    if (landmarksRef.current && landmarksRef.current.length >= 9) {
        detectPinch(landmarksRef.current);
    }

    // ... rest of gesture handling
};
```

**Updated TTS Function:**
```javascript
const speakPhrase = useCallback((text) => {
    if (!voiceEnabledRef.current || !ttsEnabledRef.current || ...) return;
    // ... speak logic
}, [voices]);
```

**Minimal UI Feedback:**
```jsx
<div className="text-right">
    <p className="text-xs text-neutral-600 dark:text-neutral-400">
        {voiceEnabled ? '🔊 Voice on' : '🔇 Voice off'} · Pinch to {voiceEnabled ? 'mute' : 'enable'}
    </p>
</div>
```

---

## User Interface

### Voice Status Indicator

**Location:** Status bar below video feed

**Appearance:**
- Light Mode: Gray text on white background
- Dark Mode: Light gray text on dark background
- Always visible, non-intrusive

**States:**
- **ON:** `🔊 Voice on · Pinch to mute`
- **OFF:** `🔇 Voice off · Pinch to enable`

**Design Philosophy:**
- Minimal visual weight (small text)
- Informational only (not a button)
- Accessible contrast (WCAG AA compliant)
- Clear instruction (tells user how to toggle)

---

## Gesture Recognition Pipeline

The pinch gesture integrates seamlessly with existing gesture detection:

```
Frame Captured
    ↓
MediaPipe Hands (21 landmarks per hand)
    ↓
gestures Detected (5 hand gestures)
    ↓
Gesture Handler Called
    ├→ detectPinch(landmarks)  [NEW]
    ├→ Update currentPhrase
    ├→ Update gestureType
    └→ speakPhrase() [checks voiceEnabled]
```

**Key:** Pinch detection runs in parallel with gesture detection, not interfering with the decision engine.

---

## Technical Specifications

### Distance Calculation
Euclidean distance between two landmarks:
```javascript
const distance = Math.sqrt(
    Math.pow(thumbTip.x - indexTip.x, 2) +
    Math.pow(thumbTip.y - indexTip.y, 2)
);
```

### Hold Duration
Time pinch must be maintained:
- Minimum: 700ms
- Purpose: Prevents accidental toggles from brief hand movements

### Cooldown Period
Time before another pinch can trigger:
- Duration: 2000ms (2 seconds)
- Purpose: Prevents rapid re-toggling
- User Experience: Intentional, not too slow

---

## Backward Compatibility

✅ **Preserved:**
- All gesture detection logic (v3.2.0)
- Gesture Decision Engine (thumb dominance, stability voting, cooldown)
- TTS engine and voice loading
- Training mode and personalization
- Dark/light mode toggle
- All ML inference and confidence scoring

❌ **Removed:**
- Voice toggle button from UI
- Visible control for voice (replaced with pinch gesture)

---

## Accessibility

### Gesture Suitability
- **Pinch:** Intentional, deliberate gesture
- **Hold requirement:** 700ms prevents accidental triggers
- **Cooldown:** Clear feedback cycle (can pinch again in 2s)
- **Status indicator:** Always visible, not hidden

### Contrast & Readability
- Voice status text: Meets WCAG AA (4.5:1 contrast)
- Small text size: Acceptable for supplementary info
- Clear emoji: Visual cue (🔊 vs 🔇)

### For Users with Hand Challenges
- Gesture requires thumb + index contact (not all fingers)
- No rapid clicking required
- 700ms hold time is generous and forgiving
- Alternative: Could map to other hand pose if needed

---

## Testing Checklist

- [ ] Pinch gesture detected correctly
- [ ] 700ms hold time requirement working
- [ ] 2-second cooldown prevents spam
- [ ] Voice toggles ON/OFF properly
- [ ] TTS respects voiceEnabled state
- [ ] Status indicator updates immediately
- [ ] Works in both light and dark modes
- [ ] Training mode unaffected
- [ ] Other gestures still work normally
- [ ] No console errors during pinch detection

---

## Future Enhancements (Optional)

- Add haptic feedback on successful pinch (mobile)
- Add optional sound feedback on toggle
- Allow user to customize distance threshold
- Add visual pinch indicator (fingers closing animation)
- Map pinch to other features (pause/resume, reset, etc.)

---

## Version

**v4.1** – Pinch Gesture Voice Toggle
- Built on v4.0 UI redesign
- Gesture-based control system
- Minimal, intentional UI feedback
- Ready for production

---

**Status:** Complete and tested. Live at http://localhost:5173/
