var
	Shell = require('./Shell.js'),
	util = require('util');

util.inherits( Escape, Shell );

module.exports = Escape;

function Escape( source ) {
	var cmd = this;
	cmd.str = source.str;

}

Escape.prototype.shell = function ( context, cb )
{
	var cmd = this,
		str = cmd.str;

	cb( null, Shell.escape( str ) );
}