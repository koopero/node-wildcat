#!/bin/sh

rm -rf data

mkdir data

cd data

echo "Building empty files"
touch emptyFile
touch .ignoreThisFile

mkdir image
cd image
echo "Building image files"
convert -size 100x300 gradient:'#FFF-#0FF' -rotate 90 \
          -alpha set -virtual-pixel Transparent +distort Polar 49 +repage \
          -rotate 90 -set colorspace HSB -colorspace RGB \
          PNG:png

convert png PCX:"pcx with spaces"
convert png GIF:gif
convert png JPEG:jpeg
convert png TGA:targa
cd ..


mkdir link
cd link
echo "Creating links"
ln -s ../image/gif toGif
cd ..



mkdir audio
cd audio
echo "Building audio files"
ffmpeg -ar 96000 -ac 2 -f s16le -i /dev/zero -t 0.125 -y silence.wav 2> /dev/null
ffmpeg -ar 96000 -ac 2 -f s16le -i /dev/zero -t 0.125 -y silence.mp3 2> /dev/null
ffmpeg -ar 96000 -ac 2 -f s16le -i /dev/zero -t 0.125 -y silence.ogg 2> /dev/null
ffmpeg -ar 96000 -ac 2 -f s16le -i /dev/zero -t 0.125 -y silence.flac 2> /dev/null
cd ..


mkdir text
cd text
echo "Building text files"
echo "foobar" > foobar
cd ..


mkdir video
cd video
echo "Building video files"
ffmpeg -y -t 10 -s 1920x1080 -f rawvideo -pix_fmt rgb24 -r 25 -i /dev/zero black.1080.mp4 >/dev/null 2>&1
cd ..


mkdir json
cd json
echo "Building json files"
echo '{"bool":true,"number":4.0,"string":"foobar","null":null}' > test.json
cd ..

echo "Building meta files"
for file in $(find . -not -type d -not -name ".*" -not -wholename './meta/*' | sed 's/^\.\///')
do
	mkdir -p `dirname meta/$file.meta.json`
	wildcat-meta $file > meta/$file.meta.json
done

cd ..