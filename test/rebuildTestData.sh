#!/bin/sh

cd data/link
rm toGif
ln -s ../image/gif toGif
cd ../..

ffmpeg -ar 96000 -ac 2 -f s16le -i /dev/zero -t 0.125 -y data/audio/silence.wav 2> /dev/null
ffmpeg -ar 96000 -ac 2 -f s16le -i /dev/zero -t 0.125 -y data/audio/silence.mp3 2> /dev/null
ffmpeg -ar 96000 -ac 2 -f s16le -i /dev/zero -t 0.125 -y data/audio/silence.ogg 2> /dev/null
