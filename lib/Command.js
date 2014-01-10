module.exports = Command;

function Command ( src ) {
	if ( this.constructor != Command ) 
		return new Command( src );


	var commandClass;

	if ( 'string' == typeof src ||
		Array.isArray( src ) ) {
		commandClass = require('./Command/Shell.js');
	}

	if ( src.ifMeta )
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
	console.log( "unknown", src );

	
	
}

Command.prototype.shell = function ( context, cb ) {
	console.log( "SHELL?", this );
	throw new Error ( "Command not shell!");
}

Command.prototype.execute = function ( context, cb ) {
	console.log( "EXEC?", this );
	throw new Error ( "Command not implemented!");
}
