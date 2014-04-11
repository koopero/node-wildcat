var 
	Argue 	= require('./Argue.js'),
	Config  = require('./Config.js'),
	Errors 	= require('./Errors.js'),
	Log 	= require('./Log.js'),
	Path 	= require('./Path.js'),
	Server  = require('./Server.js'),
	Stream 	= require('./Stream.js'),
	Storage = require('./Storage'),
	Worker 	= require( './Worker.js' ),
	_		= require('underscore'),
	async 	= require('async'),
	extend  = require('extend'),
	util 	= require('util');

module.exports = Router;


Router.Errors = Errors.List( {
	MissingStorage: true,
});

function Router ()
{
	var config = Argue( arguments, "url" );

	if ( config.constructor == Router )
		return config;

	if ( this.constructor != Router ) {
		return new Router( config );
	}

	var cb;
	if ( config.callback ) {
		cb = config.callback;
		delete config.callback;
	}

	this.log = console.log;
	this.config = config;
	this.streams 		= {};
	this.searchStreams 	= [];

	if ( cb ) {
		this.init( cb );
	}
}

Router.open = function () {

}


Router.prototype.init = function ( cb )
{
	var router = this,
		config = router.config;

	async.series( [
		loadConfigFromUrl,
		initStreams,
		initWorker,
		initStorage,
		initServer,
		touchFiles
	], function ( err ) {
		if ( !cb ) {
		} else if ( err ) {
			cb( err )
		} else {
			cb( null, router );
		}
	} );


	function loadConfigFromUrl ( cb ) {
		if ( config.url ) {
			console.warn ( "loadConfigFromUrl", config.url );
			Config.loadFromUrl ( config.url, function onRemoteConfig ( err, rConfig ) {
				if ( err ) {
					cb( err );
				} else {
					//console.warn( err, rConfig );
					config = extend ( true, rConfig.config, config );
					router.config = config;

					//console.warn( "CONFIG", config );

					cb();
				}
			} );
		} else {
			cb()
		}
	}


	function initStreams ( cb ) {

		if ( config.streams ) {
			for ( var name in config.streams ) {
				var streamConfig = config.streams[name],
					stream = Stream( name, streamConfig );

				stream.router = router;
				router.streams[ name ] = stream;
			}
		}

		async.map( _.values( router.streams ), function ( stream, cb ) {
			stream.init( cb );
		}, function ( err ) {
			router.sortStreams();
			//console.log ( "initStreams", router.streams );
			cb( err );	
		} );
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

	function initStorage ( cb ) {
		var storages = [],
			needDefault = false;

		//Log( "Router.init.initStorage" );

		/*
		Not used, just yet.
		for ( var streamName in router.streams ) {
			var storage = router.streams[streamName].storage;
			if ( !storage ) {
				needDefault = true;
			} else if ( storages.indexOf ( storage ) == -1 ) {
				storages.push( storage );
			}
		}
		*/


		if ( config.storage ) {
			router.storage = Storage( config.storage );
			storages.push( router.storage );
		}


		if ( needDefault && !router.storage ) {
			cb( Router.Errors.MissingStorage() );
		}

		router.storages = storages;

		async.each( storages, function ( storage, cb ) {
			storage.on( 'change', onStorageChange );
			storage.init( cb );
		}, cb );

	}

	function initServer ( cb ) {
		//Log( "Router.init.initServer" );
		if ( !config.server ) {
			cb();
			return;
		}

		router.server = new Server ( config.server );
		router.server.router = router;
		router.server.init ( cb );
	}

	function touchFiles ( cb ) {
		var doIt = true;

		if ( doIt ) {
			async.map( router.storages, 
				function eachStorageTouch ( storage, cb ) {
					if ( !storage.config.touchOnInit ) {
						storage.touchAll( cb )
					} else {
						cb();
					}
				}
				, cb );
		} else {
			cb();
		}
		
	}


	function onStorageChange ( path, change ) {
		if ( router.worker ) {
			var file = router.file ( path );
			if ( file )
				router.worker.onTouchFile ( file, change );	
			else {
				//Log ( "No Path To Touched File", path );
			}
		}
	}
}

//	------
//	Config
//	------

//	------
//	Server
//	------

Router.prototype.url = function ( file ) {
	var router = this,
		server = router.server,
		path = String( file.path );

	if ( server ) {
		return server.url( path );
	}
}


//	-----
//	Files
//	-----

Router.prototype.file = function ( path, options )
{
	if ( !path )
		return;

	path = Path( path ).leadingSlash();
	if ( path.wild )
		throw new Error ( "Cannot get file by wildcard path." );

	var stream = this.streamForPath( path );

	if ( !stream )
		return;

	var file = stream.file( path, options );
	file.router = this;
	return file;
}

//	-------
//	Streams
//	-------

Router.prototype.sortStreams = function ()
{
	var router = this,
		search = [];

	for ( var k in router.streams ) {

	
		search.push( router.streams[k] );
	}

	search.sort( function ( a, b ) {
		if ( a.path.match( b.path ) )
			return 1;
		return 0;
	});

	router.searchStreams = search;

	//console.warn ( "sortStreams", router.searchStreams.map ( function ( stream ) { return stream.name } ) );

}

Router.prototype.resolveStream = function ( stream ) {
	var router = this;

	if ( stream instanceof Stream )
		return stream;

	return router.streams[stream];
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


Router.prototype.close = function ( cb ) {
	var router = this;

	async.series( [
		closeStorage
	], cb );

	function closeStorage ( cb ) {
		async.each( router.storages, function ( storage, cb ) {
			storage.close( cb );
		}, cb);
	}
}

