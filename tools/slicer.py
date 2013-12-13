#!/opt/local/bin/python2.7

import os
import math
import glob
import sys
import json
import argparse
import subprocess
import tempfile
import pipes

from PIL import Image

#
#	All our myriad arguments
#

parser = argparse.ArgumentParser(description='Slice one or more images into a Multirez tile directory' )
parser.add_argument( 
	'inputs', 
	help="Input images",
	nargs='+'
)

parser.add_argument( 
	'output', 
	help="Output directory",
	type=str
)

parser.add_argument( 
	'-q', 
	dest='jpegQual',
	help="JPEG Quality",
	type=int,
	default=85
)

#parser.add_argument(
#	"-t",
#	action='store_true',
#	dest='tar',
#	help="Save output as tar file"
#)

parser.add_argument(
	"-par",
	type=float,
	dest='pixelAspect',
	help="Pixel aspect ratio to be stored in metadata",
	default=1
)

parser.add_argument(
	"-r",
	type=float,
	dest='rate',
	help="Frame rate of pages. Equivalent to ffmpeg's"
)

parser.add_argument(
	"-ss",
	type=float,
	dest='time',
	help="Time stamp of first page",
	default=0
)

parser.add_argument(
	"-na",
	action='store_false',
	help="Don't process alpha channel",
	dest='transparent'
)

parser.add_argument(
	"-ns",
	action='store_false',
	help="Don't attempt to skip empty tiles",
	dest='sparse'
)
parser.add_argument(
	"-p",
	action='store_true',
	help="Save PNG files. This is slow and huge, and you're probably better off cranking up JPEG quality",
	dest='png'
)

parser.add_argument(
	"--tileSize",
	type=int,
	dest='tileSize',
	help="Tile size. Better off not messing with it.",
	default=256
)

parser.add_argument(
	"--maxTiny",
	type=int,
	dest='minPixels',
	help="Maximum size in square pixels of smallest tile",
	default=2048
)

parser.add_argument(
	"-uc",
	action='store_true',
	help="Use Image Magick's convert utility to pre-process images we normally wouldn't be able to load",
	dest='useConvert'
)

parser.add_argument(
	"-tp",
	action='store_true',
	help="When converting PDFs using ImageMagick, don't add a white background.",
	dest='transparentPdf'
)




args = parser.parse_args();

tileSize = args.tileSize


TEMPFILES = []
DEVNULL = open(os.devnull, 'w')

#
#	Take a first pass through our inputs, opening with PIL and making sure resolution and
#	pixel format match. PIL is smart enough to lazily load the images, so this is pretty
#	quick.
#

inputFiles = args.inputs
inputs = [];
size = None
pixelFormat = None

for inputFile in inputFiles :

	try :
		src = Image.open ( inputFile )
	except IOError :
		if args.useConvert :
			try :
				f = tempfile.NamedTemporaryFile(delete=True)
				tmpFile = f.name +".png"
				f.close()

				TEMPFILES.append( tmpFile )

				cmd = 'convert %s[0] %s' % ( pipes.quote ( inputFile ), pipes.quote ( tmpFile ) )
				
				subprocess.call ( cmd, shell=True )

				src = Image.open ( tmpFile )
			except :
				sys.stderr.write ( 'Error loading input %s while trying convert\n' % ( inputFile ) )
				exit (1)
		else :
			sys.stderr.write ( 'IOError loading input %s\n' % ( inputFile ) )
			exit(1)

	imSize = src.size

	# Bail if pixel format doesn't match
	if ( pixelFormat and src.mode != pixelFormat ) :
		sys.stderr.write ( 'Pixel format does not match at input %s\n' % ( inputFile ) )
		exit(2);

	# Bail if sizes do not match.
	if ( size and size != imSize ) :
		sys.stderr.write ( 'Page size does not match at input %s\n' % ( inputFile ) )
		exit(2);

	pixelFormat = src.mode

	inputs.append ( src )

	size = imSize


scale = min ( 
	float ( tileSize ) / max( size[0], size[1] ),
	math.sqrt ( args.minPixels / float ( size[0] * size[1] ) )  
)

levels = max ( 1, int ( math.ceil ( math.log ( scale ) / -math.log ( 2 ) ) ) )

page = 0

transparent = args.transparent

if pixelFormat == 'RGB' or pixelFormat == 'L' :
	transparent = False
