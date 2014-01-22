var 
	_ = require('underscore'),
	async = require('async'),
	crypto = require('crypto'),
	extend = require('extend'),
	fs = require('fs'),
	mmmagic = require('mmmagic'),
	Command = require('./Command.js'),
	Context = require('./Context.js'),
	Errors = require('./Errors.js'),
	Filesystem = require('./Storage/Filesystem.js'),
	Utils = require('./Utils.js');

module.exports = Meta;

function Meta( inputFile, options, cb ) {

	if ( 'function' == typeof options ) {
		cb = options;
		options = {};
	}

	options = options || {};

	var useDefaults = options.defaults !== false;

	_.defaults( options, {
		magic: useDefaults,
		magicMime: useDefaults,
		identify: useDefaults,
		exiftool: useDefaults,
		ffprobe: useDefaults,
		md5: false
	});

	inputFile = Filesystem.file( inputFile );


	//console.warn ( "BigMeta", inputFile );

	inputFile.getInfo ( function ( err, info ) {
		var meta = {};
		if ( err ) {
			cb ( err, meta );
			return;
		} 

		switch ( info.type ) {
			case 'file':
				meta['content-length'] = info.size;
				fileWaterfall( meta, cb );
			break;

			default:
				meta.type = info.type;
				cb( null, meta );
			break;
		}
	} );


	function fileWaterfall ( meta, cb ) {
		async.waterfall( [
			function ( cb ) {
				cb( null, meta );
			},
			magicMime,
			magic,
			exiftool,
			identify,
			ffprobe,
			md5,
			cleanup
		], function ( err, meta ) {
			cb( null, meta );
		});
	}

	function magicMime ( meta, cb ) {
		if ( !options.magic && !options.magicMime ) {
			cb ( null, meta );
			return;
		}

		var magic = new ( mmmagic.Magic ) ( mmmagic.MAGIC_MIME_TYPE );
		magic.detectFile( inputFile.localPath, function ( err, mimeType ) {
			var match = mimeType.split('/');
			if ( match ) {
				meta['type'] 	= match[0];
				meta['subtype'] = match[1];
			}

			cb( null, meta );
		} );
	}

	function magic ( meta, cb ) {
		if ( !options.magic ) {
			cb ( null, meta );
			return;
		}

		if ( meta['type'] == 'application' && meta['subtype'] == 'octet-stream' ) {
			var magic = new ( mmmagic.Magic ) ( );

			magic.detectFile( inputFile.localPath, function ( err, result ) {
				//meta.magic = result;
				for ( var prefix in Meta.Constants.MAGIC_TO_MIME ) {
					if ( Utils.Str.startsWith( result, prefix ) ) {
						extend ( meta, Meta.Constants.MAGIC_TO_MIME[prefix] );
						break;
					}
				}

				cb( null, meta );
			} );
		} else {
			cb( null, meta );
		}
	}


	function identify ( meta, cb ) {
		// Bail if identify is specifically not requested
		if ( !options.identify ) {
			cb ( null, meta );
			return;
		}

		// Bail if exiftool got everything
		if ( 
			!Meta.Constants.SUBTYPE_MULTILAYER[meta['subtype']]
			&& meta['image-width'] && meta['image-height'] 
		) {
			cb( null, meta );
			return
		}


		//console.warn( "Running identity");

		if ( meta['type'] == 'image' ) {
			var fields = {
					//"format": { c: "m", f: String, p: true },
					"image-colorspace": { c:"[colorspace]", f: String, p: true },
					"image-transparent": { c:'A', f: MagickBoolean, p: true },
					"image-bitdepth": { c: "z", p: true, d: true },
					"w": { c: "W" },
					"h": { c: "H" },	
					"x": { c: "X" },
					"y": { c: "Y" },
					"xres": { c:"x", p: true },
					"yres": { c:"y", p: true }
				},
				delim = '|',
				formatStr = '"'+_.values( fields ).map( function ( a ) { return '%'+a.c; } ).join(delim)+'\\n"';

			//console.warn ( 'formatStr', formatStr );

			command( [
				{ tool: 'identify' },
				'-format', formatStr,
				{ input: true, prefix: Meta.Constants.SUBTYPE_TO_IMAGEMAGICK_PREFIX[ meta['subtype'] ] }
			], function ( err, result ) {
				if ( result ) {
					var parse = result.split('\n'),
						ret = {},
						numPages = 0;

					parse.map( function ( line ) {
						if ( line == '' )
							return;

						numPages ++;

						line = line.split( delim );

						var page = {},
							i = 0;

						for ( var k in fields ) {
							var v = line[i],
								field = fields[k],
								formatter = field.f || parseInt;

							v = formatter( v );
							if ( field.p ) {
								if ( !field.d || meta[k] === undefined ) {
									ret[k] = v;
								}
							} else {
								page[k] = v;
							}

							i++;
						}

						page.r = page.x + page.w;
						page.b = page.y + page.h;

						if ( ret.x === undefined ) {
							ret.x = page.x;
							ret.y = page.y;
							ret.r = page.r;
							ret.b = page.b;
						} else {
							ret.x = Math.min( page.x, ret.x );
							ret.y = Math.min( page.y, ret.y );
							ret.r = Math.max( page.r, ret.r );
							ret.b = Math.max( page.b, ret.b );
						}
					} );

					if ( ret.x || ret.y ) {
						ret['image-offset'] = ret.x + ',' + ret.y;
					}
					ret['image-width'] = ret.r - ret.x;
					ret['image-height'] = ret.b - ret.y;

					delete ret.x;
					delete ret.y;
					delete ret.r;
					delete ret.b;

					if ( !ret['image-transparent'] )
						delete ret['image-transparent'];
					
					if ( ret.xres && ret.xres == ret.yres )
						ret['image-resolution'] = ret.xres;

					delete ret.xres;
					delete ret.yres;

					if ( numPages > 1 ) {
						if ( meta['subtype'] == 'gif' )
							ret['animation-frames'] = numPages;
						else
							ret['image-layers'] = numPages;
					}


					extend( meta, ret );

				}
				
				cb( null, meta );
			} );
		} else {
			cb( null, meta );
		}

		function MagickBoolean ( str ) {
			return str == 'True';
		}
	}


	function exiftool ( meta, cb ) {
		if ( !options.exiftool ) {
			cb( null, meta );
			return;
		}

		commandJson( [
			{ tool: "exiftool" },
			"-json",
			'-c', { escape: '%+.8f' },
			{ input: true }
		], function ( err, res ) {
			if ( err ) {
				cb( null, meta );
				return;
			}

			res = ExifToolExtract( res );


			extend( true, meta, res );

			cb( null, meta );
		} );
	}

	function ffprobe ( meta, cb ) {
		if ( !options.ffprobe || meta['type'] != 'video' && meta['type'] != 'audio' && meta['subtype'] != 'ogg' ) {
			cb( null, meta );
			return;
		}

		commandJson( [
			{ "tool": "ffprobe" },
			"-v quiet",
			"-print_format json", 
			"-show_format",
			"-show_streams",
			{input: true }
		], function ( err, result ) {
			if ( err ) {
				cb( null, meta );
				return;
			}



			var hasVideo = false, 
				hasAudio = false;

			if ( result.streams ) {
				result.streams.forEach ( function ( stream ) {
					if ( stream['codec_type'] == 'video' && !hasVideo ) {
						hasVideo = true;
						meta['video-codec'] = stream["codec_name"];
						meta['image-width'] = stream['width'];
						meta['image-height'] = stream['height'];
					}

					if ( stream['codec_type'] == 'audio' && !hasAudio) {
						//console.warn( 'audio', stream );
						hasAudio = true;
						meta['audio-codec'] = stream['codec_name'];
						if ( stream['sample_rate'] )
							meta['audio-samplerate'] = parseInt( stream['sample_rate'] );

						meta['audio-channels'] = stream['channels'];
					}
				});
			}

			if ( result.format ) {
				var format = result.format;
				var duration = parseFloat( format['duration'] );

				if ( duration )
					meta['media-duration'] = duration;
			}

			if ( hasVideo ) {
				meta['type'] = 'video';
			} else if ( hasAudio ) {
				meta['type'] = 'audio';
			}


			cb( null, meta );
		});
	}

	function md5 ( meta, cb ) {
		if ( !options.md5 ) {
			cb ( null, meta );
			return;
		}

		var readStream = fs.createReadStream ( inputFile.localPath ),
			hasher = crypto.createHash( 'md5' );

		readStream.on('data', function ( d ) {
			hasher.update( d );
		});

		readStream.on('end', function () {
			meta['content-md5'] = hasher.digest('hex');
			cb( null, meta );
		});
	}

	function cleanup ( meta, cb ) {
		if ( meta.bitrate == undefined ) {
			if ( meta['content-length'] && meta['media-duration'] ) {
				meta.bitrate = Math.round( meta['content-length'] / meta['media-duration'] * 8 );
			}
		}

		if ( meta['type'] && meta['subtype']) {
			meta['content-type'] = meta['type']+'/'+meta['subtype'];
			if ( meta['charset'] && meta['charset'] != 'binary' )
				meta['content-type'] += '; charset='+meta['charset'];
		}

		if ( meta['image-rotation'] == 90 || meta['image-rotation'] == 270 ) {
			meta['image-prerotate-width'] = meta['image-width'];
			meta['image-prerotate-height'] = meta['image-height'];
			meta['image-width'] = meta['image-prerotate-height'];
			meta['image-height'] = meta['image-prerotate-width'];
		}


		cb( null, meta );
	}



	//
	//	Utilities
	//

	function commandJson ( builder, cb ) {
		command( builder, function ( err, result ) {
			if ( err ) {
				cb( err );
			} else {
				try {
					result = JSON.parse( result );
				} catch ( e ) {
					cb( Errors.BadJSON() );
					return;
				}
				cb( null, result );
			}
		});
	}

	function command( cmd, cb ) {
		var context = require('./Context.js')({
			encoding: 'utf8',
			inputs: [ inputFile ]
		});

		var command = Command( cmd );
		command.execute( context, function ( err, result ) {
			cb( null, context.stdout );
		});
	}


}

