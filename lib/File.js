var 
	_ = require('underscore'),
	async = require( 'async'),
	Path = require('./Path.js'),
	FileIterator = require('./FileIterator.js');

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
		file.getInfo( function ( err, info ){
			var meta = info && {
				size: info.size,
				type: info.type,
				mtime: info.mtime
			};
			cb( meta );
		}, true );
		
	}
}

File.prototype.file = function ( path ) {
	var file = this,
		absPath = file.path.append( path );

	if ( file.router )
		return file.router.file( absPath );

	if ( file.storage )
		return file.storage.file( absPath );

	throw File.Error.NoStorage(); 
}

File.prototype.walk = function ( options, cb ) {
	if ( 'function' == typeof options ) {
		cb = options;
		options = {};
	}

	var iterator;
	if ( options instanceof FileIterator ) {
		iterator = options;
		options = iterator.options;
	} else {
		options = options || {};

		iterator = new FileIterator ( options, cb );
		cb = finish;
	}

	var file = this;

	console.log( "Walk", file );

	file.getInfo( function ( err, info ) {
		if ( err ) {
			cb( err );
			return;
		}

		if ( options.includeSelf ) {
			iterator.input( file );
		}

		if ( info.isDir ) {
			file.readdir( function ( err, listing ) {
				var subDirs = [];

				_.each( listing, function ( subFile ) {
					subFile = file.file( subFile );
					iterator.input ( subFile );
					if ( subFile.path.isDir ) {
						subDirs.push( subFile );	
					}
				});

				async.eachSeries( subDirs, function ( subDir, cb ) {
					subDir.walk( iterator, cb );
				}, cb );
			});
		} else {
			cb();
		}
	});

	function finish( err ) {
		if ( err ) {
			iterator.error( err );
		}

		iterator.end();
	}

	return iterator;
}

File.prototype.touch = function ( method )
{
	var file = this,
		storage = file.storage;

	if ( storage )
		return storage.touch( this.path, method );

	return false;
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