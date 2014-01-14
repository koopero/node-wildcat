var 
	_ = require('underscore'),
	async 	= require('async'),
	express = require('express'),
	formidable = require('formidable'),
	os  	= require('os'),
	urllib  = require('url'),
	FileSystem 	= require('./Storage/FileSystem.js'),
	HTTP 	= require('./Storage/HTTP.js'),
	Errors  = require('./Errors.js'),
	Utils = require('./Utils.js'),
	Path 	= require('./Path.js');

module.exports = Server;

Server.Errors = Errors.List( {
	LinkTargetNotFound: {
		status: 400
	},
	AlreadyExists: {
		status: 409
	},
	PostNotAllowed: {
		status: 405
	},
	PostPathNotFound: {
		status: 404
	}
});

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
		config = server.config,
		router = server.router;

	return function ( req, res ) {

		var 
			path = req.path,
			status = {},
			statusCode = 200,
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
					sendRelatives,
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
					cooldown,
					sendStatus
				], finish );
			break;

			case 'DELETE':
				async.series([
					sendSpecials,
					findFile,
					deleteFile,
					sendStatus
				], finish );
			break;

			
			case 'POST':
				async.series([
					post,
					sendStatus
				], finish );
			break;
			

		}

		function post ( cb ) {

			if ( !config.post ) {
				cb ( Server.Errors.PostNotAllowed() );
				return;
			}

			if ( req.files ) {
				processFiles( req.files, cb );
			} else {
				var form = new formidable.IncomingForm();
				form.parse( req, function ( err, fields, files ) {
					processFiles ( files, cb  );
				});
			}

			D = console.log;
			function processFiles( files, cb ) {
				
				files = _.values( files );
				
				async.mapSeries( files, processFile, cb );
			}

			function processFile ( file, cb ) {

				var wantPath;
				if ( Path( path ).isDir ) {
					wantPath = path+file.name;
				} else {
					wantPath = path;
				}
				
				var template;
				for ( var pattern in config.post.path ) {
					var wildcard = Path( pattern );
					if ( wildcard.match( wantPath ) ) {
						template = config.post.path[pattern];
						break;
					}
				}

				if ( !template ) {
					cb( Server.Errors.PostPathNotFound( wantPath ) );
					return;
				}


				var iteration = 0,
					maxIterations = 100,
					destPath = null,
					destFile,
					lastPath;

				async.whilst(
					function () { return !destFile && iteration < maxIterations && destPath !== lastPath; },
					function ( cb ) {

						destPath = Utils.uniquePath ( wantPath, template, iteration );

						iteration ++;
						destFile = router.file( destPath );
						destFile.getInfo ( function ( err, info ) {

							if ( err )
								cb ( err );
							else if ( info.exists ) {
								destFile = null;
								cb();
							} else {
								cb();
							}
						} );
					},
					function ( err ) {
						if ( err ) {
							cb( err );
						} else if ( !destFile ) {
							cb( Server.Errors.AlreadyExists( destPath ) );
						} else {
							storeFile ( cb );
						}
					}
				);

				function storeFile( cb ) {
					var srcFile = FileSystem.file( file.path )
					destFile.store( srcFile, { move: true }, function ( err ) {
						if ( err ) {
							cb( err );
							return;
						}

						statusCode = 201;
						if ( !status.files )
							status.files = [];

						

						status.files.push ( destFile );

						cb();
					});
					
				}

				
			}

			
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


			file = router.file( req.path );
			file.getInfo( function ( err ) {
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
			file.meta( function ( err, fileMeta ) {
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
				if ( meta.type )
					res.set( 'Wildcat-Type', meta.type );


				var sendHeaders = [
					'content-type',
					'content-md5',
					'image-width',
					'image-height',
					'media-duration'
				];

				sendHeaders.map ( function ( k ) {
					if ( meta[k] != undefined ) {
						res.set( prettyCase(k), meta[k] );
					}
				} );


				if ( meta['last-modified'] )
					res.set( 'Last-Modified', new Date( meta['last-modified'] ).toString() );
			}

			cb();
			function prettyCase ( str ) {
				return str.replace ( /[^\-]\w/, function ( str ) {
					return str.toUpperCase();
				} );
			}
		}

		function sendRelatives ( cb ) {
			if ( file ) {
				var relatives = file.relatives();
				for ( var stream in relatives ) {
					var relFile = relatives[stream];
					if ( !relFile )
						continue;

					res.set( 'Wildcat-'+stream, relFile.url() );
				}
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
			var fileExistedBefore = file.exists;
			var storeOpt = {};

			if ( req.headers['last-modified'] ) {
				storeOpt.mtime = new Date( req.headers['last-modified'] );
			}

			switch ( req.headers['content-type'] ) {
				case 'wildcat/symlink-abspath':
					storeLink( cb );
				break;

				default:
					storeStream( cb )
				break;
			}
		

			function storeStream ( cb ) {
				var stream = req;
				file.store( stream, storeOpt, function ( err ) {
					if ( err ) {
						cb( err );
					} else {
						statusCode = fileExistedBefore ? 205 : 201;
						cb();
					}
				} );
			}

			function storeLink ( cb ) {
				readString( function ( err, str ) {
					var path = str,
						linkSrc = router.file( path );

					linkSrc.getInfo ( function ( err, info ) {
						if ( err ) {
							cb( err );
						} else if ( !info.exists ) {
							cb( Server.Errors.LinkTargetNotFound( path ) );
						} else {
							storeOpt.link = true;
							file.store( linkSrc, storeOpt, cb );
						}
					});
				} );
			}

			function readString ( cb ) {
				var 
					stream = req,
					str = '';

				stream.setEncoding( 'utf8' );
				stream.on( 'data', function ( chunk ) {
					str += chunk;
				});
				stream.on( 'error', function ( err ) {
					cb( err );
				})
				stream.on( 'end', function ( ) {
					cb( null, str );
				} )
			}
		}

		function deleteFile ( cb ) {
			if ( !file.exists ) {
				statusCode = 204;
				cb();
			} else {
				file.unlink ( function ( err ) {
					statusCode = 205;
					cb();
				});
			}
		}



		function cooldown ( cb ) {
			setTimeout( cb, 100 );
		}

		function sendStatus ( cb ) {
			switch ( statusCode ) {
				case 204:
				case 205:
					res.send( statusCode, '' );
					cb();
				break;

				case 201:
					if ( !status.files )
						status.files = [ file ];

					async.mapSeries( status.files, metaFromFile, function ( err, files ) {
						status.files = files;
						res.send( statusCode, status );
					} );
				break;

				default:
					res.send( 500, "Invalid statusCode" );
				break;
			}

			function metaFromFile ( file, cb ) {
				file.meta( function ( err, meta ) {
					meta = meta || { metaError: true };
					meta = _.clone( meta );
					meta.url = server.url( file.path );
					cb( null, meta );
				});
			}
		}

		function finish ( err ) {
			if ( err && err !== true ) {

				try {
					var str = JSON.stringify( { error: err }, null, 2 );
					res.set( 'Content-Type', 'application/json' );
				} catch ( e ) {
					str = "Couldn't stringify error";
				}

				res.send( err.status || 500, str );
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

	//console.log( "Server listen", url );
	if ( server.listening )
		throw new Error ( "Double listneing" );
	server.listening = true;




	var app = express();
	app.use( server.middleware() );
	app.listen( url.port );

	process.nextTick( cb );
}




