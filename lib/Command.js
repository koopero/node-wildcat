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

	if ( src.input )
		commandClass = require('./Command/Input.js');

	if ( src.output )
		commandClass = require('./Command/Output.js');

	this.src = src;

	if ( commandClass )
		return new commandClass( src );

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
