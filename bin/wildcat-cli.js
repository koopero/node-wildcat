#!/bin/sh
':' //; exec "`command -v nodejs || command -v node`" "$0" "$@"
// Credit to dancek (http://unix.stackexchange.com/a/65295) for shebang!

var _ = require('underscore'),
	async = require('async');







var 
	Wildcat = require('../lib/Wildcat.js'),
	HTTP = require('../lib/Storage/HTTP.js');




var commands = {},
	flags = {},
	url,
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


	var validCommands = ['init','serve','build','mirror'];
	var args = [];


	argv._.forEach ( function ( arg ) {
		if ( validCommands.indexOf ( arg ) != -1 ) {
			commands[ arg ] = true;
		} else if ( !url) {
			url = arg;
		} else {
			cb( "Too many arguments");
			return;
		}
	});

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
	if ( commands.build ) {
		if ( !config.worker ) {
			config.worker = {};
		}
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
		console.log("Touched File", file);
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











