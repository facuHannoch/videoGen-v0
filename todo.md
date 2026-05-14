- [x] only promote to done.jsonl if it completed all the steps
- [ ] allowing to pass commands to specific steps. Like generating the audio unified (this could affect steps that follow so should be reviewed carefully)

# #6 std-v2

## 0.2

- [ ] Make it shorter and more dynamic
    - [ ] Make b-rolls shorter
    - [ ] Add more scenes
- [ ] Add Text that accompanies what the robot says, like "learn how to pronounce", "try it", etc.
- [ ] Add things behind the main scene, like there is something happening, maybe it could be like different robots teaching, or just things moving or other robots moving things
- [ ] Add a second thing, like
    - Static photo of a person
    - Minecraft gameplay
    - Subway surfers gameplay
    - 

# Things

## Video 

Have a text about weak and strong forms (for example, the word `and` is pronounced as `ænd` in isolation, but as `ən` in the weak form )

Incite users to comment a word they would like used

Instead of "Try this word for free" at the end, show a screen recording, maybe animated with the practice word screen, and tell something like "practice this word for free now by going to the link in the comments"

---

- Add render video step, output to `_projects/PROJECT`

- Options to upload:
    - Cloud Storage
    - Send via Tailscale



States: +"uploaded"



Per-project Remotion feasibility — yes, feasible. The approach would be: copy remotion-video-editor/ into 5-videos/editor/ per project, then render from there. The expensive part (node_modules) can be a symlink to the shared install to avoid gigabytes of duplication. It would isolate the workspace entirely and make async rendering safe. Not complex to implement when the time comes.

