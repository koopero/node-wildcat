#!/bin/sh
':' //; exec "`command -v nodejs || command -v node`" "$0" "$@"
// Credit to dancek (http://unix.stackexchange.com/a/65295) for shebang!

var _ = require('underscore'),
	async = require('async');







var 
	extend = require('extend'),
	Wildcat = require('../lib/Wildcat.js'),
	HTTP = require('../lib/Storage/HTTP.js');




var commands,
	url,
	options = {},
	config,
	workDir, lastDir,
	router;

async.series( [
	parseArguments,
	loadConfig,
	alterConfig,
	listenForKill,
	changeDir,
	initRouter,
	touchFiles,
	waitForCompletion,
	shutdown
], function ( err ) {
	if ( err ) {
		console.log("err", err);
	}
	
})


function parseArguments ( cb ) {
	var argv = require('optimist')
		.usage('Usage: $0')
		.alias('u', 'url')
		.describe('u', "URL")
		.alias('l', 'local')
		.describe( 'l', 'Local path')
		.argv;


	var validCommands = ['init','server','worker','mirror'];
	var args = [];


	argv._.forEach ( function ( arg ) {
		if ( validCommands.indexOf ( arg ) != -1 ) {
			commands = commands || {};
			commands[ arg ] = true;
		} else if ( !url) {
			url = arg;
		} else {
			cb( "Too many arguments");
			return;
		}
	});
	extend ( options, argv );

	cb();
}


function loadConfig ( cb ) {
	require('../lib/Config.js').loadFromUrl( url, function ( err, loaded ) {
		if ( err ) {
			cb( err );
			return;
		}
		
		config = loaded.config;
		workDir = loaded.root;
		cb();
	} );
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
		//console.log ( "Entering", workDir );
		lastDir = process.cwd();
		process.chdir( workDir );
	}
	cb();
}

function initRouter ( cb ) {
	//console.log( JSON.stringify( config, null, ' ' ) );
	router = new Wildcat.Router( config );
	router.init( function ( err ) {
		cb ( err );
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
	console.log("shutting down");

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





return;




console.log( argv );


command = argv._[0];

switch ( command ) {
	case 'mirror':
		config.storage.url = argv.url;
		config.storage.localPath = argv.local;
	break;

	case 'serve':
		config.storage.localPath = argv.local || '.';
		config.server = {
			listen: argv.url
		}
	break;

	case 'build':
		config.storage.localPath = argv.local ? argv.local : '.';
		config.storage.touch = true;
		config.worker = {

		}
	break;

	case 'init':
		config.storage.localPath = argv.local || '.';
	break;
}

if ( argv.watch ) {
	config.storage.watch = true;
} 











