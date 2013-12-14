var
	async = require('async'),
	util = require('util'),
	Storage = require('../Storage.js'),
	FileSystem = require('./FileSystem.js'),
	HTTPFile = require('./HTTPFile.js'),
	Path = require('../Path.js');

util.inherits( HTTP, Storage );

module.exports = HTTP;

function HTTP ( config ) 
{
	var http = this;
	if ( 'string' == typeof config )
		config = { url: config };

	if ( !config.localPath ) {
		config.localPath = 'tmp:/./http';
	}

	http.config = config;
	http.urlBase = config.url;
}

HTTP.prototype.init = function ( cb )
{
	var http = this,
		config = http.config;

	async.series( [
		checkServer,
		createLocal
	], cb );

	function checkServer ( cb ) {
		cb();
	}

	function createLocal ( cb ) {
		http.local = new FileSystem( config );
		http.local.init ( function ( err ) {
			if ( err ) throw err;
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


	return http.urlBase + path;
}

HTTP.prototype.getFile = function ( path )  {
	if ( path instanceof File ) 
		path = path.path;

	var 
		http = this,
		file = new HTTPFile ( path );

	file.storage = http;
	file.url = http.url( path );
	file.local = http.local.getFile( path );

	return file;
}

