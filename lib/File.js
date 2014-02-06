var 
	_ = require('underscore'),
	async = require( 'async'),
	extend = require('extend'),
	Errors = require('./Errors.js'),
	Path = require('./Path.js'),
	FileIterator = require('./FileIterator.js');

module.exports = File;
 
function File () {
	var file = this;
	file.cache = {};
}

File.prototype.index = function ( opt, cb ) {
	var file = this,
		path = Path( file.path ),
		index = {};

	index.name = path.filename();
	index.dir = path.dirname();
	index.path = String( path );
	index.url = file.url();

	if ( file.stream )
		index.stream = file.stream.name;


	async.series( [
		getRelatives,
		getMeta 
	], finish );

	function getRelatives ( cb ) {
		index.relatives = {};
		var relatives = file.relatives();

		async.mapSeries( _.keys( relatives ), function eachRelativeKey( streamName, cb ) {
			var relative = relatives[streamName];

			relative.exists( function ( err, exists ) {
				console.warn ( 'Relative', relative, exists );
				if ( err ) {
					cb( err );
				} else {
					if ( exists || true )
						index.relatives[streamName] = relative.url();
					cb();
				}
			});
		}, cb );
	} 

	function getMeta ( cb ) {
		file.meta( function onFileMeta ( err, meta ) {
			if ( meta ) {
				index.meta = meta;
			}
			cb();
		});
	}

	function finish() {
		cb( null, index );
	}
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
	var file = this,
		router = file.router;

	if ( router ) {
		return router.url( file );
	}

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

File.prototype.relative = function ( stream, opt )
{
	opt = opt || {};

	var file = this,
		fileStream = file.stream,
		silent = !!opt.silent;

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


	for ( var i = 0; i < stream.inputs.length; i ++ ) {
		var inputPath = Path( stream.inputs[i] );
		if ( inputPath.match ( file.path ) ) {
			var relPath = Path.translate( file.path, inputPath, stream.path );
			if ( relPath == file.path )
				continue;

			if ( relPath ) {
				//console.log ( "relPath", relPath );
				return stream.file( relPath );
			}
		}
	}
	//console.log( 'Test output', file.path, fileStream.path, stream.path );
	
	for ( var i = 0; i < fileStream.inputs.length; i ++ ) {

		var inputPath = Path( fileStream.inputs[i] );

		console.warn ( "inputPath", fileStream.name, inputPath );

		var relPath = Path.translate( file.path, fileStream.path, inputPath );
		if ( !relPath )
			continue;

		if ( !stream.path.match( relPath) )
			continue;


		return stream.file( relPath );
	}
}

File.prototype.relatives = function ( opt, cb ) 
{
	if ( 'function' == typeof opt ) {
		cb = opt;
		opt = {};
	}
	opt = opt || {};
	
	var file = this,
		stream = file.stream,
		router = file.router,
		ret = {};

	if ( !stream ) {
		if ( cb ) cb( Errors.NoStream() );
		return;
	}

	if ( !router ) {
		if ( cb ) cb( Error.NoRouter() );
		return;
	}


	inputArray( stream.inputs );
	inputArray( stream.optional );

	for ( var relStreamName in router.streams ) {
		var relStream = router.streams[ relStreamName ];
		if ( relStream == stream )
			continue;

		relativeStream( relStream );
	}


	if ( 'function' == typeof cb ) {
		cb( null, ret );
	}

	return ret;

	function inputArray ( arr ) {
		if ( !arr )
			return;

		for ( var k in arr ) {
			var wildcard = arr[k],
				relPath = Path.translate( file.path, stream.path, wildcard ),
				relFile = router.file( relPath );

			if ( relFile ) {
				var relStreamName = relFile.stream.name;
				if ( !ret[relStreamName] )
					ret[relStreamName] = relFile;
			}
		}
	}

	function relativeStream ( stream ) {

		relativeInputArray( stream.inputs );
		relativeInputArray( stream.optional );

		function relativeInputArray ( arr ) {
			if ( !arr )
				return;

			for ( var k in arr ) {
				var wildcard = arr[k],
					relPath = Path.translate( file.path, wildcard, stream.path ),
					relFile = router.file( relPath );

				if ( relFile ) {
					var relStreamName = relFile.stream.name;
					if ( !ret[relStreamName] )
					ret[relStreamName] = relFile;
				}
			}
		}
	}

	function inputArrayAsync ( arr, cb ) {
		async.map( arr, function eachInput ( wildcard ) {
			var relPath = Path.translate( file.path, stream.path, wildcard ),
				relFile = router.file( relPath );

			if ( relFile ) {
				addFile( relFile, cb );
			} else {
				cb();			
			}
		}, cb );
	}

	function addFile ( file, cb ) {
		var streamName = file.stream.name;

		if ( opt.exists ) {
			file.exists( function ( err, exists ) {
				if ( err ) {
					cb( err );
				} else {
					if ( exists && !ret[ streamName ] )
						ret[ streamName ] = file;
					cb();
				}
			});
		} else {
			if ( !ret[ streamName ] )
				ret[ streamName ] = file;
			cb();
		}
	}

	/*
	for ( var streamName in file.stream.router.streams ) {
		var stream = file.stream.router.streams[streamName],
			relative = file.relative( stream );

		//if ( stream == file.stream )
		//	continue;

		if ( relative )
			ret[streamName] = relative;
	}*/

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
	if ( 'function' == typeof opt ) {
		cb = opt;
		opt = {};
	}

	opt = opt || {};

	var file = this,
		stream = file.stream,
		router = stream && stream.router,
		worker = router && router.worker,
		job,
		executeNow = false;

	if ( worker && !opt.check ) {
		job = worker.jobForFile ( file );
		worker.expedite( job );
	} else {
		job = require('./Job.js').fromFile( file );
		executeNow = true;
	}



	job.once( 'finish', function ( result ) {
		if ( result && result.complete || result.check ) {
			cb( null, result );
		} else {
			cb( result );
		}
	} );

	if ( executeNow )
		job.execute( opt );

	return job;
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