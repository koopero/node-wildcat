var 
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

});


function Preset ( url, opt ) {
	if ( 'string' == typeof url )
		url = urllib.parse( url, true );

	opt = opt || {};

	extend( opt, url.query );


	var path = url.pathname;
	path = Utils.Str.ltrim( path, '/' );


	try {
		var file = pathlib.join ( presetDir, path+'.js' );
	} catch ( e ) {
		throw Preset.Errors.PresetNotFound();
	}
	
	var preset = loadFile( file );
	if ( 'function' == typeof preset )
		preset = preset( opt );

	return preset;


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