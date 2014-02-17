var
	_ = require('underscore'),
	async = require('async'),
	extend = require('extend'),
	Errors = require('../Errors.js'),
	File = require('../File.js'),
	Path = require('../Path.js'),
	util = require('util');

module.exports = RemoteFile;

util.inherits( RemoteFile, File );


function RemoteFile () {
	File.apply( this, arguments );
}

//	--------
//	Wrappers
//	--------

RemoteFile.prototype.exists = function ( cb ) {
	var file = this;
}

RemoteFile.prototype.stat = function ( callback, useExisting ) {
	var remote = this,
		local = this.local,
		info = {};

	async.parallel( [
		function ( cb ) {
			remote.remoteStat( opt, function ( err, stat ) {
				if ( err )
					cb ( err )
				else {
					info.remoteStat( )
				}
			} );
		},
		function ( cb ) {
			local.stat( opt, function ( err, stat ) {

			} );
		}
	], mergeResults );


	function mergeResults ( rem, loc ) {
		remote.httpInfo = rem;
		remote.localInfo = loc;

		var info = { remoteInfo: rem, localInfo: loc },
			sync = true,
			remTime = rem.mtime ? new Date( rem.mtime ).getTime() : 0,
			locTime = loc.mtime ? new Date( loc.mtime ).getTime() : 0,
			remoteIsNewer = remTime > locTime,
			newTime = remoteIsNewer ? rem.mtime : loc.mtime;



		sync = sync && Math.abs( remTime - locTime ) < HTTPFile.Constants.TimeFudge; 
		sync = sync && rem.isDir == loc.isDir && rem.isLink == loc.isLink && rem.isFile == loc.isFile;
		sync = sync && rem.size == loc.size;

		if ( remoteIsNewer )
			extend( info, loc, rem );
		else
			extend( info, rem, loc );

		info.synced = sync;

		return info;
	}

}


RemoteFile.prototype.readdir = function ( opt, cb ) {
	if ( 'function' == typeof opt ) {
		cb = opt;
		opt = {};
	}

	if ( 'object' != typeof opt )
		opt = {};

	var remote = this,
		local = this.local;

	Log ( "RemoteFile.readdir", remote );

	remote.remoteReaddir( opt, cb );
}


RemoteFile.prototype.listDirectory = function ( callback ) {
/*	var file = this,
		router = file.router;


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
				return router.file( file.path.append( name ) );
			});

			callback ( null, files );
		});
	}, true );
*/
}

RemoteFile.prototype.mkdir = function ( callback )
{
/*
	var file = this,
		path = file.storage.pathToLocal( file.path );

	if ( !file.path.isDir ) {
		path = pathlib.dirname( path );
	}
*/
}


RemoteFile.prototype.localize = function ( callback )
{
/*
	var file = this;

	if ( file.localPath ) {
		callback( null, file.localPath );
	} else {
		file.getInfo( function ( err ) {
			if ( file.localPath ) {
				callback( null, String( file.localPath ) );
			} else {
				callback( RemoteFile.Errors.NoLocalPath() );
			}
		} );
	} 
*/
}

RemoteFile.prototype.store = function ( source, options, cb ) 
{
/*	if ( 'function' == typeof options ) {
		cb = options;
		options = {};
	} 

	options = options || {};
	options.recurse = options.recurse != false;

	var dest = this,
		localPath = dest.localPath;

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
*/

}

RemoteFile.prototype.unlink = function ( opt, cb ) 
{
/*	if ( 'function' == typeof opt ) {
		cb = opt;
		opt = {};
	}

	var file = this;
*/
}

RemoteFile.prototype.readStream = function ( opt, cb ) {
/*	if ( 'function' == typeof opt ) {
		cb = opt;
		opt = {};
	}

	var file = this;
*/
}

RemoteFile.prototype.readString = function ( opt, cb )
{
/*
	if ( 'function' == typeof opt ) {
		cb = opt;
		opt = {};
	}

	var file = this;
*/
}


RemoteFile.prototype.readData = function ( opt, cb )
{

}

HTTPFile.prototype.sync = function ( opt, cb ) {
	var file = this,
		local = file.local;

	if ( 'function' == typeof opt ) {
		cb = opt;
		opt = {};
	}



	file.getInfo ( function ( err ) {
		if ( err ) {
			cb ( err );
			return;
		}

		if ( opt.upload ) {
			upload( cb );
		} else {
			download( cb );
		}

	});

	function download ( cb ) {
		
		file.request( { readStream: true }, function ( err, status, header, content ) {
			if ( err ) {
				cb( err );
				return;
			}

			local.store( content, function ( err ) {
				cb( err );
			});
		} );
	}

	function upload ( cb ) {
		//console.log( "upload", file.url, local.localPath );
		local.readStream( function ( err, stream ) {
			file.request( { 
				method: 'PUT',
				writeStream: stream 
			}, function ( err, status, header, content ) {
				cb( err );
			} );
		} );
	}
}
