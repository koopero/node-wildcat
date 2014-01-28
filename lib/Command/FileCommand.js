var
	Shell = require('./Shell.js');

require('util').inherits( FileCommand, Shell );

module.exports = FileCommand;

function FileCommand ( src ) {
	var cmd = this;
	
	cmd.input = src.input;
	cmd.compileWrappers( src );
}

FileCommand.prototype.shell = function ( context, cb ) {
	var cmd = this,
		file = context.input( cmd.input ),
		path = file.localPath;

	cmd.escape( path, context, cb );
}

