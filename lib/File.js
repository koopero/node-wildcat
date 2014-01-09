var 
	_ = require('underscore'),
	async = require( 'async'),
	extend = require('extend'),
	Errors = require('./Errors.js'),
	Path = require('./Path.js'),
	FileIterator = require('./FileIterator.js');

module.exports = File;

function File () {
	
}

File.prototype.getMeta = function ( callback ) {
	var file = this,
		stream = file.stream
		meta = {};

	async.series([
		fromFile,
		fromMetaFile
	], function ( err ) {
		callback( null, meta );
	});

	function fromFile ( cb ) {
		file.getInfo( function ( err, info ){
			//console.log( "fromFile", err, info );
			if ( info ) {
				meta.type = info.type;
				meta.size = info.size;
				meta.mtime = info.mtime;
			}
			cb( err );
		} );
		
	}

	function fromMetaFile ( cb ) {
		
		if ( stream ) {
			var metaStream = stream.getMetaStream();
			if ( metaStream ) {
				var metaFile = file.getRelativeFile( metaStream );

				if ( metaFile ) {

					metaFile.readData( function ( err, data ) {
						if ( err )
							return cb( err );

						extend( meta, data );
						cb();
					});
					return;
				}	
			}
		} 
		
		cb();

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

File.prototype.getRelativeFile = function ( stream )
{
	if ( !this.stream )
		throw Errors.NoStream();

	var router = this.stream.router;

	if ( !router )
		throw Errors.NoRouter();

	if ( 'string' == typeof stream )
		stream = router.streams[stream];

	if ( !stream ) {
		throw Errors.NoStream();
	}

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