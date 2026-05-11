# IPA Coach — Video V2 Build Context

## What is IPA Coach
A gamified English pronunciation app. The core method: instead of repeating words blindly, the user learns the IPA (International Phonetic Alphabet) sound system first — 43 phonemes — and then can decode any English word. The app has a structured mission-based program, a word practice tool at `/en/practice/[word]`, and a rehearsal tool for scripts.

## What are these videos
Short-form vertical videos (9:16) posted on YouTube Shorts, TikTok, and Instagram. Each video targets one English word. The goal is twofold: rank on YouTube search for "how to pronounce [word]" and funnel viewers to the word's practice page at `ipacoach.com/[word]` where they can record themselves and get instant pronunciation feedback.

## Why we are rebuilding the format
The original videos had ~20% retention after 3 seconds. The format was essentially a slideshow: TTS voice, static text cards, anatomy diagrams, shutter sound transitions. No visual identity, no personality, no reason to stay.

## The new format concept
The video is framed as a "video within a video." A robot character introduces the word, then the camera zooms into an LED screen which fills most of the frame and contains the actual educational content. The robot occasionally interrupts the screen content via a glitch pause effect to prompt the viewer to practice. At the end the camera zooms back out, the robot reappears, and the screen shows the actual practice page on the website.

---

## The robot character
A 3D animated robot with a rectangular screen for a head displaying `/ə/`. Navy and white color scheme. Moves on wheels. Has a distinct voice (Andrew, male TTS) separate from the educational content voice (Ava, female TTS). The robot is the host and director of the video — it controls the pace, triggers the glitch pauses, and delivers the CTA. It does not explain phonemes — that is Ava's role.

The robot was generated with an AI image model. Animation is done with Higgsfield AI.

---

## Scene structure

### Snapshot 1 — Opening
Robot left of center, LED screen upper right angled slightly left toward the robot. Both fully visible. Light grey dot grid background.

### Transition 1 (~3 seconds)
Robot walks in a circular arc to the right and slightly back, getting smaller. Camera moves inversely to the left. Screen drifts toward center and appears larger. Covers the hook line.

### Snapshot 2 — Pre-zoom
Robot small, to the right of the screen, slightly behind it. Screen near center, facing forward, no tilt. Clear horizontal space between robot and screen edge so the zoom naturally drops the robot out of frame.

### Transition 2 (~1 second)
Camera zooms into the screen smoothly. Robot disappears from frame. Controlled, fluid movement.

### Snapshot 3 — Screen fills frame (main content)
Screen occupies almost all horizontal space. Very narrow strip of background visible on left and right edges. Significant vertical space above and below the screen. Robot fully out of frame. This is the static camera position for the entire phoneme explanation and putting it together sections.

### Transition 3 (~2 seconds)
Final glitch effect on screen signals end of content. Camera zooms out and moves slightly left, mirroring transition 1 inversely. Robot re-enters frame from the right.

### Snapshot 4 — CTA
Screen prominent but no longer dominant, angled slightly right. Robot visible to the right of the screen. Screen shows a browser recording of `ipacoach.com/[word]` loading and the practice session starting.

---

## Script structure (abstract format)

```
## HOOK
Scene: Snapshot 1 → Transition 1 → Snapshot 2
> robot: Can you pronounce [word] correctly?

Scene: Transition 2 → Snapshot 3
> robot: First, try it!

Scene: Glitch effect on screen only. Background normal.
"[word]" appears on screen after ~0.5s delay.
> (3-second pause) -> [word] shown on screen, no audio
> ava: [word] -> slow, clear
> robot: Let's look at each phoneme.

## PHONEMES EXPLANATION
START LOOP (for each phoneme)
Scene: Screen shows "Sound /[phoneme]/" at top, diagram image below.
> ava: [phoneme articulation explanation]
> robot: [try it variation]
> (2-second pause) -> glitch effect on screen only
> ava: [word 1], [word 2], [word 3] -> slow
END LOOP

## PUTTING IT TOGETHER
> robot: Now say the full word.
> (2-second pause) -> glitch effect on screen only
> ava: [word] -> slow
> robot: Now say it within a sentence:
> (3-second pause) -> glitch effect on screen only
> ava: [sentence] -> slow

## CTA
Scene: Transition 3 → Snapshot 4
> robot: Now do it for real!
Scene: Screen shows browser recording of ipacoach.com/[word]
> robot: Practice [word] with instant feedback — completely free.
```

---

## Audio setup
Custom TTS pipeline using Azure Neural HD voices via a custom XML format. Two voices:
- **Andrew** (`en-US-Andrew:DragonHDLatestNeural`) — the robot. Energetic, slightly faster rate (+15%). Short lines only.
- **Ava** (`en-US-Ava:DragonHDLatestNeural`) — the educational content. Measured pace (+10% for explanations, slow for words and sentences).

Pauses during glitch effects are silence gaps in the audio, not TTS. The pipeline outputs each `<speak>` block as a separate audio file, which Remotion assembles on a timeline.

---

## Remotion composition
The video is built in Remotion. The pipeline is already established for the previous format. Key things being added or changed for V2:

**New layers:**
- AI video layer (Higgsfield clips for transitions and snapshots with the robot)
- Screen content layer (Remotion-rendered text and images overlaid on the screen area)
- Glitch effect layer (screen only, not full frame)
- Subtitle layer (bottom of frame)
- Phoneme indicator layer (top of frame, shows "Sound /[phoneme]/")

**Text overlay on moving screen:**
During transitions the screen moves. For slow predictable zoom movements, Remotion's `interpolate()` function is used to match the text overlay position and scale to the screen's movement frame by frame. Start position, end position, and duration are keyframed manually after observing the AI video clip. This is an approximation — works for slow linear movement, not for complex camera paths.

To avoid tracking complexity: screen text overlays are only active during static camera moments (Snapshot 3). During transitions the screen either shows nothing or a neutral state.

**Glitch effect:**
Applied to the screen layer only during practice pauses. Background remains normal. Signals to the viewer that they should practice the sound or word. Transitions out with a resume sound effect and a quick visual snap back to normal.

**Per-word variables:**
- Word text and IPA transcription
- Phoneme breakdown (list of phonemes, each with articulation explanation and example words)
- Practice sentence
- Practice page URL (`ipacoach.com/[word]`)

These are loaded from a `content.json` file, same pattern as the existing pipeline.

---

## What still needs to be built
- AI video clips (Higgsfield): Transition 1, Transition 2, Snapshot 3 background, Transition 3 + Snapshot 4
- Glitch effect component in Remotion (screen only)
- Updated Remotion composition wiring all layers together
- Screen content components (phoneme indicator, word display, example words, diagram)
- Browser recording of `ipacoach.com/mom` for the CTA scene
- Test render with "mom" as the first word
