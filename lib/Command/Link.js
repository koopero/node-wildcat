var
	Command = require('../Command.js');

require('util').inherits( Link, Command );

module.exports = Link;

function Link ( src ) {
	var cmd = this;

	cmd.input = src.input || true;
	cmd.output = src.output || true;
}

Link.prototype.execute = function ( context, cb ) {
	var cmd = this,
		from = context.input( cmd.input ),
		to = context.output( cmd.output );

	to.store( from, { link: true}, cb );

}
