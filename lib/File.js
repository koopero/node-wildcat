var 
	_ = require('underscore'),
	async = require( 'async'),
	extend = require('extend'),
	stream = require('stream'),
	Errors = require('./Errors.js'),
	Path = require('./Path.js'),
	Wildcard = require('./Path.js'),
	FileIterator = require('./FileIterator.js');

module.exports = File;
 
function File ( path ) {
	var file = this;
	file.path = Path( path );
	file.cache = {};
}

File.prototype.index = function ( opt, cb ) {
	if ( 'function' == typeof opt ) {
		cb = opt;
		opt = {};
	}

	var file = this,
		path = Path( file.path ),
		index = {};

	index.name = path.filename();
	index.dir = path.dirname();
	index.path = String( path );

	//console.warn( "File.prototype.index", file.url );

	index.url = file.url();

	if ( file.stream )
		index.stream = file.stream.name;


	async.series( [
		getRelatives,
		getMeta,
		recurseDir
	], finish );

	function getRelatives ( cb ) {
		index.relatives = {};
		file.relatives( opt, function ( err, relatives ) {
			if ( err ) {
				cb( err );
			} else {
				index.rel = relatives;
				cb();
			}
		});

	} 

	function getMeta ( cb ) {
		file.meta( function onFileMeta ( err, meta ) {
			if ( meta ) {
				index.meta = meta;
				index.size = meta['content-length'];
			}
			cb();
		});
	}

	function recurseDir ( cb ) {
		if ( index.meta && index.meta.type == 'dir' && opt.recurse > 0 ) {
			opt = _.clone( opt );
			opt.recurse --;

			file.listDirectory( function onFileReaddir ( err, listing ) {
				if ( err ) {
					cb( err );
					return;
				}

				async.mapSeries( 
					listing, 
					function eachSubFile ( subFile, cb ) {
						subFile.index( opt, cb );
					}, 
					function finishSubListing ( err, subs ) {
						index.listing = subs;
						cb( err );
					}
				);
			});
		} else {
			cb();
		}
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

	



	async.series([
		fromStat,
		fromMetaFile,
		fromMeta,
	], function ( err ) {
		if ( stream && 'object' == typeof stream.meta )
			extend( meta, stream.meta );

		callback( null, meta );
	});

	function fromStat ( cb ) {
		file.stat( function ( err, stat ) {
			//console.warn ( "fromStat", err, stat );
			if ( stat ) {
				meta.type = stat.type;
				if ( stat.isFile && stat.size ) 
					meta['content-length'] = stat.size;
				meta['last-modified'] = stat.mtime;
			}
			cb( err );
		} );
	}

	function fromMetaFile ( cb ) {
		var metaFile = file.relative( {
			tag: 'meta'
		});

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
		if ( !file.localPath ) {
			cb();
			return;
		}

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

	file.stat( function ( err, stat ) {
		if ( err ) {
			cb( err );
			return;
		}

		if ( options.includeSelf ) {
			iterator.input( file );
		}

		if ( stat.isDir ) {
			file.readdir( function ( err, listing ) {
				var subDirs = [];

				_.each( listing, function ( subFile ) {
					subFile = file.file( subFile );
					
					if ( subFile.path.isDir ) {
						subDirs.push( subFile );
						if ( options.dirs !== false )
							iterator.input ( subFile );
					} else if ( options.files !== false ) {
						iterator.input ( subFile );
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

File.prototype.relative = function ( opt )
{
	if ( 'string' == typeof opt ) {
		opt = {
			'stream': opt
		}
	}

	opt = opt || {};

	var file = this,
		fileStream = file.stream,
		silent = !!opt.silent;

	if ( !fileStream )
		return;

	var router = fileStream.router;

	if ( !router ) {
		//throw Errors.NoRouter();
		return;
	}

	if ( opt.stream ) {
		var stream = router.resolveStream( opt.stream );

		if ( !stream ) {
			//throw Errors.NoStream();
			return;
		}
		return fromStream( stream );
	} else if ( opt.tag ) {
		return fromTag ( opt.tag );
	}

	function fromStream( stream, noOutputs ) {
		for ( var i = 0; i < stream.inputs.length; i ++ ) {
			var inputPath = Wildcard( stream.inputs[i] );
			if ( inputPath.match ( file.path ) ) {
				var relPath = Wildcard.translate( file.path, inputPath, stream.path );
				if ( relPath == file.path )
					continue;

				if ( relPath ) {
					return stream.file( relPath );
				}
			}
		}

		for ( var i = 0; i < stream.outputs.length; i ++ ) {
			var outputPath = Wildcard( stream.outputs[i] );

			if ( outputPath.match ( file.path ) ) {
				var relPath = Wildcard.translate( file.path, stream.path, outputPath );
				if ( relPath == file.path )
					continue;

				if ( relPath ) {
					return stream.file( relPath );
				}
			}
		}


		if ( noOutputs )
			return;
		
		for ( var i = 0; i < fileStream.inputs.length; i ++ ) {

			var inputPath = Wildcard( fileStream.inputs[i] );

			//console.warn ( "inputPath", fileStream.name, inputPath );

			var relPath = Wildcard.translate( file.path, fileStream.path, inputPath );
			if ( !relPath )
				continue;

			if ( !stream.path.match( relPath) )
				continue;


			return stream.file( relPath );
		}
	}

	function fromTag ( tag ) {
		for ( var i in router.searchStreams ) {
			var stream = router.searchStreams[i];
			if ( stream.hasTag( tag ) ) {
				var rel = fromStream( stream );
				if ( rel )
					return rel;
			}
		}
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
		ret = opt.asArray ? [] : {};

	if ( !stream ) {
		if ( cb ) cb( Errors.NoStream() );
		return;
	}

	if ( !router ) {
		if ( cb ) cb( Error.NoRouter() );
		return;
	}

	/* This could be optimized by precomputing potential relative
	streams. */

	var fileStreamWildcard = file.stream.path; 

	function relativeArray ( arr, namespace, reverse ) {
		if ( !arr )
			return;

		var ret;

		for ( var k in arr ) {
			var wildcard = arr[k];

			//console.warn ( 'WILDCARD', file.path, wildcard, namespace );

			var relPath = reverse ? 
				Path.translate( file.path, namespace, wildcard ) :
				Path.translate( file.path, wildcard, namespace );

			if ( !relPath )
				continue;

			//console.warn ( 'RELPATH', file.path, relPath );

			if ( relPath == file.path )
				continue;

			var relFile = router.file( relPath );

			if ( !relFile )
				continue;

			if ( ret )
				ret.push( relFile );
			else
				ret = [ relFile ];
		}		


		return ret;

	}

	function addToRet( file, role ) {
		if ( !file )
			return;

		if ( Array.isArray( file ) ) {
			file.forEach ( function ( file ) {
				addToRet( file, role );
			});
			return;
		}

		var name = file.stream.name;

		if ( opt.asArray ) {
			ret.push( file );
		} else {
			ret[name] = file;
		}
	}


	if ( opt.outputs ) {
		var outputs = relativeArray( stream.outputs, stream.path, true );
		addToRet( outputs, 'output' );
	}

	if ( opt.inputs ) {
		var inputs = relativeArray( stream.inputs, stream.path, true );
		addToRet( inputs, 'input' );
	}

	if ( opt.affected || opt.source ) { 
		_.map( router.streams, function ( otherStream ) {
			
			if ( otherStream == stream )
				return;

			if ( otherStream.ignoreFile( file ) ) {
				return;
			}

			if ( opt.source ) {
				var inputToOther = relativeArray( otherStream.inputs, otherStream.path );
				addToRet( inputToOther, 'output' );
			}

			if ( opt.affected ) {
				var fromOther = relativeArray( otherStream.outputs, otherStream.path )
				addToRet( fromOther, 'input' );
			}
		});
	}



	if ( 'function' != typeof cb ) {
		return ret;
	}

	// 	-----------------
	//	Async Stuff Below
	//	-----------------

	// Don't fuck with what we've already returned sychronously
	var rel = _.clone(ret );

	async.mapSeries( _.keys( rel ), function ( k, cb ) {
		var file = rel[k];

		if ( opt.exists ) {
			file.exists( function ( err, exists ) {
				if ( err ) {
					cb( err );
				} else {
					if ( !exists )
						if ( Array.isArray( rel ) )
							rel.splice( k, 1 );
						else
							delete rel[k];

					cb();
				}
			});
		} else {
			cb( );
		}

	}, function ( err ) {
		cb( err, rel );
	});


	return ret;
}

File.prototype.store = function ( source, opt, cb ) {
	if ( 'function' == typeof opt ) {
		cb = opt;
		opt = {};
	} 

	opt = opt || {};
	opt.recurse = opt.recurse != false;

	var dest = this,
		localPath = dest.localPath;

	dest.cache.stat = null;

	if ( 'string' == typeof source ) {
		source = new Buffer( source );
	}


	if ( source instanceof stream.Readable ) {
		dest.storeStream( source, opt, cb );
		return;
	}

	if ( source instanceof Buffer ) {
		dest.storeBuffer( source, opt, cb );
		return;
	}

	if ( source instanceof File ) {
		dest.storeFile( source, opt, cb );
		return;
	}

	cb( Errors.InvalidSource() );


	function emitChange ( cb ) {
		dest.touch();
		cb();
	}
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
		file.cache = {};

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
//		( this.storage ? this.storage.localPath : '' ),
		this.path.str
	].join(':')+']';
}

File.prototype.valueOf = function ()
{
	return String( this.path );
}