Meta.Constants = {
	MAGIC_TO_MIME: {
		'Targa image data': { 'type': 'image', 'subtype': 'x-targa' },
		'SGI image data': { 'type': 'image', 'subtype': 'x-rgb' },
		'Sun raster image data': { type: 'image', subtype: 'sun-raster' },
		'XWD X Window Dump image data': { type: 'image', subtype: 'x-xwindowdump'},
		'MPEG transport stream data': { type: 'video', subtype: 'MP2T'} 
	},
	SUBTYPE_TO_IMAGEMAGICK_PREFIX: {
		'x-targa': 'TGA:',
		'tiff': 'TIF:',
		'x-icon': 'ICO:',
		'x-olympus-orf': 'ORF:',
		'x-pentax-pef': 'PEF:',
		'jpeg': 'JPG:',
		'png': 'PNG:',
		'x-raw': 'DNG:'
	},
	SUBTYPE_MULTILAYER: {
		'gif': true,
		'vnd.adobe.photoshop': true,
		'tiff': true
	},
	IGNORE_SUBTYPE_FOR: {
		'vnd.adobe.photoshop': true,
		'm2ts': true
	},
	ROTATE_FOR_SUBTYPE: {
		'jpeg': true,
		'mp4': true
	}
}

function ExifToolExtract ( src, template ) {
	if ( !template )
		template = ExifToolStd;

	if ( Array.isArray ( src ) )
		src = src[0];

	var meta = {},
		exif = meta['exif'] = {};

	for ( var k in template ) {
		var dst = exif,
			field = template[k],
			value = src[k];

		if ( value === undefined )
			continue;

		if ( field === true ) {
			field = {

			}
		} else if ( 'function' == typeof field ) {
			field = {
				func: field
			}
		} else if ( 'string' == typeof field ) {
			field = {
				dest: field
			}
		} else if ( !field ) {
			continue;
		}

		field.dest = field.dest || k;

		if ( field.dest.indexOf('../') === 0 ) {
			dst = meta;
			field.dest = field.dest.substr( 3 );
		}

		if ( field.func )
			value = field.func( value );


		dst[ field.dest ] = value;
	}

	// Get rotation

	var rotKey = 'image-rotation',
		mirrorKey = 'image-mirror';

	switch ( exif.Orientation || exif.Rotation ) {
		case 'Mirror horizontal':
			meta[mirrorKey] = 'horizontal';
		break;

		case 'Rotate 180':
			meta[rotKey] = 180;
		break;

		case 'Mirror vertical':
			meta[mirrorKey] = 'vertical';
		break;

		case 'Mirror horizontal and rotate 270 CW':
			meta[mirrorKey] = 'horizontal';
			meta[rotKey] = 270;

		break;

		case 90:
		case 'Rotate 90 CW':
			meta[rotKey] = 90;
		break;

		case 'Mirror horizontal and rotate 90 CW':
			meta[mirrorKey] = 'horizontal';
			meta[rotKey] = 90;
		break;	

		case 270:
		case 'Rotate 270 CW':
			meta[rotKey] = 270;
		break;
	}

	// Type
	if ( exif.MIMEType ) {
		var parse = exif.MIMEType.split('/');

		if ( !Meta.Constants.IGNORE_SUBTYPE_FOR[ parse[1] ] ) {
			meta.type = parse[0];
		}
		
		meta.subtype = parse[1];
	}



	return meta;
}




