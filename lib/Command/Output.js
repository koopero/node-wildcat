var
	Shell = require('./Shell.js');

require('util').inherits( Output, Shell );

module.exports = Output;

function Output ( src ) {
	var cmd = this;
	
	cmd.output = src.output;
	cmd.compileWrappers( src );
}

Output.prototype.shell = function ( context, cb ) {
	var cmd = this,
		file = context.output( cmd.output ),
		path = file.localPath;

	return cmd.escape( path );
}

