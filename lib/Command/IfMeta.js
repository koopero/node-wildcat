var
	Command = require('../Command.js'),
	Shell = require('./Shell.js'),
	util = require('util'),
	Utils = require('../Utils.js');

util.inherits( IfMeta, Shell );

module.exports = IfMeta;

function IfMeta( source ) {
	var cmd = this;

	cmd.query = source.query || source.ifMeta || source.meta;
	if ( source.then ) {
		cmd.then = new Command( source.then );
		cmd.then.parent = cmd;
	}

	cmd.opt = source || {};

	if ( source['else'] )
		cmd.els = new Command( source['else'] );

}

IfMeta.prototype.bool = function ( context, cb ) {
	var cmd = this,
		file = context.input(),
		query = cmd.query;

	file.meta( cmd.opt, function ( err, meta ) {
		//console.warn('IfMeta.prototype.bool', meta );
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

		var execd;

		if ( value && cmd.then ) {
			cmd.then.execute( context, cb );
			execd = true;
		}

		if ( !value && cmd.els ) {
			cmd.els.execute( context, cb );
			execd = true;
		}

		if ( !execd ) {
			cb( null, value );
		}

	});
}

IfMeta.prototype.shell = function ( context, cb ) {
	var cmd = this;

	cmd.bool ( context, function ( err, value ) {
		if ( err ) {
			cb( err );
			return;
		}

		var sub = value ? cmd.then : cmd.els;

		if ( sub ) {
			sub.shell( context, function ( err, shell ) {
				if ( err ) {
					cb( err );
				} else {
					cmd.wrap( shell, context, cb );
				}
			} );
			execd = true;
		} else {
			cb( null, '' );
		}


	});
}

