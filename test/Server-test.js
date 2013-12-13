var Wildcat = require('../lib/Wildcat.js'),
	async	= require('async');

//console.log = function () { throw new Error ( 'That trace you forgot is here' ); }

var router = Wildcat.Router( {
	"storage": {
		localPath: "."
	},
	"streams": {
		"original": {
			"meta": "meta"
		},
		"meta": {
			"input": "**/*",
			"path": "**/*.meta.json",
			"meta": {
				"mimeType": "text/json"
			},
			"build": [
				{ "tool": "wildcat-meta"},
				{ "input": true },
				">",
				{ "output": true }
			]
		}
	},
	"server": {
		"listen": {
			"port": 5050
		}
	}
} );

router.init( function ( err ) {
	if ( err ) {
		console.log( 'Init Fail', err );
		return;
	} else {
		console.log( "init");
	}
});
