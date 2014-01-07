var
	Command = require('../Command.js'),
	util = require('util');

util.inherits( IfMeta, Command );

module.exports = IfMeta;

function IfMeta( source ) {
	var cmd = this;

	cmd.query = source.query || source.ifMeta;
	if ( source.then )
		cmd.then = new Command( source.then );

	if ( source['else'] )
		cmd.els = new Command( source['else'] );

}

IfMeta.prototype.bool = function ( context, cb ) {
	var cmd = this,
		file = context.input();

	file.getMeta( function ( err, meta ) {
		console.log('bool', meta );
		cb( null, false );
	});

}

IfMeta.prototype.execute = function ( context, cb ) {
	var cmd = this;

	cmd.bool ( context, function ( err, value ) {
		if ( err ) {
			cb( err );
			return;
		}

		if ( value && cmd.then ) {
			cmd.then.execute( context, cb );
		}

		if ( !value && cmd.els ) {
			cmd.els.execute( context, cb );
		}

	});
}
