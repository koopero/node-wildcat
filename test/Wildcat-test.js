var Wildcat = require('../lib/Wildcat.js'),
	async	= require('async');

//console.log = function () { throw new Error ( 'That trace you forgot is here' ); }

var router = Wildcat.Router( {
	"storage": {
		localPath: ".",
		watch: true
	},
	"streams": {
		"original": {
			"meta": "meta"
		},
		"meta": {
			"input": "**/*",
			"path": "**/*.meta.json",
			"build": [
				{ "tool": "wildcat-meta"},
				{ "input": true },
				">",
				{ "output": true }
			]
		}
	},
	"worker": {
		"storage": "tmp:/"
	}
} );

router.initialize( function ( err ) {
	if ( err ) {
		console.log( 'Init Fail', err );
	} else {
		console.log( "init");
		router.worker.tick();
	}
});