elif pixelFormat == 'LA' :
	alphaChannel = 1
elif pixelFormat == 'RGBA' :
	alphaChannel = 3
else :
	sys.stderr.write ( "Don't know how to deal with pixelFormat %s\n" % ( pixelFormat ) )
	exit(2);

#
# Make sure output directory is ready to go
#

outDir = args.output.rstrip ( '/' )
if os.path.isfile ( outDir ):
	sys.stderr.write ( 'Output file already exists, and is not directory' )
	exit(2);
elif os.path.isdir ( outDir ) :
	# wipe existing tiles
	for rm in glob.glob ( outDir + '/tile.*') :
		os.remove( rm )
else :
	os.mkdir ( outDir )


wroteAlpha = False

wroteSparse = True

times = None

srcSize = src.size

time = args.time

wroteTimes = False

times = []

for src in inputs :

	size = src.size
	level = levels

	while level >= 0 :
		
		#print "level %d" % ( level )
		#print size
		#print int ( math.ceil( float( size[1] ) / tileSize ) )

		for y in range ( int ( math.ceil( float ( size[1] ) / tileSize ) ) ) :
			for x in range (  int ( math.ceil ( float( size[0] ) / tileSize ) ) ) :

				tileDim = ( 
					x * tileSize, 
					y * tileSize, 
					min( size[0], x * tileSize + tileSize ), 
					min( size[1], y * tileSize + tileSize ) 
				)

				tile = src.crop ( tileDim )

				writeTile = True
				writeAlpha = transparent

				if ( transparent and args.sparse ) :
					# God damn, I hate buggy image libraries!
					histogram = tile.split()[alphaChannel].histogram();

					area = ( tileDim[2] - tileDim[0] ) * ( tileDim[3] - tileDim[1] )

					# In my experience, real world images seem to contain quite a few
					# 'very-close-to-255-or-0' pixels in regions that by all rights should
					# be fully opaque or transparent. The visual impact of rounding these
					# regions up or down is neglible, and we get huge savings in the 
					# number of files in large areas of contiguous alpha 
					zeroAlpha = sum ( histogram[ 0 : 3 ] )
					fullAlpha = sum ( histogram[ 253: 256] )
					
					if ( zeroAlpha == area ):
						writeTile = False
						writeAlpha = False
						wroteSparse = True

					if ( fullAlpha == area ):
						writeAlpha = False
						wroteSparse = True

					#print ( area, fullAlpha, zeroAlpha )
					
				tileBase = "%s/tile.p%d.l%d.y%d.x%d" % ( outDir, page, level, y, x )

				if ( args.png and writeTile ) :
					tile.save( tileBase + '.png', "PNG" )

				if ( writeAlpha ) :
					alphaTile = tile.split()[ alphaChannel ]
					alphaTile.save( tileBase + '.alpha-jpeg', "JPEG", quality=args.jpegQual, optimize=True ) 
					wroteAlpha = True
				
				if ( writeTile ) :
					# PIL doesn't like writing LA images to jpeg
					if ( pixelFormat == 'LA') :
						tile = tile.split()[0]

					tile.save( tileBase + '.jpg', "JPEG", quality=args.jpegQual, optimize=True ) 




		# Scale to half size
		
		size = ( 
			int ( math.ceil( size[0] / 2 ) ),
			int ( math.ceil ( size[1] / 2 ) ) 
		)

		src = src.resize( size, Image.ANTIALIAS )

		level = level - 1

	page = page + 1

	if args.rate != None :
		times.append ( time )
		time = time + 1 / args.rate
		wroteTimes = True




formats = [ 'jpg' ]

if ( args.png ) :
	formats.append ( 'png' )

if ( wroteAlpha ) :
	formats.append ( 'alpha-jpeg' )


meta = {
	'version': 7,
	'pages': page,
	'pixelFormat': pixelFormat,
	'width': srcSize[0],
	'height': srcSize[1],
	'transparent': transparent and wroteAlpha,
	'tileSize': tileSize,
	'levels': levels + 1,
	'formats': formats
}

if wroteSparse:
	meta['sparse'] = True

if wroteTimes :
	meta['times'] = times

meta = json.dumps ( meta )

print meta

f = open( outDir + '/mr', 'w')
f.write(meta)
f.close()


for tmpFile in TEMPFILES :
	try :
		os.unlink ( tmpFile )
	except :
		None



