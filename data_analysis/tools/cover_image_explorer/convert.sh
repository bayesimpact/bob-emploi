#!/bin/bash
# This is a script to generate cover images. It takes very large images for each job group and then
# reduce the size if needed to get:
#  - below 100 Kb for desktop
#  - below 30 Kb for mobile
#
# The images should all be at the root of the folder the script is run from.
#
# The strategies are:
#  - on desktop crop horizontally to 4:3, on mobile crop to 3:4
#  - reduce max width/height to 1200x1200 on desktop, 600x600 on mobile
#  - reduce quality JPEG compression
#
# Make sure to start from the largest images possible when you start the operation.

if ! command -v mogrify >/dev/null 2>&1; then
  echo_error 'Set up the ImageMagick tools first.'
  echo "* Installation is probably as simple as \`sudo apt install imagemagick\`"
  exit 1
fi

if [ "$1" == "desktop" ]; then
    CROP_RATIO=4:3
    RESIZE=1200x1200
    MAX_SIZE=+100k
elif [ "$1" == "mobile" ]; then
    CROP_RATIO=3:4
    RESIZE=600x600
    MAX_SIZE=+30k
else
    echo "Specify mobile or desktop"
    exit 2
fi

mkdir -p "$1"
NUM_IMAGES=$(find *.jpg | wc -l)
echo "Copying $NUM_IMAGES images…"
cp *.jpg "$1/"

NUM_LARGE_IMAGES=$(find $1 -type f -size $MAX_SIZE | wc -l)
echo "Cropping $NUM_LARGE_IMAGES large images…"
mogrify -gravity center -crop $CROP_RATIO $(find $1 -type f -size $MAX_SIZE)

NUM_LARGE_IMAGES=$(find $1 -type f -size $MAX_SIZE | wc -l)
echo "Resizing $NUM_LARGE_IMAGES large images…"
mogrify -gravity center -resize $RESIZE $(find $1 -type f -size $MAX_SIZE)

for quality in 90 70 60 55 50 45 40 38 36 34 32 30 29 28 27 26 25 24 23 22 21 20; do
    NUM_LARGE_IMAGES=$(find $1 -type f -size $MAX_SIZE | wc -l)
    if [ "$NUM_LARGE_IMAGES" == "0" ]; then
        break
    fi
    echo "Trying JPEG quality $quality% for $NUM_LARGE_IMAGES large images…"
    mogrify -gravity center -crop $CROP_RATIO -resize $RESIZE -quality $quality -path $1 $(find $1 -type f -size $MAX_SIZE | sed -e "s/$1\///")
done

NUM_LARGE_IMAGES=$(find $1 -type f -size $MAX_SIZE | wc -l)
if [ "$NUM_LARGE_IMAGES" -ne "0" ]; then
    echo "There are still $NUM_LARGE_IMAGES images that are too large"
fi
