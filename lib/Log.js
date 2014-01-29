var 
	_ = require('underscore'),
	clc = require('cli-color'),
	util = require('util');

module.exports = Log;

var hightlight = [
	'Filesystem.tempDir'
];

var ignore = [
	//'shell'
]


var theme = [ clc.white, clc.blue, clc.green, clc.red ]

function Log( ) {
	var op = arguments[0];

	var t = theme,
		i = 0;

	function printLine ( str ) {
		var theme = t && t[i];

		if ( !theme )
			return;

		if ( !str )
			return true;

		i++;

		console.warn ( theme( str ) );
	}

	if ( ignore.indexOf( op ) != -1 )
		return;

	printLine( op );


	for ( var argi = 1; argi < arguments.length; argi ++ ) {
		var arg = arguments[argi];
		if ( 'string' == typeof arg ) {
			printLine( arg );
		} else if ( 'object' == typeof arg && arg.name && arg.message ) {
			printLine( arg.name );
			printLine( arg.message );
			if ( arg.detail ) {
				_.each( arg.detail, function ( detail ) {
					printLine( detail );
				});
			}
		} else {
			printLine( util.inspect( arg ) );
		}
	}



}