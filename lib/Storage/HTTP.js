var
	async = require('async'),
	extend = require('extend'),
	util = require('util'),
	httplib = require('http'),
	urllib = require('url'),
	Storage = require('../Storage.js'),
	Errors = require('../Errors.js'),
	Filesystem = require('./Filesystem.js'),
	File = require('../File.js'),
	HTTPFile = require('../File/HTTPFile.js'),
	Log = require('../Log.js'),
	Utils = require('../Utils.js'),
	Path = require('../Path.js');

util.inherits( HTTP, Storage );

module.exports = HTTP;

HTTP.Errors = Errors.List( {
	ServerBadTime: true,
	ServerBadRoot: true,
	ServerNotFound: true,
	RedirectLoop: true,

});

function HTTP ( config ) 
{
	var http = this;
	if ( 'string' == typeof config )
		config = { url: config };

	if ( !config.localPath ) {
		config.localPath = 'tmp:/./wildcat-http';
	}

	http.config = config;
	http.urlBase = config.url;
	http.sync = 'down';
	http.timeOffset = 0;
}

HTTP.prototype.init = function ( cb )
{
	var http = this,
		config = http.config,
		dotWildcatUrl;
		

	http.requestOptions = {
		auth: "user:password"
	};

	async.series( [
		checkServer,
		getServerConfig,
		createLocal
	], cb );

	function checkServer ( cb ) {
		http.request( '/', { method: "HEAD" }, function ( err, status, header ) {
			if ( err ) {
				//console.log( err );
				cb ( HTTP.Errors.ServerNotFound( err ) );
				return;
			}

			/*
			if ( status != 200 ) {
				console.warn ( "checkServer", status, header );
				cb( HTTP.Errors.ServerNoRoot() )
				return;
			}
			*/

			dotWildcatUrl = header['wildcat'];
			if ( !dotWildcatUrl ){
				cb( HTTP.Errors.ServerNotWildcat () );
				return;
			}

			var serverTime = new Date ( header['date'] ),
				myTime = new Date (),
				acceptableTimeOffset = 20 * 1000;

			if ( Math.abs( serverTime.getTime() - myTime.getTime() ) > acceptableTimeOffset ) {
				cb( HTTP.Errors.ServerBadTime () );
				return;
			}

			cb();
		});
	}

	function getServerConfig ( cb ) {
		http.request( urllib.parse( dotWildcatUrl ), { json: true }, function ( err, status, header, serverConfig ) {
			if ( !serverConfig ) {
				cb( HTTP.Errors.ServerNotWildcat () );
				return;
			}

			http.serverConfig = serverConfig;

			var url = urllib.parse( http.urlBase );
			var serverUrl = urllib.parse( serverConfig.url || serverConfig.storage.url );

			url.host = serverUrl.host;
			url.hostname = serverUrl.hostname;
			url.port = serverUrl.port;

			// TODO: Set this up to do subpaths within the server.
			

			http.urlBase = urllib.format( url );


			cb()
		} );
	}

	function createLocal ( cb ) {
		http.local = new Filesystem( config );
		http.local.init ( function ( err ) {
			if ( err ) throw err;
			http.localPath = http.local.localPath;
			cb();
		} );
	}

}

HTTP.prototype.url = function ()
{
	var 
		http = this,
		path = '',
		i = 0, k = arguments.length;

	for ( ; i < k; i ++ ) {
		var arg = arguments[i];
		if ( arg === undefined )
			continue;

		if ( arg instanceof File )
			arg = arg.path;

		if ( arg instanceof Path )
			arg = String ( arg );

		if ( 'string' != typeof arg ) {
			console.warn ( arg );
			throw Errors.NoPath( 'Argument must be string or Path');
		}
			

		// Trim leading slash
		while ( arg.substr( 0, 1 ) == '/' )
			arg = arg.substr( 1 ); 

		if ( i == k - 1 ) {
			path += arg;
		} else {
			while ( arg.substr( -1 ) == '/' )
				arg = arg.substr( 0, arg.length - 1 );

			path += arg;
			path += '/';
		}
	}


	return  http.urlBase + escape( path );
}

HTTP.prototype.file = function ( path )  {
	if ( path instanceof File ) 
		path = path.path;

	var 
		http = this,
		file = new HTTPFile ( path );

	file.storage = http;
	//file.local = http.local.file( path );

	return file;
}



HTTP.prototype.pathFromUrl = function ( url ) {
	var http = this;

	if ( url.substr( 0, http.urlBase.length ) == http.urlBase ) {
		return Path.leadingSlash( url.substr( http.urlBase.length ) );
	}
}

HTTP.prototype.request = function ( path, options, cb ) {
	var http = this;
	var url;

	if ( path instanceof Path || 'object' != typeof path )
		url = urllib.parse( http.url( path ) );
	else if ( 'object' == typeof path )
		url = path;


	var opt = extend( {}, options );
	extend( opt, http.requestOptions );	

	return HTTP.request( url, options, cb );
}

HTTP.prototype.close = function ( cb ) {
	var http = this,
		local = http.local;

	local.close( cb );
}

HTTP.request = function ( url, options, cb ) {

	//console.log ( 'request', url );
	if ( 'function' == typeof options ) {
		cb = options;
		options = {};
	}

	if ( 'string' == typeof url )
		url = urllib.parse( url, true );

	var opt = extend( true, url, options );

	opt.method = opt.method || 'GET';

	// Reparse to get proper path with query eg path: /?query=foo
	var reparse = urllib.parse( urllib.format( opt ) );
	opt.path = reparse.path;

	//console.warn( "http", opt.method, urllib.format( opt ) );

	
	var req = httplib.request( opt, function ( res ) {
		//console.log( "res" );
		var headers = res.headers,
			contentType = headers['content-type'];

		if ( ( opt.followRedirect || opt.followRedirects ) &&
			res.statusCode >= 300 &&
			res.statusCode < 400 
		) {
			if ( opt._redirectsLeft === 0 ) {
				cb( HTTP.Errors.RedirectLoop(), res.statusCode, res.headers );
				return;
			} else if ( !opt._redirectsLeft ) {
				opt._redirectsLeft = 2; // Shitty magic number
			} else {
				opt._redirectsLeft--;
			}

			var redirectTo = urllib.resolve( url, headers.location );
			extend( opt, urllib.parse( redirectTo ) );
			
			process.nextTick( function () {
				HTTP.request( redirectTo, opt, cb );
			});

			return;
		}

		if ( options.json 
			&& !Utils.Str.startsWith( contentType, 'application/json' )
			&& !Utils.Str.startsWith( contentType, 'text/json' )
		) {
			cb( Errors.BadJSON(), res.statusCode, res.headers, null );
			req.abort();
			return;
		}

		if ( options.readStream ) {
			cb( null, res.statusCode, res.headers, res );
			return;
		} else {
			var data ='';
			res.setEncoding( 'utf8' );
			res.on('data', function ( chunk ) {
				data += chunk;
			});
			res.on('end', function () {
				if ( options.json ) {
					try {
						data = JSON.parse( data );
					} catch ( err ) {
						cb( Errors.BadJSON(), res.statusCode, res.headers, null );
					}
				}

				cb( null, res.statusCode, res.headers, data );	
			})			
		}
	});

	req.on('error', function (err) {
		console.log( "Request Error" );
		cb( err );
	});

	if ( opt.writeStream ) {
		opt.writeStream.pipe( req );
	} else {
		if ( opt.write ) {
			req.write( opt.write, opt.encoding || 'utf8' );
		}
		req.end();
	}
	
}


