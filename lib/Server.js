var 
	_ = require('underscore'),
	async 	= require('async'),
	express = require('express'),
	os  	= require('os'),
	urllib  = require('url'),
	Errors  = require('./Errors.js');

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
		if ( 'string' != typeof arg )
			throw new Error ( 'Argument must be string' );

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
		router = server.router;

	return function ( req, res ) {

		var file,
			meta;

		async.series ( [
			sendSpecials,
			findFile,
			fileExists,
			doRedirect,
			getMeta,
			setHeaders,
			sendIndex,
			sendFile
		], function ( err ) {
			if ( err && err !== true ) {
				res.send( err.httpCode || 5001, {
					error: err
				});
			}
		});


		function sendSpecials ( cb ) {
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
			if ( !file.exists )
				cb( Errors.NotFound() );
			else
				cb();
		}

		function doRedirect ( cb ) {
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

		function setHeaders ( cb ) {
			res.set("X-Powered-By", "wildcat@"+server.version );

			if ( meta ) {
				if ( meta.mimeType )
					res.set('Content-Type', meta.mimeType );

				if ( meta.md5 ) 
					res.set( 'Content-MD5', meta.md5 );

			}
			cb();
		}

		function sendFile ( cb ) {
			if ( file.localPath ) {
				res.sendfile( file.localPath, cb );
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
	url.port = url.port || url.protocol == 'http:' && 80 || url.protocol == 'https:' && 443;

	url.auth = null;
	url.hash = null;
	url.query = null;

	server.urlParsed = url;
	server.urlBase = urllib.format( url );

	var app = express();
	app.use( server.middleware() );
	app.listen( url.port );

	process.nextTick( cb );
}