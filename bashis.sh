#!/bin/bash

# Load variables from .env file
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt


category=ipa_coach-word_pronunciation

word="Wednesday"
ipaTranscription="/ˈwɛnz.deɪ/"

content=${word// /-}
lang=en
# between
# thought

# content=linkedin
# ipaTranscription=/ˌlɪŋktˈɪn/

projectPath=_projects/$category/$content/$lang
videoEditorSrcDir=remotion-video-editor/src
videoEditorAssetsDir=remotion-video-editor/public


mkdir -p $projectPath
mkdir -p $projectPath/1-raw-content
mkdir -p $projectPath/2-resources
mkdir -p $projectPath/3-script
mkdir -p $projectPath/4-audios

promptPath=_projects/$category/_common/prompt.txt
resourcesGenerationContext=_projects/$category/_common/resourcesGenerationContext.md
xmlReferencePath=_projects/$category/_common/reference-$lang.xml
videoEditionContext=_projects/$category/_common/videoMakingContext.md


echo " \t ----- $category, $content, $lang ----- "



######## Step 1
echo "--- \n Step 1 - Raw content creation \n---"

python3 scriptGen/index.py -o $projectPath/1-raw-content/content.json --template $promptPath --map PHONEME_HERE=$content --map TARGET_LANGUAGE=$lang --map WORD=$content  --map IPA_TRANSCRIPTION="$ipaTranscription"




######## Step 2
echo "\n--- \n Step 2 - Resources creation \n---"

python3 resourcesGen/index.py --input $projectPath/1-raw-content/content.json --assets-dir $projectPath/2-resources/assets/ --output $projectPath/2-resources/generated.resources.json --image-aspect-ratio 1:1 --context $resourcesGenerationContext


######## Step 3
echo "\n--- \n Step 3 - Audio Script creationg\n---"

python3 audioScriptGen/index.py --input $projectPath/1-raw-content/content.json --reference $xmlReferencePath --output $projectPath/3-script/script.xml



######################################
# Generate audio
# Takes the script, generates the audio by pieces and a unified audio metadata, and copies that to public/audios in the editor


echo "--- \n Step 4 - Synthetic audio generation \n---"
# ---
# Remove previous audios, and move the current ones to a -prev directory

rm -r $projectPath/4-audios/audios-prev
rm $projectPath/4-audios/audio-prev.info.json

mv $projectPath/4-audios/audios $projectPath/4-audios/audios-prev
mv $projectPath/4-audios/audio.info.json $projectPath/4-audios/audio-prev.info.json

# ---
# Generate the audios

python3 audioGen/index.py --xml $projectPath/3-script/script.xml --output-dir $projectPath/4-audios/audios --unify-json
mv $projectPath/4-audios/audios/audio.info.json $projectPath/4-audios/audio.info.json


######################################
# Video editor - assets loading

echo "--- \n Step 5 - video \n---"

# Remove existing audios (maybe unnecessary) and copy new generated resources

rm -r $videoEditorAssetsDir/audios
rm $videoEditorAssetsDir/audio.info.json

cp -r $projectPath/4-audios/audios $videoEditorAssetsDir/audios
cp $projectPath/4-audios/audio.info.json $videoEditorAssetsDir/audio.info.json

cp -r $projectPath/2-resources/images $videoEditorAssetsDir/


# Video editor - video edition

# 1-raw-content/content.json
# 2-resources/generated.resources.json
# 2-resources/...
# 3-script/script.xml

cp $projectPath/1-raw-content/content.json $videoEditorSrcDir/

python3 videoEditorWorker/index.py \
  --audio-info $projectPath/4-audios/audio.info.json \
  --timeline-output $videoEditorAssetsDir/timeline.json \
  --composition remotion-video-editor/src/WordComposition.tsx \
  --content-json $projectPath/1-raw-content/content.json \
  --resources-json $projectPath/2-resources/generated.resources.json \
  --script-xml $projectPath/3-script/script.xml \
  --context $videoEditionContext \
  --additional-comments "Don't change the position of the music and sounds"


# Video editor - render video

# ??????
# Open directory ?


######################################
# Submission

# 1. Submit video


######################################
# Analytics

# 1. Register video in ??
# 2. Periodically check it -> write learnings within the specific project directory
# The system could also allow to enter information manually, like images or screenshots of analytics (like TikTok stats for the video) for a single project