var
	Shell = require('./Shell.js');

require('util').inherits( Input, Shell );

module.exports = Input;

function Input ( src ) {
	var cmd = this;
	
	cmd.input = src.input;
	cmd.compileWrappers( src );
}

Input.prototype.shell = function ( context, cb ) {
	var cmd = this,
		file = context.input( cmd.input ),
		path = file.localPath;

	cmd.escape( path, context, cb );
}

