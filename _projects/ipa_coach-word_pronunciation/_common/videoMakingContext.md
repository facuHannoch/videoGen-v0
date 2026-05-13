We are making this video


The first 4 elements of the timeline are these. Change the audioId to the corresponding one, but keep the structure as it is.

```
  {
    "type": "audio",
    "audioId": "01_can_you_pronounce_mom_correctly.wav"
  },
  {
    "type": "gap",
    "durationSeconds": 3
  },
  {
    "type": "sfx",
    "soundId": "clock-ticking/down-soft.mp3",
    "durationSeconds": 3,
    "id": "clock_ticking"
  },
  {
    "type": "audio",
    "audioId": "03_mom.wav"
  },
  ...
```

Then, it continues as expected (use the provided files to understand).

Also, after the sentence is said, there is a 1 second gap, before the next section (CTA). Like this:

```
  ...
  {
    "type": "audio",
    "audioId": "17_my_.wav"
  },
  {
    "type": "gap",
    "durationSeconds": 1
  },
  {
    "type": "audio",
    "audioId": "18_now.wav"
  },
```



---



DO NOT USE 02_first-_try_it.wav AUDIO WITHIN THE TIMELINE.
DO NOT USE 02_first-_try_it.wav AUDIO WITHIN THE TIMELINE.
DO NOT USE 02_first-_try_it.wav AUDIO WITHIN THE TIMELINE.
DO NOT USE 02_first-_try_it.wav AUDIO WITHIN THE TIMELINE.
DO NOT USE 02_first-_try_it.wav AUDIO WITHIN THE TIMELINE.
DO NOT USE 02_first-_try_it.wav AUDIO WITHIN THE TIMELINE.
DO NOT USE 02_first-_try_it.wav AUDIO WITHIN THE TIMELINE.
DO NOT USE 02_first-_try_it.wav AUDIO WITHIN THE TIMELINE.
DO NOT USE 02_first-_try_it.wav AUDIO WITHIN THE TIMELINE.
DO NOT USE 02_first-_try_it.wav AUDIO WITHIN THE TIMELINE.

```
## HOOK

> robot: Can you pronounce [word] correctly?
> (3-second pause) -> [word] shown on screen, no audio
> ava: [word] -> slow, clear -> reveal
> robot: Let's look at each phoneme.

## PHONEMES EXPLANATION

START LOOP (for each phoneme)
> ava: [phoneme articulation explanation]
> robot: [try it variation] -> variations: "Try it!", "Now try it!", "Say it!", "Try it yourself!"
> (2-second pause) -> glitch effect on screen only, [phoneme] shown
> ava: [word 1], [word 2], [word 3] -> slow
END LOOP

> robot: Now say the full word.
> (2-second pause) -> glitch effect on screen only, [word] shown
> ava: [word] -> slow
> robot: Now say it within a sentence:
> (3-second pause) -> glitch effect on screen only, sentence shown
> ava: [sentence] -> slow

> robot: Now do it for real!
> robot: Practice [word] with instant feedback — completely free.
```


Note that the timeline is like this

1. audio - robot: Can you pronounce [word] correctly?
2. gap - (3s)
3. sfx - clock ticking sound (3s)
4. audios - Ava: [word]
5. 

Respect this when making the timeline. DO NOT ADD ANY AUDIOS BETWEEN 1 AND 4, EVEN IF THERE IS OTHER AUDIO MISSING.