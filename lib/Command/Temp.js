var
	Shell = require('./Shell.js');

require('util').inherits( Temp, Shell );

module.exports = Temp;

function Temp ( src ) {
	var cmd = this;
	
	cmd.name = src.name;
	cmd.ext = src.ext;
	cmd.compileWrappers( src );
}

Temp.prototype.shell = function ( context, cb ) {
	var cmd = this,
		file = context.temp( cmd.name, cmd.ext ),
		path = file.localPath;

	cmd.escape( path, context, cb );
}

