var 
	_ = require('underscore'),
	async = require('async'),
	crypto = require('crypto'),
	extend = require('extend'),
	fs = require('fs'),
	mmmagic = require('mmmagic'),
	Builder = require('./Builder.js'),
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

	var useDefaults = options.defaults !== false;

	_.defaults( options, {
		magic: useDefaults,
		magicMime: useDefaults,
		identify: useDefaults,
		exiftool: false,
		ffprobe: useDefaults,
		md5: false
	});

	inputFile = Filesystem.file( inputFile );


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
			identify,
			exiftool,
			ffprobe,
			md5,
			cleanup
		], function ( err, meta ) {
			cb( null, meta );
		});
	}

	function magicMime ( meta, cb ) {
		if ( !options.magicMime ) {
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
				for ( var prefix in MAGIC_TO_MIME ) {
					if ( Utils.Str.startsWith( result, prefix ) ) {
						extend ( meta, MAGIC_TO_MIME[prefix] );
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
		if ( !options.identify ) {
			cb ( null, meta );
			return;
		}



		if ( meta['type'] == 'image' ) {
			var fields = {
					//"format": { c: "m", f: String, p: true },
					"image-colorspace": { c:"[colorspace]", f: String, p: true },
					"image-transparent": { c:'A', f: MagickBoolean, p: true },
					"image-bitdepth": { c: "z", p: true },
					"w": { c: "W" },
					"h": { c: "H" },	
					"x": { c: "X" },
					"y": { c: "Y" },
					"xres": { c:"x", p: true },
					"yres": { c:"y", p: true }
				},
				delim = '|',
				formatStr = '"'+_.values( fields ).map( function ( a ) { return '%'+a.c; } ).join(delim)+'\\n"';

			command( [
				{ tool: 'identify' },
				'-format', formatStr,
				{ input: true, prefix: SUBTYPE_TO_IMAGEMAGICK_PREFIX[ meta['subtype'] ] }
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
							if ( field.p )
								ret[k] = v;
							else
								page[k] = v;


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
			'-c "%%+.8f"',
			{ input: true }
		], function ( err, res ) {
			if ( err ) {
				cb( null, meta );
				return;
			}
			if ( Array.isArray( res ) )
				res = res[0];

			//console.warn( res );
			if ( res.MIMEType ) {
				var parse = res.MIMEType.split('/');
				meta.type = parse[0];
				meta.subtype = parse[1];
			}

			meta['image-width'] = res['ImageWidth'];
			meta['image-height'] = res['ImageHeight'];

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
				cb( null );
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
					cb( null, result );
				} catch ( e ) {
					cb( Errors.BadJSON() );
				}
			}
		});
	}

	function command( builder, cb ) {
		var context = Context({
			encoding: 'utf8',
			inputs: [ inputFile ]
		});

		var builder = Builder( builder );
		builder.execute( context, function ( err, result ) {
			cb( null, context.stdout );
		});
	}


}

const MAGIC_TO_MIME = {
	'Targa image data': { 'type': 'image', 'subtype': 'x-targa' },
	'SGI image data': { 'type': 'image', 'subtype': 'x-rgb' },
	'Sun raster image data': { type: 'image', subtype: 'sun-raster' },
	'XWD X Window Dump image data': { type: 'image', subtype: 'x-xwindowdump'}
};

const SUBTYPE_TO_IMAGEMAGICK_PREFIX = {
	'x-targa': 'TGA:',
	'tiff': 'TIF:',
	'x-icon': 'ICO:'
}