var ExifToolStd = {
  "ExifToolVersion": true,
  "FileType": true,
  "MIMEType": true,
  "Orientation": true, // "Rotate 90 CW", // From image file
  "Rotation": true, // 90 From video file
  //"XResolution": 300,
  //"YResolution": 300,
  //"ResolutionUnit": "inches",
  "ApertureValue": 			true,
  "ExposureCompensation": 	true,
  //"FocalLength": 			true,
  //"ImageBoundary": "0 0 4608 3072",
  //"Timezone": "-08:00",
  //"DaylightSavings": "No",
  //"DateDisplayFormat": "D/M/Y",
  "ColorSpace": '../image-colorspace',
  //"ExifImageWidth": 4608,
  //"ExifImageHeight": 3072,
  "ImageWidth": '../image-width',
  "ImageHeight": '../image-height',
  "BitsPerSample": '../image-bitdepth',//8,
  //"ColorComponents": 3,

/*
    GPSVersionID: '2.2.0.0',
    GPSLatitudeRef: 'North',
    GPSLongitudeRef: 'East',
    GPSAltitudeRef: 'Above Sea Level',
    GPSTimeStamp: '18:14:50',
    GPSSatellites: 0,
    GPSMapDatum: 'WGS-84',
    GPSDateStamp: '2008:05:08',
*/

    GPSAltitude: parseFloat,// '593.3 m Above Sea Level',
    GPSDateTime: Date,
    GPSLatitude: parseFloat,
    GPSLongitude: parseFloat,

  "Aperture": true,

  "DateTimeCreated": "2013:11:15 14:04:30",

  "LensSpec": "10-30mm f/3.5-5.6 VR [4]",

  "SubSecCreateDate": "2013:11:15 14:04:30.24",
  "SubSecDateTimeOriginal": "2013:11:15 14:04:30.24",
  "SubSecModifyDate": "2013:11:15 14:04:30.24",

  "FOV": parseFloat
}



