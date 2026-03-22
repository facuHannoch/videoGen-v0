#!/bin/bash

# Convert all WAV files in the current directory to standardized format
# Usage: ./wav-to-wav.bash [directory]
# If no directory specified, uses current directory

TARGET_DIR="${1:-.}"

if [ ! -d "$TARGET_DIR" ]; then
    echo "Error: Directory '$TARGET_DIR' not found"
    exit 1
fi

shopt -s nullglob
file_count=0

for input_file in "$TARGET_DIR"/*.wav; do
    if [ ! -f "$input_file" ]; then
        echo "No WAV files found in $TARGET_DIR"
        exit 0
    fi
    
    # Generate output filename
    output_file="${input_file%.wav}_converted.wav"
    
    echo "Converting: $input_file -> $output_file"
    ffmpeg -i "$input_file" -ar 48000 -ac 1 -c:a pcm_s16le "$output_file"
    
    if [ $? -eq 0 ]; then
        ((file_count++))
        echo "✓ Converted: $output_file"
    else
        echo "✗ Failed to convert: $input_file"
    fi
    echo ""
done

echo "Conversion complete. $file_count file(s) converted."
