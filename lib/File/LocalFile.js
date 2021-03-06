/***
# LocalFile

`LocalFile` subclasses `File`, providing an interface to local filesystem files. It's interface
should be identical to `File`.

`LocalFile` should not be instantiated directly, but rather created from a `Filesystem` object.
*/


var 
	_  				= require('underscore'),
	async 			= require('async'),
	pathlib 		= require('path'),
	urllib 			= require('url'),
	fs 				= require('fs.extra'),
	os 				= require('os'),
	templib 		= require('temp'),
	rimraf  		= require('rimraf'),
	stream 			= require('stream'),
	mkdirp  		= require('mkdirp'),
	util 			= require('util'),
	Path 			= require('../Path.js'),
	Errors		 	= require('../Errors.js');
	File 			= require('../File.js'),
	FileIterator 	= require('../FileIterator.js');


util.inherits( LocalFile, File );
module.exports = LocalFile;

LocalFile.Errors = Errors.List( {
	PathBlocked: true,
	MoveFail: true,
	OpenFail: true,
	CopyFail: true
});

// A delay in milliseconds to wait between writing a file
// and reading its stat. There seems to be some race conditions
// in node that necessitates this.
const COOLDOWN = 30;

function LocalFile ( path ) {
	File.apply( this, arguments );
}

LocalFile.prototype.exists = function ( cb ) {
	var file = this,
		storage = file.storage,
		localPath = storage.pathToLocal ( file.path );

	if ( file.cache.exists !== undefined ) {
		cb( null, file.cache.exists )
	} else if ( !localPath ) {
		cb( null, false );
	} else {
		fs.stat( localPath, function onStat ( err, stat ) {
			var shouldBeDir = Path( file.path ).isDir;
			var exists = !err && stat && ( ( shouldBeDir && stat.isDirectory() ) || ( !shouldBeDir && stat.isFile() || stat.isSymbolicLink() ) );
			
			file.cache.exists = exists;

			cb( null, exists );
		});
	}
}

LocalFile.prototype.stat = function ( opt, callback ) {
	if ( 'function' == typeof opt ) {
		callback = opt;
		opt = {};
	}

	if ( !callback )
		callback = function () {};

	var file = this,
		info = {},
		storage = file.storage;

	if ( file.cache.stat && !opt.noCache ) {
		callback( null, file.cache.stat );
		return;
	}


	// Cool down for a few milliseconds if the file has recently been written.
	if ( file._writtenAt ) {
		var t = new Date().getTime() - file._writtenAt;
		if ( t < COOLDOWN ) {
			setTimeout( function () {
				file.stat( opt, callback );
			}, COOLDOWN);
			return;
		}
	}




	//if ( storage && !info.localPath )
	info.localPath = storage.pathToLocal ( file.path );

	file.isLink = false;

	var localPath = file.localPath;
	


	// Strip trailing slash
	if ( localPath.substr( -1 ) == '/' && localPath.length > 1 )
		localPath = localPath.substr( 0, localPath.length - 1 );


	fs.lstat( localPath, function ( err, stat ) {
		if ( err ) {
			info.exists = false;
			finish ();
		} else {
			info.isDir = stat.isDirectory();
			info.isFile = stat.isFile();
			info.isLink = stat.isSymbolicLink();
			info.mtime = stat.mtime;

			if ( stat.isSymbolicLink() ) {
				info.exists = true;
				fs.readlink( localPath, function ( err, linkString ) {
					if ( err ) {
						info.exists = false;
						finish ();
					} else {
						var link = pathlib.resolve( pathlib.dirname( localPath ), linkString ),
							linkIsOutside = link.substr( 0, storage.localPath.length ) != storage.localPath;

						if ( !storage.allowOutsideSymlinks && linkIsOutside ) {
							info.exists = false;
							info.isOutsideLink = true;
							finish ();
							return;
						}

						info.linkPath = link.substr( storage.localPath.length );
						followSymLink( localPath );
					}
				} );	
			} else {
				info.exists = info.isDir || info.isFile;
				info.size = stat.size;

				if ( info.isDir && !file.path.isDir ) {
					file.path = info.path = file.path.trailingSlash();
				} else if ( !info.isDir && file.path.isDir ) {
					file.path = info.path = file.path.stripTrailingSlash();
				}

				finish ();
			}
		}
	});

	// To see is isDir or not
	function followSymLink ( localPath ) {
		fs.lstat( localPath, function ( err, stat ) {
			if ( stat && stat.isDirectory() ) {
				info.isDir = true;
				finish ();
			} else if ( stat && stat.isSymbolicLink() ) {
				fs.readlink( localPath, function ( err, localPath ) {
					if ( localPath )
						followSymLink( localPath );
					else
						finish();
				} );
			} else {
				finish();
			}
		});
	}


	function finish ( err ) {
		if ( err ) {
			throw new Error("STAT ERROR");
			callback( err );
		} else {
			info.type = !info.exists ? 'void' : info.isLink ? 'link' : info.isDir ? 'dir' : 'file';
			file.cache.stat = info;
			_.extend( file, info );
			callback( null, info );
		}
	}


}


