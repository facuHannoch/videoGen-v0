# Generate videos from with a standard format

Goal: produce information and value-contained videos in an scalable and automated manner.

This could provide a low-intensity but steady source of traffic and authority for the channel. If the videos are correctly produced, then the information could still be provided, and thus the videos be valuable to people.

Flow:

1. Initial information or raw resources, such as content, idea definition, prompts for generation, etc, is generated.
    - Components involved. `scriptGen`: takes a prompt file, allows string interpolation
    - Resources used:
        - prompt
    - Generated resources: `content.json`
2. Resources are created. 
    - Components involved: `resourcesGen`
    - Resources used:
        - resources generation context prompt
    - Generated resources: `generated.resources.json`
3. Resources are organized and used to build the script
    - Components involved: `audioScriptGen`
    - Resources used:
        - xml reference file
    - Generated resources: `script.xml`
4. The audio is generated. Components involved: `audioGen`
    - Components involved: `scriptGen`
    - Generated resources: 
        - `audios/`
        - `audio.info.json`
5. Video edition process: We need a way to make use of the generated resources, but also a way to render and edit the video. There are at least 3 steps: 1) bring back resources; 2) make editing; 3) render video (TBI)
    - Components involved: 
        - `videoEditorWorker`: The AI part of this step. Takes the resources and modifies the editor files themselves. Note: Currently this component its just a script that overrides the given file. To make this more inteliggent and allow it to further create / modify, it should trascend this script-state.
            Generates
                - `timeline.json`
                - `compositionXX.tsx`
        - `remotion-video-editor`: library to actually make the video and eventually render it. Uses the `remotion` library.
    - Resources used
        1. content.json
        2. generated.resources.json
        3. script.xml
        4. audios/, audio.info.json
        ?. timeline.json: 
        - video editing context: a file the videoEditorWorker has as additional context or instructions to provide the videoEditorWorker
    - Generated resources: `video.out`

Subsequent steps (not implemented, and not a priority)
6. render video (needs UI or a way to easily do HITM if necessary)
7. Submit video
    1. To Storage service
    2. To target platform / platforms
8. Analytics

Common resources: As the goal is to produce videos in an standard format, this is very suitable for series of videos. So a single prompt and reference file will be suitable for a full series of videos.

Organization

`projects`: Directory that contains the generated resources. Its structure is as follows:
```
/
    CATEGORY/
        _common/
            promptXX.txt
            reference-script-XXX.xml
            video-making-context.txt
        SPECIFIC_CONTENT/
            en/
                1-raw-content/
                2-resources/
                3-script/
                4-audios/
                5-videos/
```

This means that the library works always on a project, and each 



- `bashis.sh`: shell script that executes this in sequence.


---

All steps make use of AI to allow for flexible and idea-guided videos, instead of following a strict process.
This will mean that the process is not 100% deterministic. Specially in step 2, this could imply the need for a HITM approach, where the generation can be easily reviewed and then the user could approve / reject the resources generated.





# Usage

1. Define word and category
2. Create prompt

Define variables and things that should mapped