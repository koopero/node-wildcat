var
	Command = require('../Command.js'),
	Shell = require('./Shell.js'),
	util = require('util'),
	Meta = require('../Meta.js'),
	Utils = require('../Utils.js');

util.inherits( MetaCommand, Shell );

module.exports = MetaCommand;

function MetaCommand( src ) {
	var cmd = this;

	cmd.query = src.query;
	cmd.template = src.template;
	cmd.opt = src.opt || {};
	cmd.src = src;

	if ( src['then'] ) {
		cmd['then'] = new Command( src['then'] );
		cmd['then'].parent = cmd;
	}

	if ( src['else'] ) {
		cmd['else'] = new Command( src['else'] );
		cmd['else'].parent = cmd;
	}

}

MetaCommand.prototype.meta = function ( context, cb ) {
	var cmd = this,
		file = context.input();

	file.meta( cmd.opt, cb );
};

MetaCommand.prototype.shell = function ( context, cb ) {
	var cmd = this;

	//console.warn ( "MetaCommandFunc.shell", cb );

	cmd.meta( context, function ( err, meta ) {
		if ( err )
			return cb( err );

		var ret;
		switch ( cmd.template ) {
			case 'ImageMagickPrefix':
				ret = Meta.Constants.SUBTYPE_TO_IMAGEMAGICK_PREFIX[ meta.subtype ];
			break;

			case 'ImageMagickOrientation':

				if ( !Meta.Constants.ROTATE_FOR_SUBTYPE[ meta['subtype'] ] )
					break;

				if ( meta['image-mirror'] == 'vertical' )
					ret = '-flip ';
				else if ( meta['image-mirror'] == 'horizontal' )
					ret = '-flop ';

				if ( meta['image-rotation'] ) 
					ret = ( ret || '' ) + '-rotate '+parseInt( meta['image-rotation'] );
			break;

			case 'ffGeom':
				var geom = calculateGeom( meta, cmd.src );
				if ( geom.width && geom.height ) {
					ret = '-s '+geom.width+'x'+geom.height;
				}
			break;

			case 'ffTime':
				var time = calculateTime( meta, cmd.src );
				ret = ret || '';
				if ( time.fps ) {
					ret += '-r '+time.fps;
				}
			break;

			default: 
				throw new Error( "Unknonwn metaArg "+ cmd.template );

		}

		ret = ret || '';

		cmd.wrap( ret, context, cb );
	});
}


function calculateTime ( meta, opt ) {
	var duration = meta['media-duration'],
		framerate = meta['video-fps'],
		ret = {};

	console.warn ( 'calculateTime', meta, opt );

	if ( opt.frames ) {
		ret.fps = parseInt( opt.frames ) / duration;
	}

	return ret;
}

function calculateGeom ( meta, opt ) {
	return opt;
}

/*
MetaCommand.prototype.bool = function ( context, cb ) {
	var cmd = this,
		file = context.input(),
		query = cmd.query;

	file.meta( cmd.opt, function ( err, meta ) {
		var result = Utils.query( meta, query );
		cb( null, result );
	});

}

MetaCommand.prototype.execute = function ( context, cb ) {
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
*/
