#!/bin/sh
':' //; exec "`command -v nodejs || command -v node`" "$0" "$@"
// Credit to dancek (http://unix.stackexchange.com/a/65295) for shebang!

var _ = require('underscore'),
	async = require('async'),
	extend = require('extend'),
	Wildcat = require('../lib/Wildcat.js'),
	HTTP = require('../lib/Storage/HTTP.js'),
	Log = require('../lib/Log.js'),
	Filesystem = require('../lib/Storage/Filesystem.js'),
	Preset = require('../lib/Preset.js');


var commands,
	urls,
	options = {},
	config,
	workDir, lastDir,
	router;

async.series( [
	parseArguments,
	loadConfig,
	alterConfig,
	loadPresets,
	listenForKill,
	changeDir,
	initRouter,
	touchFiles,
	waitForCompletion,
	shutdown
], function ( err ) {
	console.warn("err", err );
})


function parseArguments ( cb ) {
	var argv = require('optimist')
		.usage('Usage: $0')
		.alias('u', 'url')
		.describe('u', "URL")
		.alias('l', 'local')
		.describe( 'l', 'Local path')
		.alias('s', 'server')
		.boolean(['s','w'] )
		.alias('p', 'preset')
		.alias('w', 'worker')
		.alias('t', 'tmp')
		.describe( 't', 'Use tempdir')
		.argv;


	if ( argv.server ) {
		commands = commands || {};
		commands.server = true;
	}

	if ( argv.worker ) {
		commands = commands || {};
		commands.worker = true;
	}

	urls = argv._;

	extend ( options, argv );

	cb();
}


function loadConfig ( cb ) {
	if ( urls.length == 0 ) {
		var defaultConfig = Preset('router/cwd');
		config = defaultConfig;
		cb();
	} else if ( urls.length == 1 ) {
		require('../lib/Config.js').loadFromUrl( urls[0], function ( err, loaded ) {
			if ( err ) {
				cb( err );
				return;
			}


			config = loaded.config;
			workDir = loaded.root;
			cb();
		} );		
	} else {
		cb( Cli.Errors.TooManyURLs() );
	}

}

function alterConfig ( cb ) {
	if ( commands && commands.worker ) {
		if ( !config.worker ) {
			config.worker = {};
		}
	} else if ( commands ) {
		config.worker = null;
	}

	if ( commands && commands.server ) {
		if ( !config.server ) {
			config.server = {};
		}

		if ( options.listen ) 
			config.server.listen = options.listen;

		if ( !config.server.listen ) {
			config.server.listen = 'http://:32000';
		}

	} else if ( commands ) {
		config.server = null;
	}

	if ( options.tmp ) {
		Filesystem.setTempDir( options.tmp );
	}


	cb();
}

function loadPresets ( cb ) {
	var presets = options.preset;
	if ( !Array.isArray( presets ) )
		presets = [ presets ];

	try {
		presets.map( function( preset ) {
			config = extend ( true, config, Preset( preset ) );
		});

	} catch ( err ) {
		cb( err );
		return;
	}

	cb();
}

function listenForKill ( cb ) {
	var killed = false;
	process.on( 'SIGINT', function() {
		if ( !killed ) {
			console.log( "\nClosing from SIGINT. Next Ctrl-C will kill." );
			shutdown();
			killed = true;
		} else {
			process.exit( 1 );
		}
	});	

	cb();
}

function changeDir ( cb ) {

	if ( workDir && workDir != process.cwd() ) {
		//Log ( "cli.changeDir", workDir );
		lastDir = process.cwd();
		process.chdir( workDir );
	}
	cb();
}

function initRouter ( cb ) {
	//console.log( JSON.stringify( config, null, '  ' ) );
	router = new Wildcat( config );
	router.init( function ( err ) {
		if ( err ) {
			cb ( err );
		} else {
			var finalConfig = router.publicConfig();
			console.log( JSON.stringify( finalConfig, null, '  ') );
			cb();
		}
	});
}


function touchFiles ( cb ) {
	//cb(); return;
	var storage = router.storage;
	var iterator = storage.touchAll( cb );
	iterator.on('output', function ( file ) {
		//rm console.log("Touched File", file);
	});
}


function waitForCompletion ( cb ) {
	//setTimeout( cb, 1000 );
}


function shutdown () {
	//console.warn("shutting down");

	if ( lastDir ) {
		process.chdir( lastDir );
	}

	if ( router ) {
		router.close( function () {
			process.exit();
		});
		router = null;
	}
} 







