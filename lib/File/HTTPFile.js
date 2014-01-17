var
	_ = require('underscore'),
	async = require('async'),
	extend = require('extend'),
	Errors = require('../Errors.js'),
	File = require('../File.js'),
	Path = require('../Path.js'),
	util = require('util');

module.exports = HTTPFile;

util.inherits( HTTPFile, File );


HTTPFile.Constants = {
	// Maximum difference between remote and local mtime for files to be in sync.
	// In milliseconds.
	TimeFudge: 10000 
}

function HTTPFile ( path ) {
	this.path = Path( path );
}

HTTPFile.prototype.request = function ( opt, cb ) {
	if ( 'function' == typeof opt ) {
		cb = opt;
		opt = {};
	}

	var remote = this,
		http = remote.storage,
		url = remote.path;

	http.request( url, opt, cb );
};

HTTPFile.prototype.getInfo = function ( cb, useExisting ) {
	var remote = this,
		local = remote.local,
		http = remote.storage,
		remotePath = remote.path;

	if ( remote.info && useExisting ) {
		cb ( null, remote.info );
		return;
	}

	async.parallel( [
		getRemoteInfo,
		getLocalInfo
	], function ( err, results ) {
		if ( err ) {

			console.log ( "HTTPfile Err", err );
			cb( err );
		} else {
			var info = mergeResults( results[0], results[1] );
			cb( null, info );
		}
	});


	function getRemoteInfo ( cb, previous ) {

		http.request( remotePath, { method: 'HEAD' }, function ( err, status, headers, content ) {
			if ( err ) {
				cb( err );
				return;
			}

			var info = previous || {};

			switch ( status ) {
				case 404:
					info.exists = false;
				break;

				case 301:
					var redirectPath = http.pathFromUrl( headers['location'] );

					if ( !redirectPath ) {
						cb( HTTPFile.Errors.BadRedirect() );
						return;
					}

					info.path = redirectPath;
					remotePath = info.path;
					console.log( "Bouncing To ", headers['location'], remotePath );
					getRemoteInfo( cb, info );
					return;

				case 302:
					info.type = 'link';
					var redirectPath = http.pathFromUrl( headers['location'] );

					if ( !redirectPath ) {
						cb( HTTPFile.Errors.BadRedirect() );
						return;
					}

					info.linkPath = http.pathFromUrl( headers['location'] );
				break;

				case 200:
					info.exists = true;
				break;

				default:
					cb( true );
					return;
				break;
			}


			
			info.type = headers['wildcat-type'];
			if ( 'last-modified' in headers )
				info.mtime = new Date( headers['last-modified'] )



			info.isLink = info.type == 'link';
			info.isDir  = info.type == 'dir';
			info.isFile = info.exists && !info.isLink && !info.isDir;

			if ( info.isFile ) {
				info.size = parseInt( headers['content-length'] );
			}

			info.url 	= http.url( info.path || remote.path );


			cb( null, info );
		});
	}

	function getLocalInfo ( cb ) {
		local.getInfo( cb );
	}

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

HTTPFile.prototype.store = function ( source, options, cb ) 
{
	if ( 'function' == typeof options ) {
		cb = options;
		options = {};
	} 

	options = options || {};
	options.recurse = options.recurse != false;

	var dest = this,
		local = dest.local;

	options.direct = true;

	local.store( source, options, function ( err ) {
		if ( err ) {
			cb( err );
			return;
		}

		dest.sync( {
			'upload': true
		}, cb );
	});

}

HTTPFile.prototype.readString = function ( opt, cb ) {
	var file = this,
		local = file.local;

	if ( 'function' == typeof opt ) {
		cb = opt;
		opt = {};
	}

	file.sync ( {

	}, function ( err, info ) {
		if ( err ) {
			cb( err );
			return;
		}

		file.local.readString( opt, cb );
	});
}

HTTPFile.prototype.readData = function ( opt, cb ) {
	var file = this,
		local = file.local;

	if ( 'function' == typeof opt ) {
		cb = opt;
		opt = {};
	}

	file.sync ( {

	}, function ( err, info ) {
		if ( err ) {
			cb( err );
			return;
		}

		file.local.readData( opt, cb );
	});
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

HTTPFile.prototype.readdir = function ( cb ) {
	var remote = this,
		local = remote.local,
		http = remote.storage;

	async.parallel( [ 
		fromRemote,
		fromLocal
	], function ( err, results ) {
		var result = mergeResults( results );
		cb( null, result );
	} );

	function fromRemote ( cb ) {
		http.request( remote.path, { json: true }, function ( err, status, headers, content ) {
			cb( null, Array.isArray( content ) && content );
		});
	}

	function fromLocal ( cb ) {
		local.readdir( function ( err, listing ) {
			if ( err ) {
				cb();
			} else {
				cb( null, listing );
			}
		});
	}

	function mergeResults ( results ) {
		var ret = [];
		_.each( results, function ( result ) {
			if ( Array.isArray( result ) )
				ret = _.union( ret, result );
		});
		return ret;
	}
	
}