# Under Construction
`Wildcat` is under development. It should be ready soon. 

# Features

## Robust Metadata

## Media Transmutation
Wildcat 
## Eloquent Server
Wildcat's built-in HTTP server allows 
## Network Transparency 
## Distributed Encoding



# Goals
Wildcat should:

* **Be configurable with YAML.** 
* **Handle every media file under the sun.** Wildcat's builtin image, video and audio scripts should be robust enough to deal with any file on the internet. 
* **Not care about file extensions.** File extensions are inherently unreliable. Wildcat should be able to deal with any file, regardless of missing or erroneous extensions.


# Installation
Wildcat installation comes in two steps. The first is to install Wildcat and its command line utilities using:

	sudo npm install -g wildcat

Since Wildcat relies heavily on a number of [external utilities](#requirements), there will probably be some additional installation required. The command `wildcat-install` will try its best to detect your OS and package manager and install them for you. ***Inspect the output of `wildcat-install` before running the following command!!*** It is a blunt instrument that will install a bunch of packages you may or may not want.

	wildcat-install | sudo /bin/sh
	
	
## Windows
`Wildcat` is built on OSX and steeped in Unix philosophy. At this point, the likelyhood of it running under Windows is slim to none. 


# Requirements

* [Exiftool](http://www.sno.phy.queensu.ca/~phil/exiftool/) by Phil Harvey does an *amazing* job of extracting metadata from almost any media file you can throw at it.
* [ffmpeg](http://ffmpeg.org/) is simple the most powerful video transcoder in existence. Without it there would be no video, anywhere.
* [ImageMagick](http://www.imagemagick.org) does a huge amount of 'magick' to almost any image.

 
# Testing

	cd /usr/local/lib/node_modules/wildcat
	cd test
	bin/rebuildTestData.sh
	mocha -R nyan test-*.js
	
The script `rebuildTestData.sh` will fill test/data with some generated media files which are essential for test. **Without it, a lot of tests will fail**. Also, it should be notes that the tests are quite slow, so if you're getting a bunch of timeout errors, you should try increasing Mocha's timeout with `-t 4000` or more. 

# Roadmap

## 0.0.* ( we are here )
At this point, Wildcat is still an experiment in action. The API and configuration directives change on a whim, and features appear and disappear as koopero's project require them to.
## 0.1.0

