var 
	_ = require('underscore'),
	Errors = require('../lib/Errors.js');

module.exports = Command;

Command.Errors = Errors.List( {
	UnknownCommand: {
		warn: true
	}
});

function Command ( src ) {
	if ( src instanceof Command )
		return src;

	if ( this.constructor != Command ) 
		return new Command( src );


	var commandClass;

	if ( ('string' == typeof src) ||
		Array.isArray( src ) 
	) {
		return require('./Command/Shell.js')( src );
	};

	var useArg = {};
	var commands = {
		"ifMeta": {
			"class": "IfMeta",
			"query": useArg
		},
		"meta": {
			"class": "IfMeta",
			"query": useArg
		},
		"metaArg": {
			"class": "MetaCommand",
			"template": useArg
		},
		"tool": {
			"class": "Tool",
			"tool": useArg
		},
		"link": {
			"class": "Link"
		},
		"input": {
			"class": "Input"
		},
		"output": {
			"class": "Output"
		},
		"escape": {
			"class": "Escape",
			"str": useArg
		}
	};

	
	for ( var key in commands ) {
		
		if ( !(key in src) )
			continue;


		src = _.clone( src );
		var arg = src[ key ];
		delete src[ key ];

		_.each( commands[key], function ( v, k ) {
			if ( v === useArg )
				v = arg;

			src[k] = v;
		});

		//console.warn ( 'src', src, arg );

		var cmd = new (require('./Command/' + src.class + '.js' ) )( src );
		return cmd;
	}

	console.log( 'unknown', src );
	throw Command.Errors.UnknownCommand ( src );

	/*
	if ( src.ifMeta || src.meta )
		commandClass = require('./Command/IfMeta.js');


	if ( src.tool ) 
		commandClass = require('./Command/Tool.js');

	if ( src.hasOwnProperty('link') )
		commandClass = require('./Command/Link.js');
	else if ( src.input || src.input === 0 )
		commandClass = require('./Command/Input.js');
	else if ( src.output || src.output === 0 )
		commandClass = require('./Command/Output.js');
	else if ( src.escape )
		commandClass = require('./Command/Escape.js' );


	if ( commandClass ) {
		var cmd = new commandClass( src );
		cmd.src = src;
		return cmd;
	}
	*/
}

Command.prototype.shell = function ( context, cb ) {
	console.log( "SHELL?", this );
	throw new Error ( "Command not shell!");
}

Command.prototype.execute = function ( context, cb ) {
	console.log( "EXEC?", this );
	throw new Error ( "Command not implemented!");
}
