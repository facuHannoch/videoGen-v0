






<<'COMMENT'
1. Obtain details 
2. Generate script

COMMENT



########################

# load env variables


# python3 scriptGen/index.py -o scriptGen/res.json --template scriptGen/prompt.txt --map PHONEME_HERE=g

# python3 resourcesGen/index.py --input scriptGen/res.json --assets-dir resourcesGen/out --output resourcesGen/generated.resources.json

# python3 audioScriptGen/index.py --input scriptGen/res.json --reference audioScriptGen/reference.xml --output audioScriptGen/script.xml

######################################
# Generate audio
# Takes the script, generates the audio by pieces and a unified audio metadata, and copies that to public/audios in the editor


# ---
# Remove previous audios, and move the current ones to a -prev directory

# rm -r $projectPath/audios-prev
# rm $projectPath/audio-prev.info.json

# mv $projectPath/audios $projectPath/audios-prev
# mv $projectPath/audio.info.json $projectPath/audio-prev.info.json

# # ---
# # Generate the audios

# python3 audioGen/index.py --xml $projectPath/script.xml --output-dir $projectPath/audios --unify-json
# mv $projectPath/audios/audio.info.json $projectPath/audio.info.json


# #######################################
# # Video editor

# # Remove existing audios (maybe unnecessary) and copy new generated resources

# rm -r $videoEditorAssetsDir/audios
# rm $videoEditorAssetsDir/audio.info.json

# cp -r $projectPath/audios $videoEditorAssetsDir/audios
# cp $projectPath/audio.info.json $videoEditorAssetsDir/audio.info.json


# mv images $videoEditorAssetsDir/diagram.png




#
#
#
#
#
#
#
#

#


######################################

# 1. Create g directory in PROJECT/g/
# 2. Move prompt into g/1/ or use a common prompt, 
#     i. Pass prompt as cli argument
#     ii. Move prompt into g/1-raw-content/prompt.txt
#     iii. Use prompt a level above, like PROJECT/_common/prompt.txt
#     # iv. Use prompt in scriptGen/prompt.txt
# 3. ??
# ??
# ?. Move assets to remotion-video-editor. Rename image to diagram.


# This assumes the script runs with the root in videoGen

# content=ʃ
# lang=es
# category=ipa_coach-phonemes

category=ipa_coach-word_pronunciation
content=bed
lang=es

projectPath=public/$category/$content/$lang
videoEditorAssetsDir=remotion-video-editor/public

# initialPromptPath=
# scriptReferencePath=

mkdir -p $projectPath
mkdir $projectPath/1-raw-content
mkdir $projectPath/2-resources
mkdir $projectPath/3-script
mkdir $projectPath/4-audios

# xmlReferencePath=$projectPath/2-resources/script-reference.xml

promptPath=public/$category/_common/prompt-$lang.txt
xmlReferencePath=public/$category/_common/reference-$lang.xml
videoEditionContext=public/$category/_common/videoMakingContext.txt


# echo " ----- $content ----- "
# echo "--- \n Step 1 - Raw content creation \n---"

# python3 scriptGen/index.py -o $projectPath/1-raw-content/content.json --template $promptPath --map PHONEME_HERE=$content

# echo "\n--- \n Step 2 - Resources creation \n---"

# python3 resourcesGen/index.py --input $projectPath/1-raw-content/content.json --assets-dir $projectPath/2-resources/images/ --output $projectPath/2-resources/generated.resources.json --image-aspect-ratio 1:1 


# echo "\n--- \n Step 3 - Audio Script creationg\n---"

# python3 audioScriptGen/index.py --input $projectPath/1-raw-content/content.json --reference $xmlReferencePath --output $projectPath/3-script/script.xml --google-model gemini-3-flash-preview


######################################
# Generate audio
# Takes the script, generates the audio by pieces and a unified audio metadata, and copies that to public/audios in the editor


echo "--- \n Step 4 - Synthetic audio generation \n---"
# ---
# Remove previous audios, and move the current ones to a -prev directory

rm -r $projectPath/4-audios/audios-prev
rm $projectPath/4-audios/audio-prev.info.json

mv $projectPath/4-audios/audios $projectPath/4-audios/audios-prev
mv $projectPath/4-audios/audio.info.json $projectPath/audio-prev.info.json

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
exit


# Video editor - video edition

# 1-raw-content/content.json
# 2-resources/generated.resources.json
# 2-resources/...
# 3-script/script.xml

python3 videoEditorWorker/index.py --composition remotion-video-editor/src/Composition.tsx --content-json $projectPath/1-raw-content/content.json --resources-json $projectPath/2-resources/generated.resources.json --script-xml $projectPath/3-script/script.xml --context $videoEditionContext --additional-comments "Don't change the position of the music and sounds"


# Video editor - render video

# ??????
# Open directory ?


######################################
# Submission

# 1. Submit video


######################################
# Analytics

# 1. Register video in ??
# 2. Periodically check it