LocalFile.prototype.readdir = function ( opt, cb ) {
	if ( 'function' == typeof opt ) {
		cb = opt;
		opt = {};
	}

	if ( 'object' != typeof opt )
		opt = {};

	var file = this,
		storage = file.storage;

	file.stat( function ( err ) {
		if ( err ) {
			cb( err );
			return;
		}

		if ( !file.isDir ) {
			cb( Errors.NotADir() );
			return;
		}

		fs.readdir( file.localPath, function ( err, files ) {
			if ( err ) {
				callback ( Errors( err ) );
				return;
			}

			if ( !storage.allowDotFiles )
				files = files.filter( function ( filename ) {
					return filename.substr(0,1) != '.';
				});


			async.map( files, function ( filename, cb ) {
				var fullPath = storage.pathToLocal( file.path, filename );
				fs.stat( fullPath, function ( err, stat ) {
					if ( err ) {
						console.log( "STAT ERR", err )
						cb( null, filename );
					} else if ( stat.isDirectory() ) {
						cb( null, filename+'/' );
					} else {
						cb( null, filename );
					}
				});
			}, cb );
		});
	}, true );
}

/*
LocalFile.prototype.listDirectory = function ( callback ) {
	var file = this,
		fileSource = file.router || file.storage;


	file.stat( function ( err, stat ) {
		if ( !stat.isDir ) {
			callback( {
				string: "Not a directory"
			});
			return;
		}

		fs.readdir( file.localPath, function ( err, files ) {
			if ( err ) {
				callback ( err );
				return;
			}

			files = files.filter( function ( filename ) {
				return filename.substr(0,1) != '.';
			});

			files = files.map( function ( name ) {
				return fileSource.file( file.path.append( name ) );
			});

			callback ( null, files );
		});
	}, true );
}
*/

LocalFile.prototype.mkdir = function ( cb )
{
	cb = cb || new Function();

	var file = this,
		path = file.storage.pathToLocal( file.path );

	if ( !file.path.isDir ) {
		path = pathlib.dirname( path );
	}

	mkdirp( path, function ( err ) {
		if ( err )
			cb( LocalFile.Errors.MKDirFile( err ) );
		else
			cb();
	} );
}


LocalFile.prototype.localize = function ( callback )
{
	var file = this;

	if ( file.localPath ) {
		callback( null, file.localPath );
	} else {
		file.stat( function ( err ) {
			if ( file.localPath ) {
				callback( null, String( file.localPath ) );
			} else {
				callback( LocalFile.Errors.NoLocalPath() );
			}
		} );
	} 
}

//	-----
//	Store
//	-----

LocalFile.prototype.storeData = function ( data, opt, cb ) {
	var json = JSON.stringify( data );
	var buffer = new Buffer( json, 'utf8' );

	this.store( buffer, opt, cb );
}

