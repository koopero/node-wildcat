var 
	async = require( 'async'),
	Path = require('./Path.js');

module.exports = File;

function File () {
	
}

File.prototype.getMeta = function ( callback ) {
	var file = this,
		stream = file.stream;

	async.series([
		fromMetaFile,
		fromStream,
		fromFile
	], function ( meta ) {
		callback( null, meta );
	});

	function fromMetaFile ( cb ) {
		if ( stream && 'string' == typeof stream.meta ) {

			var metaFile = file.getRelativeFile( stream.meta );

			if ( metaFile ) {
				metaFile.readData( function ( err, data ) {
					if ( err )
						return cb();

					return cb( data );
				});
			} else {
				cb();
			}

		} else {
			cb();
		}
	}

	function fromStream ( cb ) {
		if ( stream && 'object' == typeof stream.meta ) {
			cb( stream.meta );
		} else {
			cb();
		}
	}

	function fromFile ( cb ) {
		file.getInfo( function ( err ){
			var meta = {
				size: file.size,
				type: file.isDir ? 'dir' : file.isLink ? 'link' : file.exists ? 'file' : null,
				mtime: file.mtime
			};
			cb( meta );
		}, true );
		
	}
}

File.prototype.getRelativeFile = function ( streamName )
{
	if ( !this.stream )
		throw Errors.NoStream();

	var router = this.stream.router;

	if ( !router )
		throw Errors.NoRouter();

	var stream = router.streams[streamName];

	if ( !stream )
		throw Errors.NoStream( streamName );


	for ( var input in stream.inputs ) {
		var inputPath = Path( input );
		if ( inputPath.match ( this.path ) ) {
			var relPath = Path.translate( this.path, inputPath, stream.path );
			if ( relPath ) {
				return stream.getFile( relPath );
			}
		}
	}
}

File.prototype.inspect = function ()
{
	return [ 
		'[File',
		( this.stream ? this.stream.name : '' ),
		( this.storage ? this.storage.localPath : '' ),
		this.path.str
	].join(':')+']';
}