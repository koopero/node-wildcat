var 
	Command = require('./Command.js'),
	Path = require('./Path.js'),
	extend = require('extend');

function Stream ( name, config ) {


	if ( this.constructor != Stream )
		return new Stream ( name, config );

	var stream = this;

	stream.name = name;
	stream.conf = config;
	stream.meta = config.meta;
	stream.metaFor = config.metaFor;
	stream.path = Path( config.path || "**" );

	if ( config['if'] ) 
		stream['if'] = new Command( config['if'] );

	if ( config.build ) 
		stream.builder = new Command( config.build );

}

Stream.prototype.init = function( cb ) {
	// body...
	var stream = this,
		router = stream.router;
		config = stream.conf,
		inputs = stream.inputs = [],
		outputs = stream.outputs = [],
		optional = stream.optional = [];

	if ( config.input )
		addRelative( inputs, config.input );

	if ( config.inputs )
		addRelative( inputs, config.inputs );

	if ( config.outputs )
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
				arr.push( relativeStream.path );
			} else {
				arr.push ( Path( input ) );
			}
		}		
	}

	cb();
};

Stream.prototype.publicConfig = function () {
	var conf = extend ( {}, this.conf );
	if ( conf.storage )
		delete conf.storage;

	return conf;
};

//	----------
//	HTTP Verbs
//	----------

Stream.prototype.get = function ( path, request, response )
{
	var that = this,
		file = this.getFile( path ),
		justHead = request.method == 'HEAD';



	path = Path ( path );

	response.set( "X-Watershed-Stream", that.name );

	if ( path.isDir ) {
		response.send( 404, { error: "Index not implemented" } );
		return;
	}



	file.getInfo ( function () {
		if ( !file.exists ) {
			response.send( 404, {
				error: "File Not Found"
			});
			return;
		}

		response.set( "Content-type", "application/foobar" );

		console.log ( "Stream get", request.method );

		if ( justHead) {
			console.log("Just the head");
			response.status( 200 );
			response.end();
		} else {
			response.sendfile( file.localPath );
		}
	
	});
};


Stream.prototype.matchPath = function ( filePath )
{
	
	filePath = String( filePath );
	var ret = this.path.match( filePath );

	return ret;
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

module.exports = Stream;