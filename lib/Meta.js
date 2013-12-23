var 
	async = require('async'),
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

	inputFile = Filesystem.file( inputFile );

	async.waterfall( [
		function ( cb ) {
			cb( null, {} );
		},
		getInfo,
		fileCommand1,
		fileCommand2,
		exiftool,
		ffprobe,
		md5,
		format
	], function ( err, meta ) {
		cb( null, meta );
	});

	function getInfo ( meta, cb ) {
		inputFile.getInfo ( function ( err, info ) {
			if ( err ) {
				cb ( err, meta );
				return;
			} 

			switch ( info.type ) {
				case 'void':
					meta.type = info.type;
					cb( true, meta );
				break;

				default:
					cb( null, meta );
				break;
			}

		} );
	}

	function fileCommand1( meta, cb ) {
		if ( !meta ) meta = {};

		command( [
			{ tool: "file" },
			"-b",
			"--mime",
			{ input: true }
		], function ( err, stdout ) {
			if ( err )
				cb( null );

			stdout = stdout.trim();

			var match;
			if ( match = stdout.match( /^(.+?)\/(.+?); charset=(.*?)$/ ) ) {
				//ret['content-type'] = match[0];
				meta['type'] 	= match[1];
				meta['subtype'] = match[2];
				meta['charset'] = match[3];
			}

			cb( null, meta );
		});
	}

	function fileCommand2( meta, cb ) {
		if ( meta['type'] == 'application' && meta['subtype'] == 'octet-stream' ) {
			command( [
				{ tool: "file" },
				"-b",
				{ input: true }
			], function ( err, out ) {
				if ( Utils.Str.startsWith( out, 'Targa image data' ) ) {
					meta['type'] = 'image';
					meta['subtype'] = 'x-targa';
					meta['charset'] = 'binary';

				}
				cb( null, meta );
			});
		} else {
			cb( null, meta );
		}
	}


	function exiftool ( meta, cb ) {
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
		if ( meta['type'] != 'video' && meta['type'] != 'audio' && meta['subtype'] != 'ogg' ) {
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
				//console.warn( 'format', format );
				meta['media-duration'] = parseFloat( format['duration'] );
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
		command( [
			{ tool: 'md5' },
			'-q',
			{ input: true }
		], function ( err, out ) {
			if ( out )
				meta['content-md5'] = out.trim();

			cb( null, meta );
		});
	}

	function format ( meta, cb ) {
		if ( meta['type'] && meta['subtype']) {
			meta['content-type'] = meta['type']+'/'+meta['subtype'];
			if ( meta['charset'] != 'binary' )
				meta['content-type'] += '; charset='+meta['charset'];
		}

		cb( null, meta );
	}



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




