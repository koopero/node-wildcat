var 
	Errors = require('./Errors.js'),
	HTTP = require('./Storage/HTTP.js'),
	Utils = require('./Utils.js'),
	pathlib = require('path'),
	urllib = require('url');

var Config = {};
module.exports = Config;

Config.Errors = Errors.List( {
	NotFound: true
})

Config.normalize = {};
Config.normalize.storage = function ( config ) {
	if ( 'string' == typeof config )
		config = {
			url: config
		};
	else if ( 'object' != typeof config ) 
		throw new Error ( "Invalid Storage configuration");	

	return config;
}


/*
		{
			config: JSON Of Server's Config,
			root: Root url of server,
			path: Path from server's root relative to the requested url,
			url: Url of request, ditching trailing .wildcat
		}
*/

Config.loadFromUrl = function ( url, cb ) {
	if ( 'object' == typeof url )
		url = urllib.format( url );

	if ( !url ) {
		url = '.';
	}

	var urlP = urllib.parse( url );
	//console.warn( "loadFromUrl", urlP );
	switch ( urlP.protocol ) {
		case null:
			fromLocal ( url, cb );
		break;

		case 'http:':
			fromHttp ( url, cb );
		break;

		default:
			cb( Errors.UnknownProtocol() );
		break;
	}


	function fromLocal ( path, cb ) {
		
		if ( Utils.Str.endsWith( path, '/' ) ) {
			path = pathlib.join( path, '.wildcat' );
		} else {

		}

		path = pathlib.resolve( path );

		var dir = pathlib.dirname( path );

		// Sync function
		Utils.loadYAML( path, onConfigLoaded );

		function onConfigLoaded ( err, config ) {

			if ( err ) {
				cb ( err );
				return;
			}

			if ( !config.storage ) {
				config.storage = {
					localPath: dir
				};
			}

			if ( config.storage.localPath ) {
				config.storage.localPath = pathlib.resolve( dir, config.storage.localPath );
			}



			cb ( null, {
				config: config,
				root: dir,
				path: '/'
			} );
		}

	}

	function fromHttp ( urlP, cb ) {
		var url = urllib.format( urlP ),
			dotWildcat,
			ret = {};

		if ( Utils.Str.endsWith( url, ".wildcat" ) ) {
			dotWildcat = url;
			url = Utils.Str.rtrim( url.pathname, ".wildcat" );
			urlP.pathname = Utils.Str.rtrim( urlP.pathname, ".wildcat" );
			loadDotWildcat();
		} else {
			HTTP.request( url, { method: 'HEAD', followRedirects: true }, function ( err, status, header ) {
				if ( err || status != 200 ) {
					cb ( HTTP.Errors.ServerNotFound() );
					return;
				}

				dotWildcat = header['wildcat'];
				if ( !dotWildcat ){
					cb( HTTP.Errors.ServerNotWildcat () );
					return;
				}

				loadDotWildcat();
			});
		}

		function loadDotWildcat() {
			HTTP.request( dotWildcat, { json: true }, function ( err, status, header, serverConfig ) {
				if ( err || status != 200 || !serverConfig ) {
					cb( HTTP.Errors.ServerNotWildcat() );
					return;
				}

				ret.config = serverConfig;
				ret.root = serverConfig.url || ( serverConfig.storage && serverConfig.storage.url );
				ret.url = url;


				cb( null, ret );

			});
		}
	}
}