LocalFile.prototype.store = function ( source, options, cb ) 
{
	if ( 'function' == typeof options ) {
		cb = options;
		options = {};
	} 

	options = options || {};
	options.recurse = options.recurse != false;

	var dest = this,
		localPath = dest.localPath;

	dest.cache = {};

	if ( source instanceof stream.Readable ) {
		fromStream( source, cb );
		return;
	}

	if ( source instanceof Buffer ) {
		fromBuffer( source, cb );
		return;
	}

	if ( source instanceof File ) {
		fromFile( source, cb );
		return;
	}

	if ( 'string' == typeof source ) {
		fromBuffer( new Buffer( source ), cb );
		return;
	}

	cb( Errors.InvalidSource() );

	function fromFile ( source, cb ) {
		async.series( [
			dest.stat.bind( dest ),
			localizeSource,
			unlinkExisting,
			dest.mkdir.bind( dest ),
			copy,
			setMtime,
			dest.stat.bind( dest ),
			emitChange
		], cb );

		var sourceLocalPath;
		function localizeSource ( cb ) {
			source.localize( function ( err, path ) {
				if ( err )
					cb( err );
				else {
					sourceLocalPath = path;
					cb();
				}
			});
		}

		function unlinkExisting ( cb ) {
			if ( dest.isFile || !source.isDir || !options.merge ) {
				dest.unlink( cb );
			} else {
				cb();
			}

		}

		function copy ( cb ) {

			//console.warn ( "copy", source, source.path.isDir );

			if ( source.path.isDir ) {
				if ( options.recurse ) {
					var sourcePath = String( source.path );
					var subOpt = _.clone(options);
					subOpt.recurse = false;


					var iter = source.walk( {
						dirs: false
					});

					iter.process( function ( file, cb ) {
						//console.warn( "COPY WALK", file );
						var subPath = String(file.path);
						


						if ( subPath.substr( 0, sourcePath.length ) !== sourcePath ) {
							throw new Error ( "Unknown file in walk")
						} 
						subPath = subPath.substr( sourcePath.length );

						//console.warn( "COPY WALK", sourcePath, file.path, subPath );

						var subDest = dest.file( subPath );
						subDest.store( file, subOpt, function ( err ) {
							cb( err );
						});
					});

					iter.on( 'error', function ( e ) {
						cb( e || true );
					});
					iter.on( 'complete', function () {
						cb();
					});

				} else {
					// We've already created the directory, so that's enough.
					cb();
				}
			} else if ( options.link ) {
				var linkTo = String( source.localPath );
				var linkFrom = String( dest.localPath );
				//linkFrom = pathlib.dirname( linkFrom );
				//var linkPath = pathlib.relative( linkFrom, linkTo );

				fs.symlink( linkTo, dest.localPath, function ( err ) {
					cb( err );
				} );
			} else if ( source.isLink ) {
				var linkTo = String( source.linkPath );
				var linkFrom = String( dest.path );
				linkFrom = pathlib.dirname( linkFrom );

				var linkPath = pathlib.relative( linkFrom, linkTo );
				fs.symlink( linkPath, dest.localPath, function ( err ) {
					cb( err );
				} );
			} else {
				fromLocalFile( sourceLocalPath, cb );
			}
		}

	}

	function fromLocalFile( sourceLocalPath, cb ) {
		if ( options.move ) {
			fs.move ( sourceLocalPath, dest.localPath, function ( err ) {
				if ( err ) {
					cb( LocalFile.Errors.CopyFail( err ) );
					return;
				}
				cb();
			} );				
		} else {
			fs.copy ( sourceLocalPath, dest.localPath, function ( err ) {
				if ( err ) {
					cb( LocalFile.Errors.CopyFail( err ) );
					return;
				}
				cb();
			} );				
		}
	}

	function checkIsDir ( cb ) {
		if ( dest.isDir ) {
			cb ( LocalFile.Errors.FileIsDir() );
		} else {
			cb ();
		}
	}

	function fromBuffer ( data, cb ) {
		async.series( [
			dest.stat.bind( dest ),
			checkIsDir,
			dest.mkdir.bind( dest ),
			writeBuffer,
			setMtime,
			emitChange
		], cb );

		function writeBuffer ( cb ) {
			fs.open( dest.localPath, "w", function ( err, fd ) {
				if ( err ) {
					cb( err );
					return;
				}

				fs.write ( fd, data, 0, data.length, 0, function ( err, numBytes ) {
					fs.close( fd, function () {
						if ( err )
							cb( err );
						else
							cb();					
					});
				} );
			} );
		}
	}

	function fromStream ( stream, cb ) {
		async.series( [
			dest.stat.bind( dest ),
			checkIsDir,
			dest.mkdir.bind( dest ),
			writeStream,
			setMtime,
			emitChange
		], cb );



		function writeStream ( cb ) {
	 		if ( true || options.writeDirect ){
				var writeStream = fs.createWriteStream( localPath );
				stream.pipe( writeStream );

			}

			stream.on( 'error', function ( err ) {
				cb( err );
			});
			
			stream.once('end', function() {
				dest._bytesWritten = writeStream.bytesWritten;
				dest._writtenAt = new Date().getTime();
				cb();
			});
		}
	}

	function setMtime ( cb ) {
		if ( options.mtime ) {
		
			fs.lstat( localPath, function ( err, stat ) {
				setTimeout( function () { 
					if ( err ) {
						cb( err );
						return;
					}

					fs.utimes( localPath, stat.atime, options.mtime, function ( err ) {
						cb( err );
					});
				}, COOLDOWN );
			} );
			
		} else {
			cb();
		}
	}

	function emitChange ( cb ) {
		dest.touch();
		dest.cache = {};
		cb();
	}

}

