var 
	_ = require('underscore'),
	async 	= require('async'),
	express = require('express'),
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

Server.prototype.url = function ( append ) {
	return "http://hocus.pocus:5050";
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
			getMeta,
			setHeaders,
			sendFile
		], function ( err ) {
			if ( err ) {
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
				cb();
			});
		}


		function fileExists ( cb ) {
			if ( !file.exists )
				cb( Errors.NotFound );
			else
				cb();
		}

		function getMeta ( cb ) {
			console.log("GETMETA");
			file.getMeta( function ( err, fileMeta ) {
				console.log("GOTMETA");
				if ( _.isObject( fileMeta ) ) {
					meta = fileMeta;
				}
				cb();
			} );
		}

		function setHeaders ( cb ) {
			console.log("SETHEADERS");

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

Server.prototype.listen = function ( config, cb ) 
{


	var 
		server = this,
		router = server.router;

	var app = express();

	app.use( server.middleware() );
	app.listen( 5050 );

}