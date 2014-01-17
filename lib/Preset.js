var 
	_ = require('underscore'),
	extend = require('extend'),
	fs = require('fs'),
	urllib = require('url'),
	pathlib = require('path'),
	Errors = require('./Errors.js'),
	Path = require('./Path.js'),
	Utils = require('./Utils.js');

module.exports = Preset;

var 
	presetDir = pathlib.resolve( __dirname, '../presets' );

Preset.Errors = Errors.List( {
	PresetNotFound: true
});


function Preset () {


	var ret = {};

	_.each( arguments, function ( preset ) {
		if ( 'string' == typeof preset ) {
			var url = urllib.parse( preset, true ),
				path = url.pathname,
				opt = url.query || {};
		
			path = Utils.Str.ltrim( path, '/' );


			try {
				var file = pathlib.join ( presetDir, path+'.js' );
				preset = loadFile( file, opt );
			} catch ( e ) {
				throw Preset.Errors.PresetNotFound( file );
			}
			
			if ( 'function' == typeof preset )
				preset = preset( opt );
		}

		if ( 'object' == typeof preset )
			ret = extend( true, ret, preset );

	});
		

	return ret;

	function loadFile( path, opt  ) {
		var src = fs.readFileSync( path, { encoding: 'utf8' } );
		src = '('+src+');';
		
		return eval( src );
	}

}

Preset.FileStream = function ( conf, opt ) {

	if ( 'function' == typeof conf )
		conf = conf( opt );

	var name = opt.name || conf.name;

	var ext = opt.ext || conf.ext;
	var path = opt.path || conf.path;
	var src = opt.src || opt.source || conf.src;
	
	if ( path ) {
		path = String( Path( path ).leadingSlash().trailingSlash() );
	} 

	if ( src ) {
		src = String( Path( src ).leadingSlash().trailingSlash() );
	}

	var input = (src || '') + '**/*';

	if ( conf.metaFor === true ) {
		conf.metaFor = input;
	}

	if ( !ext && !path ) {
		path = '/_'+name+'/';
	}
	path = path || '';

	path += '**/*';
	if ( ext )
		path = path + ext;

	conf.path = path;
	conf.inputs = [ input ];
	delete conf.name;


	var ret = { streams: {} };
	ret.streams[name] = conf;
	return ret;
}

