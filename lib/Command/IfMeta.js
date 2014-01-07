var
	Command = require('../Command.js'),
	util = require('util'),
	Utils = require('../Utils.js');

util.inherits( IfMeta, Command );

module.exports = IfMeta;

function IfMeta( source ) {
	var cmd = this;

	cmd.query = source.query || source.ifMeta;
	if ( source.then ) {
		cmd.then = new Command( source.then );
		cmd.then.parent = cmd;
	}

	if ( source['else'] )
		cmd.els = new Command( source['else'] );

}

IfMeta.prototype.bool = function ( context, cb ) {
	var cmd = this,
		file = context.input(),
		query = cmd.query;

	file.getMeta( function ( err, meta ) {
		var result = Utils.query( meta, query );
		cb( null, result );
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
