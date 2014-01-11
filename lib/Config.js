var 
	Errors = require('./Errors.js'),
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
			path: Path from server's root relative to the resuested url,
			url: Url of request, ditching trailing .wildcat
		}
*/

Config.loadFromUrl = function ( url, cb ) {
	if ( !url ) {
		url = '.';
	}

	var urlP = urllib.parse( url );
	//console.log( urlP );
	switch ( urlP.protocol ) {
		case 'file':
		case null:
			fromLocal ( urlP.pathname, cb );
		break;

		default:
			cb( Errors.UnknownProtocol() );
		break;
	}


	function fromLocal ( path, cb ) {
		path = pathlib.resolve( path );
		if ( !Utils.Str.endsWith( path, '.wildcat' ) ) 
			path = pathlib.join( path, '.wildcat' );

		var dir = pathlib.dirname( path );

		// Sync function
		var config = Utils.loadJSONSync( path );
		if ( !config ) {
			cb ( Config.Errors.NotFound() );
			return;
		}

		if ( !config.storage )
			config.storage = Config.normalize.storage( '.' );

		cb ( null, {
			config: config,
			root: dir,
			path: '/'
		} );
	}
}

