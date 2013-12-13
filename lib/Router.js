var 
	Errors 	= require('./Errors.js'),
	Path 	= require('./Path.js'),
	Server  = require('./Server.js'),
	Stream 	= require('./Stream.js'),
	Storage = require('./Storage'),
	Worker 	= require( './Worker.js' ),
	_		= require('underscore'),
	async 	= require('async'),
	extend  = require('extend');

var util = require('util');

Router.Errors = Errors.List( {
	MissingStorage: true,
});

function Router ( config )
{
	if ( config.constructor == Router )
		return config;

	if ( this.constructor != Router ) {
		return new Router( config );
	}

	this.log = console.log;
	this.config = config;
	this.streams 		= {};
	this.searchStreams 	= [];

}


Router.prototype.init = function ( callback )
{
	var router = this,
		config = router.config;

	async.series( [
		initStreams,
		initWorker,
		initStorage,
		initServer,
	], callback );



	function initStreams ( cb ) {
		if ( config.streams ) {
			for ( var name in config.streams ) {
				router.addStream( name, config.streams[name] );
			}
		}

		cb();
	}

	function initWorker ( cb ) {
		if ( config.worker ) {
			router.worker = Worker( config.worker );
			router.worker.router = router;
			router.worker.init( cb );
		} else {
			cb()
		}
	}

	function initStorage ( callback ) {
		var storages = [],
			needDefault = false;

		
		for ( var streamName in router.streams ) {
			var storage = router.streams[streamName].storage;
			if ( !storage ) {
				needDefault = true;
			} else if ( storages.indexOf ( storage ) == -1 ) {
				storages.push( storage );
			}
		}


		if ( config.storage ) {
			router.storage = Storage( config.storage );
			storages.push( router.storage );
		}


		if ( needDefault && !router.storage ) {
			callback( Router.Errors.MissingStorage() );
		}


		async.each( storages, function ( storage, cb ) {
			storage.on( 'change', onStorageChange );

			storage.init( cb );
		}, callback );
	}

	function initServer ( cb ) {
		if ( !config.server ) {
			cb();
			return;
		}

		router.server = new Server ( config.server );
		router.server.router = router;
		router.server.init ( cb );
	}


	function onStorageChange ( path, change ) {
		if ( router.worker ) {
			var file = router.getFile ( path );
			if ( file )
				router.worker.onFileChange ( file, change );	
			else 
				console.log ( "No Path", path );
		}
	}
}

//	------
//	Config
//	------

//	------
//	Server
//	------

Router.prototype.get = function ( request, response, next )
{
	var path = request.url;
	if ( path.substr(0,1) == '/' )
		path = path.substr( 1 );

	if ( path == '' )
		path = '/';

	var stream = this.streamForPath( path );
	
	if ( !stream ) {
		response.send( 404, {
			error: "Stream not found"
		});
	} else {
		stream.get ( path, request, response );
	}

}


//	-----
//	Files
//	-----

Router.prototype.getFile = function ( path, options )
{
	path = Path( path ).leadingSlash();
	if ( path.wild )
		throw new Error ( "Cannot get file by wildcard path." );

	var stream = this.streamForPath( path );
	if ( !stream )
		return;

	var file = stream.getFile( path, options );
	file.router = this;
	return file;
}

//	-------
//	Streams
//	-------

Router.prototype.addStream = function ( name, config ) {
	var stream;
	if ( config && config.constructor === Stream ) {
		stream = config;
	} else {
		stream = new Stream ( name, config );
	}

	if ( this.streams[name] ) {
		throw new Error ( "Stream name already in use.")
	}

	this.streams[name] = stream;
	stream.router = this;
	this.sortStreams();
}



Router.prototype.sortStreams = function ()
{
	var search = [];
	for ( var k in this.streams ) {
		search.push( this.streams[k] );
	}

	search.reverse();
	// TODO Actually sort

	this.searchStreams = search;
}

Router.prototype.streamForPath = function ( path ) {
	var k = this.searchStreams.length;
	for ( var i = 0; i < k; i ++ ) {
		var stream = this.searchStreams[i];
		if ( stream.matchPath( path ) ) {
			return stream;
		}
	}
}


Router.prototype.publicConfig = function () {
	var router = this,
		streams = router.streams,
		conf = {};

	conf.wildcat = require('./Wildcat.js').version;
	conf.streams = {};

	_.map( streams, function ( stream, name ) {
		conf.streams[name] = stream.publicConfig();
	});

	if ( router.server ) {
		extend( conf, {
			storage: {
				url: router.server.url()
			}
		});
	}

	


	return conf;
}


module.exports = Router;