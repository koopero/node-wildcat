var
	Command = require('../Command.js'),
	extend = require('extend'),
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

}

MetaCommand.prototype.meta = function ( context, cb ) {
	var cmd = this,
		file = context.input();

	file.meta( cmd.opt, cb );
};

MetaCommand.prototype.shell = function ( context, cb ) {
	var cmd = this,
		opt = extend( {}, context.var, cmd.src );

	//console.warn ( "MetaCommandFunc.shell", cb );

	cmd.meta( context, function ( err, meta ) {
		if ( err )
			return cb( err );

		var ret;
		switch ( cmd.template ) {
			case 'ImageMagickPrefix':
			case 'magickPrefix':
				ret = Meta.Constants.SUBTYPE_TO_IMAGEMAGICK_PREFIX[ meta.subtype ];
			break;

			case 'ImageMagickOrientation':
			case 'magickOrientation':

				if ( !Meta.Constants.ROTATE_FOR_SUBTYPE[ meta['subtype'] ] )
					break;

				if ( meta['image-mirror'] == 'vertical' )
					ret = '-flip ';
				else if ( meta['image-mirror'] == 'horizontal' )
					ret = '-flop ';

				if ( meta['image-rotation'] ) 
					ret = ( ret || '' ) + '-rotate '+parseInt( meta['image-rotation'] );
			break;

			case 'magickGeom':
				var geom = calculateGeom( meta, opt ),
					arg = geomToMagickCommands( geom, opt );

				console.warn( "GEOM VAR", opt, geom, arg );

				cb( null, arg );
				return;
			break;


			case 'ffGeomFilter':
				var geom = calculateGeom( meta, cmd.src ),
					filters = [];

				if ( geom.cropX != undefined ) {
					filters.push( 
						"crop="+
						"x="+geom.cropX+":"+
						"y="+geom.cropY+":"+
						"w="+geom.cropW+":"+
						"h="+geom.cropH
					)
				}

				if ( geom.scaleW != undefined ) {
					filters.push(
						"scale="+
						"w="+geom.scaleW+":"+
						"h="+geom.scaleH)
				}

				if ( filters.length ) {
					filters = filters.join(',');
					var line = '-vf "'+filters+'"';
					cb( null, line );		
					return;	
				}


				

				
			break;

			case 'ffSeek':
			break;


			case 'ffTime':
				var time = calculateTime( meta, cmd.src );
				ret = ret || '';
				if ( time.fps ) {
					ret += '-r '+time.fps;
				}
			break;

			default: 
				throw new Error( "Unknown metaArg "+ cmd.template );

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

	var 
		srcW = defaultNum( meta['image-width'], 0 ),
		srcH = defaultNum( meta['image-height'], 0 ),
		srcPA = defaultNum( meta['image-pixel-aspect'], 1);

	var
		mode = opt.mode,
		destW = defaultNum( opt.width, NaN ),
		destH = defaultNum( opt.height, NaN ),
		destA = destW / destH,
		destPA = defaultNum( opt.pixelAspect, 1 ) || srcA,
		round = defaultNum( opt.round, 16 ),
		xAlign = parsePercent( opt.xAlign, 0.5 ),
		yAlign = parsePercent( opt.yAlign, 0.5 );


	var 
		scaleX = destW / srcW,
		scaleY = destH / srcH;

	var
		ret = {};


	if ( isNaN( destW ) && isNaN( destH ) ) {

	} else if ( isNaN( destW ) ) {
		ret.scaleW = srcW * scaleY;
		ret.scaleH = destH;
	} else if ( isNaN( destH) ) {
		ret.scaleW = destW;
		ret.scaleH = srcW * scaleX;
	} else {
		//console.log( 'mode', String(mode).toLowerCase() );
		switch ( String(mode).toLowerCase() ) {
			case 'max':
			case 'crop':
			case 'cover':
				if ( scaleX < scaleY ) {
					ret.cropW = srcH * destA;
					ret.cropH = srcH;
					ret.cropX = Math.round( srcW - ret.cropW ) * xAlign;
					ret.cropY = 0;
				} else {
					ret.cropW = srcW;
					ret.cropH = Math.round( srcW / destA );
					ret.cropX = 0;
					ret.cropY = Math.round( srcH - ret.cropH ) * yAlign;
				}

				ret.scaleW = destW;
				ret.scaleH = destH;
			break;
		}
	}


	//console.log( 'dest', destW, destH );

	//console.log( 'geom', opt, ret );
	//throw new Error();


	return ret;
}

function geomToMagickCommands ( geom, opt ) {
	var args = [];

	if ( geom.cropX != undefined ) {
		args.push( '-crop');
		args.push( geom.cropW+'x'+geom.cropH+'+'+geom.cropX+'+'+geom.cropY );
		args.push( '+repage' );
	}

	if ( geom.scaleW != undefined ) {
		args.push( "-adaptive-resize" );
		args.push( geom.scaleW+"x"+geom.scaleH );
	}

	return args.join(' ');	
	
}


function defaultNum( parse, defaultValue ) {
	if ( parse === undefined )
		return defaultValue;

	parse = parseFloat( parse );

	if ( isNaN( parse ) )
		return defaultValue;

	return parse;
}

function parsePercent ( parse, defaultValue ) {
	return defaultNum( parse, defaultValue );
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
