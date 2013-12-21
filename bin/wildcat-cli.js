#!/bin/sh
':' //; exec "`command -v nodejs || command -v node`" "$0" "$@"
// Credit to dancek (http://unix.stackexchange.com/a/65295) for shebang!

var _ = require('underscore');


var argv = require('optimist')
	.usage('Usage: $0')
	.alias('u', 'url')
	.describe('u', "URL")
	.alias('l', 'local')
	.describe( 'l', 'Local path')
	.argv;


var validCommands = ['init','serve','build','mirror'];


var commands = [];
var args = [];

argv._.forEach ( function ( arg ) {
	if ( validCommands.indexOf ( arg ) != -1 ) {
		commands.push( arg );
	} else {
		args.push( arg );
	}
});





var Wildcat = require('../lib/Wildcat.js'),
	HTTP = require('../lib/Storage/HTTP.js');


function loadConfig( url, cb ) {
	if ( !url ) {
		url = '.';
	}


}



var config = {
	"streams": {
		"meta": {
			"metaFor": "**",
			"input": "**/*",
			"path": "/meta/**/*.meta.json",
			"build": [
				{ tool: "wildcat-meta"},
				{ input: true },
				'>',
				{ output: true }
			],
			"fragile": true
		}
	}
}

config.storage = {

}




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






var router = new Wildcat.Router( config );
router.init( function ( err ) {
	

	router.touchAll();

	switch( command ) {
		case 'mirror':
			var dir = router.file(argv.f);
			dir.walk( function ( err, list ) {
				console.log ( "Root listing", list )
			});
		break;
	}

});

var killed = false;
process.on( 'SIGINT', function() {
	if ( !killed ) {
		console.log( "\nClosing from SIGINT. Next Ctrl-C will kill." );
		if ( router ) {
			router.close();
		}
		killed = true;
	}
  
  // some other closing procedures go here
  	process.exit( 1 );
});


