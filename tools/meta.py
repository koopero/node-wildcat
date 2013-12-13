#!/usr/bin/env python2.7

import mimetypes
import json
import argparse
import subprocess
import re
import fractions
import datetime
import hashlib




parser = argparse.ArgumentParser(description='Get a reasonable amount of metadata for a file, using external programs' )
parser.add_argument( 
	'input', 
	help="Input file"
)

args = parser.parse_args();

infile = args.input

def escapeshellarg(arg):
	return "\\'".join("'" + p + "'" for p in arg.split("'"))


inEscaped = escapeshellarg ( infile )

ret = {}


#
#	MD5 of file
#

f = open ( infile, 'rb' )
md5 = hashlib.md5()

while True :
	data = f.read ( 128 )
	if not data :
		break

	md5.update ( data )

ret['md5'] = md5.hexdigest ()



#
#	Unix 'file --mime'
#

unixMime = subprocess.check_output ( [ 'file', '-b', '--mime', infile ] )

if unixMime :
	mimeType = unixMime.split ( ';' )[0]


#
#	Doesn't always work, try some without --mime
#

if mimeType == 'application/octet-stream' :
	TYPES = {
		'Targa image data': 'image/x-tga'
	}
	unixFile = subprocess.check_output ( [ 'file', '-b', infile ] )

	for type in TYPES :
		if unixFile.startswith ( type ) :
			mimeType = TYPES[type]
			break






#
#	Master type
#

if mimeType :
	ret['mimeType'] = mimeType

	# Some specific cases of type
	if mimeType == 'application/pdf' :
		ret['type'] = 'pdf'
	else :
		ret['type'] = mimeType.split ( '/' )[0]
else :
	ret['type'] = 'unknown'

#if ( ret['type'] == 'image' ) :

#
#	Exiftool
#

EXIFTOOL_FIELDS = [
	"ModifyDate",      
	"NextTrackID",
	"TrackHeaderVersion",
	"TrackCreateDate",
	"TrackModifyDate",
	"TrackID",
	"TrackDuration",
	"TrackLayer",
	"TrackVolume",
	"Balance",
	"AudioChannels",
	"AudioBitsPerSample",
	"AudioSampleRate",
	"AudioFormat",
	"ImageWidth",
	"ImageHeight",
	"CleanApertureDimensions",
	"ProductionApertureDimensions",
	"EncodedPixelsDimensions",
	"MediaCreateDate",
	"MediaModifyDate",
	"MediaTimeScale",
	"MediaDuration",
	"GraphicsMode",
	"CompressorID",
	"SourceImageWidth",
	"SourceImageHeight",
	"XResolution",
	"YResolution",
	"CompressorName",
	"BitDepth",
	"VideoFrameRate",
	"CameraIdentifier",
	"Make",
	"SoftwareVersion",
	"CreateDate",
	"Model",
	"HandlerType",
	"AvgBitrate",
	"GPSAltitudeRef",
	"Rotation"
]

#
#	These fields will be force converted to floats after trimming
#	non-digit cahracters, allowing shit like "50 m" and "+49.20580000"
#

EXIFTOOL_NUMERIC = [
	"GPSAltitude",
	"GPSLatitude",
	"GPSLongitude"
]

try :
	ex = subprocess.check_output ( 'exiftool -json -c "%%+.8f" %s' % ( inEscaped ), shell=True )

	ex = json.loads( ex  )[0]
	#print ex
	exiftool = {}

	non_decimal = re.compile(r'[^\d.]+')

	for k in ex :
		if False and k in EXIFTOOL_NUMERIC :
			v = float( non_decimal.sub('', ex[k]) ) 
		elif k in EXIFTOOL_FIELDS :
			v = ex[k]
		else :
			continue

		exiftool[k] = v

		if k == 'Rotation' :
			ret['rotation'] = v

	ret['exiftool'] = exiftool
except:
	pass


#
#	Exif
#

#
#	Exif fields we care about.
#	Currently just fields of photographic interest.
#
try :
	import pyexiv2

	exivFields = ( 
		'Exif.Photo.ISOSpeedRatings',
		'Exif.Photo.FNumber',
		'Exif.Photo.ExposureTime',
		'Exif.Photo.FocalLength',
		'Exif.Photo.ExposureBiasValue',
		'Exif.Image.Make',
		'Exif.Image.Model',
		'Exif.Photo.FocalLengthIn35mmFilm',
		'Exif.Image.DateTime'
	)


	exif = pyexiv2.ImageMetadata( infile )
	exif.read()
	for key in exif.exif_keys :
		value = exif[key].value

		if isinstance ( value, fractions.Fraction ) :
			value = float (value)
		elif isinstance ( value, datetime.datetime ) :
			value = value.isoformat()

		if key in ('Exif.Photo.PixelXDimension','Exif.Image2.ImageWidth') :
			ret['width'] = value

		if key in ('Exif.Photo.PixelYDimension','Exif.Image2.ImageLength') :
			ret['height'] = value

		if key in ('Exif.Image.Orientation' ):
			ret['orientation'] = value

		if key in exivFields :
			if not ret.has_key( 'exif' ) :
				ret['exif'] = {}

			ret['exif'][key] = value
		
		#print key
		#print value
		#print "\n"
