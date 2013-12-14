var 
	async 			= require('async'),
	pathlib 		= require('path'),
	urllib 			= require('url'),
	fs 				= require('fs.extra'),
	os 				= require('os'),
	templib 		= require('temp'),
	rimraf  		= require('rimraf'),
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
	MoveFail: true
});

function LocalFile ( path ) {
	this.path = Path( path );
}

LocalFile.prototype.getInfo = function ( callback, useExisting ) {
	var that = this;

	if ( this.gotInfo && useExisting ) {
		if ( callback ) {
			callback( null, that );
		}
		return;
	}

	if ( !that.localPath ) {
		that.localPath = that.storage.pathToLocal ( that.path );
	}

	if ( !callback )
		callback = function () {};

	that.isLink = false;

	// This is recursive to allow following of symlinks to their ultimate destination.
	function readStat ( localPath ) {
		fs.lstat( localPath, function ( err, stat ) {
			if ( err ) {
				that.exists = false;
				callback ( null, that );
			} else {
				if ( stat.isSymbolicLink() ) {
					that.isLink = true;
					fs.readlink( localPath, function ( err, linkString ) {
						if ( err ) {
							that.exists = false;
							callback( null, that );
						} else {
							var link = pathlib.resolve( pathlib.dirname( localPath ), linkString );
							if ( !that.storage.allowOutsideSymlinks 
								&& link.substr( 0, that.storage.localPath.length ) != that.storage.localPath
							) {
								that.exists = false;
								callback( null, that );
							}

							that.linkFile = link;
							readStat( that.linkFile );
						}
					} );
				} else {
					that.gotInfo = true;
					that.isDir = stat.isDirectory();
					that.isFile = stat.isFile();
					that.mtime = stat.mtime;
					that.exists = that.isDir || that.isFile;
					that.size = stat.size;

					if ( that.isDir && !that.path.isDir ) {
						that.path = that.path.trailingSlash();
					}

					callback( null, that );
				}
			}
		});
	} 

	readStat ( that.localPath );
}

LocalFile.prototype.exists = function ( callback ) {
	var that = this;

	var callbackWithInfo = function () {
		callback( that.exists );
	}

	if ( this.exists === undefined ) {
		process.nextTick ( callbackWithInfo );
	} else {
		this.getInfo ( callbackWithInfo );
	}
}

LocalFile.prototype.sendFile = function ( request, response, callback, options )
{
	var that = this;
	that.getInfo( function () {
		response.sendfile( that.localPath );
	});
}

LocalFile.prototype.readdir = function ( cb ) {
	var file = this,
		storage = file.storage;

	file.getInfo( function ( err ) {
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

						cb( null, fullPath );
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


LocalFile.prototype.listDirectory = function ( callback ) {
	var file = this;
	file.getInfo( function ( err ) {
		if ( !file.isDir ) {
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
				return file.storage.getFile( file.path.append( name ) );
			});

			callback ( null, files );
		});
	}, true );
}

LocalFile.prototype.mkdir = function ( callback )
{
	var file = this,
		path = file.storage.pathToLocal( file.path );

	if ( !file.path.isDir ) {
		path = pathlib.dirname( path );
	}

	mkdirp( path, function ( err ) {
		if ( err )
			callback( LocalFile.Errors.MKDirFile( err ) );
		else
			callback();
	} );
}


LocalFile.prototype.localize = function ( callback )
{
	var file = this;

	if ( file.localPath ) {
		callback( null, file.localPath );
	} else {
		file.getInfo( function ( err ) {
			if ( file.localPath ) {
				callback( null, String( file.localPath ) );
			} else {
				callback( LocalFile.Errors.NoLocalPath() );
			}
		} );
	} 
}

LocalFile.prototype.store = function ( source, options, cb ) 
{
	if ( 'function' == typeof options ) {
		cb = options;
		options = {};
	} 

	options = options || {};
	options.recurse = options.recurse != false;

	var dest = this;

	if ( source instanceof Buffer ) {
		fromBuffer( source, cb );
		return;
	}

	if ( source instanceof File ) {
		fromFile( source, cb );
		return;
	}

	cb( Errors.InvalidSource() );

	function fromFile ( source, cb ) {
		async.series( [
			dest.getInfo.bind( dest ),
			localizeSource,
			unlinkExisting,
			dest.mkdir.bind( dest ),
			copy,
			dest.getInfo.bind( dest ),
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
			if ( source.isDir ) {
				if ( options.recurse ) {
					throw new Error ( 'Not implemented' );
				} else {
					// We've already created the directory, so that's enough.
					cb();
				}
			} else if ( options.move ) {
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


		function emitChange ( cb ) {
			cb();
		}
	}

	function fromBuffer ( data, cb ) {
		async.series( [
			dest.getInfo.bind( dest ),
			checkIsDir,
			dest.mkdir.bind( dest ),
			writeBuffer,
			emitChange
		], cb );

		function checkIsDir ( cb ) {
			if ( dest.isDir ) {
				cb ( LocalFile.Errors.FileIsDir() );
			} else {
				cb ();
			}
		}

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

	function emitChange ( cb ) {
		cb();
	}

}

LocalFile.prototype.unlink = function ( cb ) 
{
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

LocalFile.prototype.readData = function ( callback )
{
	var that = this;

	that.getInfo( function ( err ) {
		if ( err )
			return fail( err );

		if ( !that.isFile )
			return fail( Errors.NotAFile( that ) );

		fs.readFile( that.localPath, { encoding: 'utf8' }, function ( err, data ) {
			if ( err )
				return fail( err );

			try {
				data = JSON.parse( data );
			} catch ( e ) {
				return fail( Errors.BadJSON() );
			}

			success ( data );
		});
	});

	function success ( data ) {
		callback ( null, data );
	}

	function fail ( error ) {
		console.log ( "ERROR IS ", error );
		callback ( error );
	}
}

LocalFile.prototype.log = function ()
{
	if ( this.storage && this.storage.log )
		this.storage.log.apply( this.storage, arguments );
}
