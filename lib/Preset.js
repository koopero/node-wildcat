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
			var url = urllib.parse( preset, true );
			var path = url.pathname;
		
			path = Utils.Str.ltrim( path, '/' );


			try {
				var file = pathlib.join ( presetDir, path+'.js' );
				preset = loadFile( file );
			} catch ( e ) {
				throw Preset.Errors.PresetNotFound( file );
			}
			
			

			if ( 'function' == typeof preset )
				preset = preset( url.query );
		}

		if ( 'object' == typeof preset )
			Preset.extend( ret, preset );
	});
		

	return ret;


	function loadFile( path ) {
		var src = fs.readFileSync( path, { encoding: 'utf8' } );

		src = '('+src+');';
		//console.log ( src, file );
		return eval( src );
	}

}

Preset.FileStream = function ( conf, opt ) {
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

Preset.extend = require('extend');