except :
	None


#
#	PIL
#

try :
	from PIL import Image

	im = Image.open ( infile )
	size = im.size
	ret['width'] = size[0]
	ret['height'] = size[1] 
except :
	None


#
#	Image Magick identify
#

if ( not 'width' in ret ) and ( not 'height' in ret ) and ( ret['type'] == 'image' ) :
	try :
		for line in subprocess.check_output ( ['identify', infile ] ).splitlines() :
			m = re.search ( r'(?P<width>\d+)x(?P<height>\d+)\+(?P<xOffset>\d+)\+(?P<yOffset>\d+)', line )
			if m :
				ret['width'] = int ( m.group('width') )
				ret['height'] = int ( m.group('height') )
				if int(m.group('xOffset')) :
					ret['xOffset'] = int(m.group('xOffset'))

				if int(m.group('yOffset')) :
					ret['yOffset'] = int(m.group('yOffset'))

			# Only worry about the first line
			break;

	except :
		None

#
#	id3Tool
#

try :
	for line in subprocess.check_output ( ['id3tool', infile ] ).splitlines() :
		( key, seperator, value ) = line.partition(':')
		value = value.strip ()
		
		if len(key) == 0 or len(value) == 0 :
			continue

		if key == 'Filename' :
			continue

		if key == 'Song Title' :
			key = 'title'
		
		key = key.lower()

		if not ret.has_key( 'id3' ) :
			ret['id3'] = {}

		ret['id3'][key] = value;
except :
	None


#
#	FF Mutha Fuckin' Mpeg
#

if ret['type'] in ( 'audio', 'video' ) or ret['mimeType'] == 'application/ogg' :
	ffout = subprocess.check_output (
		'ffprobe %s' % ( inEscaped ),
		stderr=subprocess.STDOUT,
		shell=True
	)
	#print ffout

	hasVideo = False
	hasAudio = False

	m = re.search ( r'Duration: (?P<hours>\d+?):(?P<minutes>\d\d):(?P<seconds>[\.\d]+)', ffout )
	if m :
		ret['duration'] = float(m.group('hours')) * 3600.0 + float(m.group('minutes')) * 60 + float (m.group('seconds'))

	#
	#	Get video info
	#
	m = re.search ( r'Video: (?P<codec>.*?), (?P<pixelFormat>.*?), (?P<width>\d+)x(?P<height>\d+)', ffout )
	if m :
		hasVideo = True
		ret['videoCodec'] = m.group('codec')
		ret['pixelFormat'] = m.group('pixelFormat')
		ret['width'] = int ( m.group('width') )
		ret['height'] = int ( m.group('height') )


	m = re.search ( r'([\d\.]+) fps', ffout )
	if m :
		ret['fps'] = float ( m.group(1) )

	#
	#	Get audio info
	#
	# This ony matches the first audio stream.
	m = re.search ( r'Stream #\d\.\d\: Audio: (?P<codec>.*?), (?P<sampleRate>\d*?) Hz, (?P<channels>.*?), (?P<sampleFormat>.*?)', ffout )
	if m :
		hasAudio = True
		ret['audioCodec'] = m.group('codec')
		ret['audioSampleRate'] = int(m.group('sampleRate'))
		if m.group('sampleFormat'):
			ret['audioSampleFormat'] = m.group('sampleFormat')
		#ret['audioBitRate'] = int(m.group('audioBitRate'))

	m = re.search ( r'PAR (\d+)\:(\d+)', ffout )
	if m :
		ret['pixelAspectRatio'] = float(m.group(1)) / float(m.group(2))

	if ret['mimeType'] == 'application/ogg' :
		if hasVideo :
			ret['mimeType'] = 'video/ogg'
			ret['type'] = 'video'
		elif hasAudio :
			ret['mimeType'] = 'audio/ogg'
			ret['type'] = 'audio'




#
#	Output JSON
#


print json.dumps ( ret, indent=2 )