LocalFile.prototype.unlink = function ( opt, cb ) 
{
	if ( 'function' == typeof opt ) {
		cb = opt;
		opt = {};
	}

	var file = this;
	if ( file.localPath )
		rimraf( file.localPath, function ( err ) {
			if ( err ) {
				file.logError( 'unlink' );
				cb ( LocalFile.Errors.UnlinkFail( err ) )
			} else
				cb ();
		} );
	else
		cb ( LocalFile.Errors.InvalidPath() )
}

LocalFile.prototype.readStream = function ( opt, cb ) {
	if ( 'function' == typeof opt ) {
		cb = opt;
		opt = {};
	}

	var file = this;

	file.stat( function ( err, stat ) {
		if ( err )
			return cb( err );

		if ( !stat.isFile )
			return cb( Errors.NotAFile( file ) );

		try {
			var stream = fs.createReadStream( file.localPath, opt );
			cb( null, stream );	
		} catch ( err ) {
			cb ( err );
		}
	});	
}

LocalFile.prototype.readString = function ( opt, cb )
{
	if ( 'function' == typeof opt ) {
		cb = opt;
		opt = {};
	}

	var file = this;

	file.stat( function ( err ) {
		if ( err )
			return cb( err );

		if ( !file.isFile )
			return cb( Errors.NotAFile( file ) );

		fs.readFile( file.localPath, { encoding: 'utf8' }, function ( err, data ) {
			if ( err )
				return cb( err );

			cb ( null, data );
		});
	});
}


LocalFile.prototype.readData = function ( opt, cb )
{
	if ( 'function' == typeof opt ) {
		cb = opt;
		opt = {};
	}

	var file = this;

	file.stat( function ( err, stat ) {
		if ( err )
			return cb( err );

		if ( !stat.isFile ) {
			return cb( Errors.NotAFile( file ) );
		}

		fs.readFile( file.localPath, { encoding: 'utf8' }, function ( err, data ) {
			if ( err )
				return fail( err );

			try {
				data = JSON.parse( data );
			} catch ( e ) {
				return cb( Errors.BadJSON() );
			}

			cb ( null, data );
		});
	});
}

LocalFile.prototype.log = function ()
{
	if ( this.storage && this.storage.log )
		this.storage.log.apply( this.storage, arguments );
}
