#!/bin/sh
':' //; exec "`command -v nodejs || command -v node`" "$0" "$@"
// Credit to dancek (http://unix.stackexchange.com/a/65295) for the wicked shebang!

var argv = require('optimist')
	.usage('Usage: $0')
	.alias('u', 'url')
	.describe('u', "URL")
	.argv;



var Wildcat = require('../lib/Wildcat.js');


var config = {
	"streams": {
		"original": {
			"meta": "meta"
		},
		"meta": {
			"input": "**/*",
			"path": "meta/**/*.meta.json"
		}
	}
}

config.storage = {

}



command = argv._[0];

switch ( command ) {
	case 'mirror':
		config.storage.url = argv.url
	break;

	case 'serve':
		config.storage.localPath = '.';
		config.server = {
			listen: argv.url
		}
	break;
}

console.log( config );

var router = new Wildcat.Router( config );
router.init( function ( err ) {

	switch( command ) {
		case 'mirror':
			var dir = router.file('/');
			dir.readdir( function ( err, list ) {
				console.log ( "Root listing", list )
			});
		break;
	}

});


