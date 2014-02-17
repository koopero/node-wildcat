/**

*/

var 
	Command = require('./Command.js'),
	Preset = require('./Preset.js'),
	Log = require('./Log.js'),
	Path = require('./Path.js'),
	urllib = require('url'),
	extend = require('extend');

function Stream ( name, config ) {


	if ( this.constructor != Stream )
		return new Stream ( name, config );

	var stream = this;

	stream.name = name;
	config.name = name;
	stream.conf = config;
	stream.refresh = !!config.refresh;
	stream.meta = config.meta;
	stream.tags = [];

	arrayArg( stream.tags, config.tag );
	arrayArg( stream.tags, config.tags );


	stream.path = Path( config.path || "**" );

	function arrayArg ( array, arg ) {
		if ( Array.isArray( arg ) ) {
			for ( var i = 0; i < arg.length; i ++ ) {
				array.push( arg[i] );
			}
		} else if ( 'undefined' != typeof arg ) {
			array.push( arg );
		}
	}

}

Stream.prototype.init = function( cb ) {
	var stream = this,
		router = stream.router,
		config = stream.conf;

	if ( config.preset ) {
		var presetUrl = urllib.format( {
			pathname: config.preset,
			query: config
		});
		var preset = Preset( presetUrl )['streams'][stream.name];

		stream.config = config = extend( true, preset, config )
		//console.warn ( "after Preset", config );
	}


	if ( config['if'] ) 
		stream['if'] = new Command( config['if'] );

	if ( config.build ) 
		stream.builder = new Command( config.build );



	var	inputs = stream.inputs = [],
		outputs = stream.outputs = [],
		optional = stream.optional = [];

	if ( config.input )
		addRelative( inputs, config.input );

	if ( config.inputs )
		addRelative( inputs, config.inputs );

	if ( config.output )
		addRelative( outputs, config.output );

	if ( config.outputs )
		addRelative( outputs, config.outputs );

	if ( config.optional )
		addRelative( optional, config.optional );


	function addRelative( arr, input ) {
		if ( Array.isArray( input ) ) {
			input.forEach( function ( input ) {
				addRelative( arr, input );
			} );

		} else if ( 'string' == typeof input ) {
			var relativeStream = router.resolveStream( input );
			if ( relativeStream ) {
				//Log("Stream.init.addRelative", 'RESOLVED' );
				arr.push( relativeStream.path );
			} else {
				arr.push ( Path( input ) );
			}
		}		
	}

	cb();
};


Stream.prototype.file = function ( path ) {
	var stream = this;
	
	path = Path(path);
	if ( path.wild )
		throw new Error ( "Path is wild" );

	var storage = stream.storage || stream.router.storage;
	var file = storage.file( path );
	file.stream = stream;
	file.router = stream.router;
	return file;
};

//	---
//	Tag
//	---

Stream.prototype.hasTag = function ( tag ) {
	var stream = this;

	if ( !stream.tags )
		return false;

	return stream.tags.indexOf( tag ) != -1;
}


//	-------------
//	Configuration
//	-------------

Stream.prototype.publicConfig = function () {
	var conf = extend ( {}, this.conf );
	if ( conf.storage )
		delete conf.storage;

	return conf;
};

Stream.prototype.matchPath = function ( filePath )
{
	
	filePath = String( filePath );
	var ret = this.path.match( filePath );

	return ret;
};



module.exports = Stream;