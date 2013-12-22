#!/bin/sh

rm -rf data

mkdir data

cd data

touch emptyFile
touch .ignoreThisFile

mkdir image
cd image
convert -size 100x300 gradient:'#FFF-#0FF' -rotate 90 \
          -alpha set -virtual-pixel Transparent +distort Polar 49 +repage \
          -rotate 90 -set colorspace HSB -colorspace RGB \
          PNG:png

convert png GIF:gif
convert png JPEG:jpeg
convert png TGA:targa
cd ..


mkdir link
cd link
ln -s ../image/gif toGif
cd ..



mkdir audio
cd audio
ffmpeg -ar 96000 -ac 2 -f s16le -i /dev/zero -t 0.125 -y silence.wav 2> /dev/null
ffmpeg -ar 96000 -ac 2 -f s16le -i /dev/zero -t 0.125 -y silence.mp3 2> /dev/null
ffmpeg -ar 96000 -ac 2 -f s16le -i /dev/zero -t 0.125 -y silence.ogg 2> /dev/null
ffmpeg -ar 96000 -ac 2 -f s16le -i /dev/zero -t 0.125 -y silence.flac 2> /dev/null
cd ..


mkdir text
cd text
echo "foobar" > foobar



cd ..