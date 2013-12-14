var 
	_ = require('underscore'),
	async 	= require('async'),
	express = require('express'),
	os  	= require('os'),
	urllib  = require('url'),
	Errors  = require('./Errors.js'),
	Path 	= require('./Path.js');

module.exports = Server;

function Server ( config ) {
	if ( this.constructor != Server )
		return new Server( config ); 

	this.config = config;
}

Server.prototype.init = function ( cb )
{
	var server = this,
		config = server.config;

	server.version = require('./Wildcat.js').version;

	async.series( [
		listen
	], cb );

	function listen ( cb ) {
		if ( config.listen ) {
			server.listen( config.listen, cb );
		} else {
			cb();
		}
	}
}

Server.prototype.url = function () {
	var 
		server = this,
		path = '',
		i = 0, k = arguments.length;

	for ( ; i < k; i ++ ) {
		var arg = arguments[i];
		if ( arg instanceof Path )
			arg = String ( arg );

		if ( 'string' != typeof arg ) {
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


	return server.urlBase + path;
}

Server.prototype.middleware = function ()
{
	var 
		server = this,
		status = {},
		statusCode = 200,
		router = server.router;

	return function ( req, res ) {

		var 
			path = req.path,
			file,
			meta;

		switch ( req.method ) {
			case 'HEAD':
			case 'GET':
				async.series ( [
					sendSpecials,
					findFile,
					fileExists,
					getMeta,
					setHeaders,
					doRedirect,
					sendIndex,
					sendFile
				], finish );
			break;

			case 'PUT':
				async.series ( [
					sendSpecials,
					findFile,
					storeFileFromReq,
					sendStatus
				], finish );
			break;

		}


		function sendSpecials ( cb ) {
			res.set("X-Powered-By", "wildcat@"+server.version );
			res.set("Wildcat", server.url('.wildcat') );

			if ( req.path == '/.wildcat' ) {
				res.send( router.publicConfig() );
			} else {
				cb();
			}
		}
		
		function findFile ( cb ) {


			file = router.getFile( req.path );
			file.getInfo( function ( err ) {
				console.log( 'req', file.localPath );
				cb();
			});
		}


		function fileExists ( cb ) {
			if ( !file.exists ) {
				res.send( 404 );
				cb( true );
			} else
				cb();
		}

		function getMeta ( cb ) {
			file.getMeta( function ( err, fileMeta ) {
				if ( _.isObject( fileMeta ) ) {
					meta = fileMeta;
				}
				cb();
			} );
		}

		function doRedirect ( cb ) {
			if ( path != String( file.path ) ) {
				res.redirect( 301, server.url( file.path ) );
				cb( true );
			} else if ( file.isLink ) {
				res.redirect( 302, server.url( file.linkPath ) );
				cb( true );
			} else {
				cb();
			}
		} 

		function setHeaders ( cb ) {
			if ( meta ) {
				if ( meta.mimeType )
					res.set('Content-Type', meta.mimeType );

				if ( meta.md5 ) 
					res.set( 'Content-MD5', meta.md5 );

				if ( meta.type )
					res.set( 'Wildcat-Type', meta.type );

			}
			cb();
		}

		function sendIndex ( cb ) {
			if ( !file.isDir ) {
				cb();
				return;
			}

			file.readdir( function ( err, listing ) {
				if ( err ) {
					cb( err );
				} else {
					res.send( listing );
					cb( true );
				}
			});
		}

		function sendFile ( cb ) {
			if ( file.localPath ) {
				res.sendfile( file.localPath, cb );
			}
		}

		function storeFileFromReq ( cb ) {
			file.store( req, {}, function ( err ) {

			} );
			cb();
		}

		function sendStatus ( cb ) {

			statusFromFile( function ( err ) {
				if ( err )
					res.send( 500, "fucked up building status" );
				else
					res.send( statusCode, status );

				cb();
			})
			
			

			function statusFromFile ( cb ) {
				if ( file ) {
					file.getMeta( function ( err, meta ) {
						status.file = meta || { metaError: true };
						status.file.url = server.url( file.path );
						cb();
					});
				} else {
					cb();
				}
			}
		}

		function finish ( err ) {
			if ( err && err !== true ) {
				res.send( 500, "Server send nuthin");
			}
		}

	}
} 

Server.prototype.listen = function ( url, cb ) 
{
	var 
		server = this;

	if ( 'string' == typeof url )
		url = urllib.parse( url );


	url.protocol = url.protocol || 'http:';
	url.hostname = url.hostname || os.hostname();
	url.host = null;
	url.port = url.port || url.protocol == 'http:' && 80 || url.protocol == 'https:' && 443;

	url.auth = null;
	url.hash = null;
	url.query = null;
	url.pathname = url.pathname || '/';

	server.urlParsed = url;
	server.urlBase = urllib.format( url );

	var app = express();
	app.use( server.middleware() );
	app.listen( url.port );

	process.nextTick( cb );
}