var 
	_ = require('underscore'),
	async 	= require('async'),
	express = require('express'),
	formidable = require('formidable'),
	os  	= require('os'),
	urllib  = require('url'),
	Filesystem 	= require('./Storage/Filesystem.js'),
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
	server.baseUrl( config.url );

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
		if ( arg instanceof File )
			arg = arg.path;

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

Server.prototype.middleware = function ( opt ) {
	var server = this,
		router = server.router,
		fileKey = 'wildcatFile';

	var opt = opt || {};


	var fileKey = opt.key || 'wildcatFile',
		cacheKey = opt.cacheKey || ('_'+fileKey);

	// Options passed to file objects for various operations.
	var metaOpt = {},
		relOpt  = {},
		statOpt = {},
		storeOpt = {},
		linkOpt = { link: true };


	var dirIndexOpt = { recurse: 1 };
	var fileIndexOpt = {};

	var middleware = use;



	function waterfall( req, res, next, calls ) {
		async.mapSeries( calls, function ( call, cb  ) {
			if ( 'function' == typeof call ) {
				return call( req, res, cb )
			} else if ( 'string' == typeof call ) {
				middleware[call] ( req, res, cb );
			}
		}, next );
	}

	function use ( req, res, next ) {
		var calls;

		switch ( req.method ) {
			case 'HEAD':
			case 'GET':
				return middleware.get( req, res, next );
			break;

			case 'PUT':
				return middleware.put( req, res, next );
			break;

			case 'DELETE':
				return middleware.delete( req, res, next );
			break;
		}
	}

	// NEEDS TO SYNCHRONOUSLY RETURN PATH!
	function pathFromReq ( req, res, next ) {
		var path = req.path; 
		if ( !path || path == '/' && req.query.path ) {
			path = req.query.path;
		} else {
			path = unescape( path );
		}

		if ( next )
			next();

		return path;
	}

	function middlewareUrl ( file ) {
		return server.url( file );
	}




	middleware.get = function ( req, res, next ) {
		waterfall( req, res, next, [ 
			'systemHeaders', 
			'metaHeaders',
			'fileRelatives',
			'redirect',
			'dirIndex',
			'sendFile' 
		] );
	}

	middleware.put = function ( req, res, next ) {
		waterfall( req, res, next, [ 
			'putFile',
			'fileIndex' 
		] );		
	}

	middleware.putFile = function  ( req, res, next ) {
		getFileAndStat( req, res, function ( file, stat ) {
			var fileExistedBefore = file.exists;
			var storeOpt = {};

			if ( req.headers['last-modified'] ) {
				storeOpt.mtime = new Date( req.headers['last-modified'] );
			}

			switch ( req.headers['content-type'] ) {
				case 'wildcat/symlink-abspath':
					storeLink( next );
				break;

				default:
					storeStream( next )
				break;
			}

			function storeStream ( cb ) {
				var stream = req;
				file.store( stream, storeOpt, fileStored );
			}

			function storeLink ( cb ) {
				readString( function ( err, str ) {
					var path = str,
						linkSrc = router.file( path );

					linkSrc.stat ( function ( err, info ) {
						if ( err ) {
							cb( err );
						} else if ( !info.exists ) {
							cb( Server.Errors.LinkTargetNotFound( path ) );
						} else {
							file.store( linkSrc, linkOpt, fileStored );
						}
					});
				} );
			}

			function fileStored ( err ) {
				if ( err ) {
					sendError( err );
				} else {
					req[fileKey] = file;
					var cache = req[cacheKey] = {};
					cache.status = fileExistedBefore ? 205 : 201;
					next();
				}
			}
		});





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


	middleware.delete = function ( req, res, next ) {
		getFileAndStat( req, res, function ( file, stat ) {
			if ( !file ) {
				if ( next )
					next();
			} else if ( !file.exists ) {
				res.send( 204 );
			} else {
				file.unlink ( function ( err ) {
					if ( err ) {
						sendError( err );
					} else {
						res.send( 205 );
					}
				});
			}
		});
	}



	middleware.systemHeaders = function ( req, res, next ) {
		next();
	}

	middleware.metaHeaders = function ( req, res, next ) {
		getFileAndMeta( req, res, function ( file, meta ) {
			if ( !file || !meta ) {
				next();
			} else {
				var sendHeaders = [
					'content-type',
					'content-md5',
					'image-width',
					'image-height',
					'media-duration'
				];

				sendHeaders.map ( function ( k ) {
					if ( meta[k] != undefined ) {
						res.set( k, meta[k] );
					}
				} );


				if ( meta['last-modified'] )
					res.set( 'Last-Modified', new Date( meta['last-modified'] ).toString() );

				next();
			}
		});
	}

	middleware.fileRelatives = function( req, res, next ) {
		getFileAndStat( req, res, function ( file, stat ) {
			if ( !file || !file.exists ) {
				next();
			} else {
				var relOpts = {
					exists: true
				}

				file.relatives( relOpts, function onFileRelatives ( err, relatives ) {
						if ( err )
							return sendError( err );

						for ( var streamName in relatives ) {
							var relFile = relatives[streamName];
							res.set( 'Wildcat-'+streamName, middlewareUrl( relFile ) );
						}	

						next();			
					}
				);
			}
		});
	}

	middleware.redirect = function  ( req, res, next ) {
		getFileAndStat( req, res, function ( file, stat ) {
			if ( !file || !stat ) {
				if ( next )
					next();
			} else if ( String(file.path) != pathFromReq( req ) ) {
				res.redirect( 301, server.url( file.path ) );
			} else if ( stat.isLink ) {
				res.redirect( 302, server.url( file.linkPath ) );
			} else if ( next ) {
				next();
			}
		} );
	}

	middleware.dirIndex = function ( req, res, next ) {
		getFileAndStat( req, res, function ( file, stat ) {
			if ( !file || !stat || !stat.isDir ) {
				next();
			} else {
				file.index( 
					dirIndexOpt, 
					function onDirIndex ( err, index ) {
						res.send( index );
					}
				);
			}
		} );
	}


	middleware.fileIndex = function ( req, res, next ) {
		getFileAndStat( req, res, function ( file, stat ) {
			if ( !file ) {
				next();
			} else {
				file.index( 
					fileIndexOpt, 
					function onFileIndex ( err, index ) {
						var cache = req[cacheKey] || {};
						var status = cache.status || 200;
						index['content-location'] = middlewareUrl( file );
						//console.log(  "fileIndex", file, stat );
						res.send( status, index );
					}
				);
			}
		} );
	}


	middleware.sendFile = function  ( req, res, next ) {
		getFileAndStat( req, res, function ( file, stat ) {
			if ( !file ) {
				next();
			} else if ( !stat.exists ) {
				res.send( 404 );
			} else if ( !file.localPath ) { 
				res.send( 404 );
			} else {
				res.sendfile( file.localPath );
			}
		});
	}



	function getFileAndStat( req, res, cb ) {
		var file = req[fileKey],
			cache = req[cacheKey];

		if ( !cache )
			req[cacheKey] = cache = {};

		if ( file && ( cache.stat || cache.stat === null ) ) {
			return cb( file, cache.stat );
		}		

		if ( !file ) {
			var path = pathFromReq( req );
			file = router.file( path );
			req[fileKey] = file;
			cache.file = file;
		}

		file.stat( statOpt, function ( err, stat ) {
			if ( err ) {
				return sendError( err );
			}

			cache.stat = stat || null;
			cb ( file, stat );
		});
	}

	function getFileAndMeta( req, res, cb ) {
		var file = req[fileKey],
			cache = req[cacheKey];

		if ( !cache )
			req[cacheKey] = cache = {};

		if ( cache.meta && file ) {
			return cb( file, cache.meta );
		}

		if ( !file ) {
			getFileAndStat( req, res, function ( file, stat ) {
				// Callback-ception
				getFileAndMeta( req, res, cb );
			});
			return;
		}

		file.meta( metaOpt, function ( err, meta ) {
			cache.meta = meta;
			cb( file, meta );
		});
	}







	function sendError( err ) {
		throw new Error('TBA');
	}


	return middleware;

}


Server.prototype.postMiddleware = function ( opt ) {
	if ( 'string' == typeof opt ) {
		opt = {
			template: opt
		};

	}


	var template;


	var uniquePathMaxIterations = 100;


	return function postMiddleware ( req, res, next ) {
		var 
			status = {
				files: []
			};

		parseReq( sendResults );

		function parseReq ( cb ) {
			if ( req.files ) {
				processFiles( req.files, cb );
			} else {
				var form = new formidable.IncomingForm();
				form.parse( req, function ( err, fields, files ) {
					processFiles ( files, cb );
				});
			}

			function processFiles( files, cb ) {
				files = _.values( files );
				async.mapSeries( files, eachFile, cb );
			}

			function eachFile ( file, cb ) {

				var wantPath;
				if ( Path( path ).isDir ) {
					wantPath = path+file.name;
				} else {
					wantPath = path;
				}
				


				var 
					destPath = null,
					destFile;

				function validate ( cb ) {
					cb();
				}

				function getUniquePath ( cb ) {
					var 
						iteration = 0;

					async.whilst(
						function () { return !destFile && iteration < uniquePathMaxIterations && destPath !== lastPath; },
						function ( cb ) {
							destPath = Utils.uniquePath ( wantPath, template, iteration );
							iteration ++;

							destFile = router.file( destPath );
							destFile.stat ( function ( err, info ) {

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
								// This is where we determine if it's a overwrite
								cb( Server.Errors.AlreadyExists( destPath ) );
							} else {
								cb();
							}
						}
					);
				}

				function storeFile( cb ) {
					var srcFile = Filesystem.file( file.path )
					destFile.store( srcFile, { move: true }, function ( err ) {
						if ( err ) {
							cb( err );
							return;
						}

						status.files.push ( destFile );

						cb();
					});
					
				}
			}

		}

		function sendResults ( err ) {
			if ( err ) {
				status.err = err;
			}

			var code;

			if ( status.files.length ) {
				code = 201;
			} else if ( err ) {
				code = err.status;
			} else {
				code = 400;
			}


			async.mapSeries( status.files, metaFromFile, function ( err, files ) {
				status.files = files;
				res.send( code, status );			
			} );

			function metaFromFile ( file, cb ) {
				file.meta( metaOpt, function ( err, meta ) {
					meta = meta || { metaError: true };
					meta = _.clone( meta );
					meta['content-location'] = server.url( file.path );
					cb( null, meta );
				});
			}			
		}

	}
}


Server.prototype.baseUrl = function ( url ) 
{
	var server = this;

	url = url || '';

	if ( 'number' == typeof url )
		url = { port: url };

	if ( 'string' == typeof url )
		url = urllib.parse( url );

	if ( server.urlBase ) {
		url = _.extend( urllib.parse( server.urlBase ), url );
	}	

	url.protocol = url.protocol || 'http:';
	url.hostname = url.hostname || os.hostname();
	url.host = null;
	url.port = url.port || url.protocol == 'http:' && 80 || url.protocol == 'https:' && 443;

	url.auth = null;
	url.hash = null;
	url.query = null;
	url.pathname = url.pathname || '/';

	var str = urllib.format( url );

	server.urlBase = str;

	return str;
}

Server.prototype.listen = function ( url, cb ) 
{
	var 
		server = this,
		config = server.config;

	if ( typeof url == 'function' ) {
		cb = url;
		url = null;
	} 

	url = urllib.parse( server.baseUrl( url ) );
	
	if ( server.listening )
		throw new Error ( "Double listneing" );

	server.listening = true;

	var app = express();
	var middleware = server.middleware();
	app.use( server.middleware() );
	app.listen( url.port );

	if ( cb )
		process.nextTick( cb );
}




