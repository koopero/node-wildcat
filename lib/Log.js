var 
	_ = require('underscore'),
	clc = require('cli-color'),
	util = require('util');

module.exports = Log;

var hightlight = [
	'Filesystem.tempDir'
]


var theme = [ clc.white, clc.blue ]

function Log( ) {
	var op = arguments[0];

	var t = theme,
		i = 0;

	_.each( arguments, function ( field ) {
		var theme = t && t[i];


		if ( i == 0 && hightlight && hightlight.indexOf( field ) != -1 ) {
			theme = theme.bold;
		} 

		if ( !theme )
			return;



		try {
			console.warn( theme( JSON.stringify( field ) ) );
		} catch ( e ) {
			console.warn( theme( util.inspect( field ) ) );
		} 

		i++;
	});

}