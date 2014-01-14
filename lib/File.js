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

File.prototype.meta = function ( opt, callback ) {
	if ( 'function' == typeof opt ) {
		callback = opt;
		opt = {};
	}

	var file = this,
		stream = file.stream
		meta = {};

	if ( stream && 'object' == typeof stream.meta )
		extend( meta, stream.meta );

	async.series([
		fromFile,
		fromMetaFile,
		fromMeta,
	], function ( err ) {
		callback( null, meta );
	});

	function fromFile ( cb ) {
		file.getInfo( function ( err, info ){
			if ( info ) {
				meta.type = info.type;
				meta.size = info.size;
				meta.mtime = info.mtime;
			}
			cb( err );
		} );
	}

	function fromMetaFile ( cb ) {
		var metaFile = file.metaFile();
		if ( metaFile ) {

			metaFile.readData( function ( err, data ) {
				if ( err )
					return cb( null );

				extend( meta, data );
				cb( true );
			});
			return;
		} else {
			cb();	
		}
		
	}

	function fromMeta( cb  ) {
		require('./Meta.js')( file, opt, function ( err, data ) {
			if ( err ) {
				cb( err );
				return;
			}

			extend( meta, data );
			cb();
		} );
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

File.prototype.url = function () {
	var file = this;

	return 'url';
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

File.prototype.relative = function ( stream, silent )
{
	var file = this,
		fileStream = file.stream;

	if ( !fileStream )
		if ( silent )
			return;
		else
			throw Errors.NoStream();

	var router = fileStream.router;

	if ( !router )
		if ( silent )
			return;
		else
			throw Errors.NoRouter();

	stream = router.resolveStream( stream );

	if ( !stream )
		if ( silent )
			return;
		else
			throw Errors.NoStream();

	for ( var input in stream.inputs ) {
		var inputPath = Path( input );
		if ( inputPath.match ( file.path ) ) {
			var relPath = Path.translate( file.path, inputPath, stream.path );
			if ( relPath ) {
				return stream.file( relPath );
			}
		}
	}

	//console.log( 'Test output', file.path, fileStream.path, stream.path );
	var relPath = Path.translate( file.path, fileStream.path, stream.path );

	for ( var input in fileStream.inputs ) {
		var inputPath = Path( input );

		var relPath = Path.translate( file.path, fileStream.path, inputPath );
		if ( !relPath )
			continue;

		if ( !stream.path.match( relPath) )
			continue;


		return stream.file( relPath );
	}
}

File.prototype.relatives = function ( ) 
{
	var file = this,
		ret = {};

	if ( !file.stream || !file.stream.router )
		return;

	for ( var streamName in file.stream.router.streams ) {
		var stream = file.stream.router.streams[streamName],
			relative = file.relative( stream );

		//if ( stream == file.stream )
		//	continue;

		if ( relative )
			ret[streamName] = relative;
	}

	return ret;
}

File.prototype.metaFile = function ( ) 
{
	var file = this;

	if ( !file.stream || !file.stream.router )
		return;

	for ( var streamName in file.stream.router.streams ) {
		var stream = file.stream.router.streams[streamName];

		if ( !stream.metaFor )
			continue;

		if ( stream.metaFor == file.stream.name ) 
			return file.relative( stream );

		if ( Path( stream.metaFor ).match( file.path ) )
			return file.relative( stream );
	}

	return;
}

File.prototype.build = function ( opt, cb )
{
	var file = this;
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