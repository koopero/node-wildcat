var
	_ = require('underscore'),
	async = require('async'),
	extend = require('extend'),
	streamifier = require('streamifier'),
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

function HTTPFile () {
	File.apply( this, arguments );
}


HTTPFile.prototype.url = function ( opt, cb ) {
	if ( 'function' == typeof opt ) {
		cb = opt;
		opt = {};
	}

	var file = this,
		storage = file.storage,
		router = file.router;

	return router.url( file ) || storage.url( file );
}

HTTPFile.prototype.request = function ( opt, cb ) {
	if ( 'function' == typeof opt ) {
		cb = opt;
		opt = {};
	}

	//console.warn( "HTTPFile.request", opt );

	var remote = this,
		http = remote.storage,
		url = remote.path;

	http.request( url, opt, cb );
};

HTTPFile.prototype.exists = function ( opt, cb ) {
	if ( 'function' == typeof opt ) {
		cb = opt;
		opt = {};
	}

	var file = this,
		cache = file.cache;

	if ( !opt.noCache ) {
		if ( cache.stat ) {
			cb( null, cache.stat.exists );
			return;
		} else if ( cache.exists !== undefined ) {
			cb( null, cache.exists );
			return;
		}
	}

	file.stat( opt, function ( err, stat ) {
		cb( err, stat && stat.exists );
	});
}

HTTPFile.prototype.stat = function ( opt, cb ) {
	if ( 'function' == typeof opt ) {
		cb = opt;
		opt = {};
	}

	var remote = this,
		http = remote.storage;

	if ( !opt.noCache && remote.cache.stat ) {
		cb( null, remote.cache.stat );
		return;
	}

	remote.request( { method: 'HEAD' }, function ( err, status, headers, content ) {
		if ( err ) {
			cb( err );
			return;
		}

		var stat = {};

		switch ( status ) {
			case 404:
				stat.exists = false;
			break;

			case 301:
				var redirectPath = http.pathFromUrl( headers['location'] );

				if ( !redirectPath ) {
					cb( HTTPFile.Errors.BadRedirect() );
					return;
				}

				stat.path = redirectPath;
				remotePath = stat.path;
				//console.log( "Bouncing To ", headers['location'], remotePath );
				getRemoteInfo( cb, stat );
				return;

			case 302:
				stat.type = 'link';
				var redirectPath = http.pathFromUrl( headers['location'] );

				if ( !redirectPath ) {
					cb( HTTPFile.Errors.BadRedirect() );
					return;
				}

				stat.linkPath = http.pathFromUrl( headers['location'] );
			break;

			case 200:
				stat.exists = true;
			break;

			default:
				cb( HTTPFile.Errors.UnknownStatus( status ) );
				return;
			break;
		}

		//console.warn( "HTTPFile.stat", headers );
		
		stat.type = headers['wildcat-type'];
		if ( 'last-modified' in headers )
			stat.mtime = new Date( headers['last-modified'] )

		stat.isLink = stat.type == 'link';
		stat.isDir  = stat.type == 'dir';
		stat.isFile = stat.exists && !stat.isLink && !stat.isDir;

		if ( stat.isFile ) {
			stat.size = parseInt( headers['content-length'] );
		}

		stat.url = http.url( stat.path || remote.path );

		remote.cache.stat = stat;

		cb( null, stat );
	});
}

HTTPFile.prototype.readString = function ( opt, cb ) {
	if ( 'function' == typeof opt ) {
		cb = opt;
		opt = {};
	}

	var file = this;

	file.request( { }, function ( err, status, headers, content ) {
		cb( err, content );
	});	
}

HTTPFile.prototype.readData = function ( opt, cb ) {
	if ( 'function' == typeof opt ) {
		cb = opt;
		opt = {};
	}

	var file = this;

	file.request( { json: true }, function ( err, status, headers, content ) {
		cb( err, content );
	});
}


HTTPFile.prototype.storeBuffer = function ( buffer, opt, cb ) {
	var file = this;
	file.storeStream( streamifier.createReadStream( buffer ), opt, cb );
}

HTTPFile.prototype.storeStream = function ( stream, opt, cb ) {
	var file = this;

	file.request( { 
		method: 'PUT',
		writeStream: stream
	}, function ( err, status, headers ) {
		cb( err );
	} );
}



HTTPFile.prototype.remoteStore = function ( source, options, cb ) 
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

HTTPFile.prototype.remoteReadString = function ( opt, cb ) {
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





HTTPFile.prototype.readdir = function ( cb ) {
	var remote = this,
		http = remote.storage;


	remote.request( {
		json: true,
		query: {
			action: 'readdir'
		}
	}, onRemoteReadDir );

	function onRemoteReadDir ( err, status, headers, listing ) {
		// TODO: Better handling or response here
		if ( Array.isArray ( listing ) ) {
			cb( null, listing );
		}
	}
}

HTTPFile.prototype.inspect = function ()
{
	return [ 
		'[HTTP',
		( this.stream ? this.stream.name : '' ),
		( this.storage ? this.storage.urlBase : '' ),
		this.path.str
	].join(':')+']';
}

