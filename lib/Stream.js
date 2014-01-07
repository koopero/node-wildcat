var 
	Builder = require('./Builder.js'),
	Path = require('./Path.js'),
	extend = require('extend');

function Stream ( name, config ) {
	if ( this.constructor != Stream )
		return new Stream ( name, config );

	this.name = name;
	this.conf = config;
	this.meta = config.meta;
	this.metaFor = config.metaFor;
	this.path = Path( config.path || "**" );
	this.inputs = {};

	if ( config.input )
		this.addInput ( config.input );

	if ( config.inputs )
		this.addInput ( config.inputs );

	if ( config.build ) 
		this.builder = new Builder( config.build );
}

Stream.prototype.addInput = function ( input, optional ) {
	if ( Array.isArray( input ) ) {
		for ( var i = 0; i < input.length; i ++ )
			this.inputs[input[i]] = Path(input[i]);
	} else if ( 'object' == typeof input ) {
		throw new Error ( "not implemented");
	} else if ( 'string' == typeof input ) {
		this.inputs[ input ] = Path(input);
	}

	
}

Stream.prototype.publicConfig = function () {
	var conf = extend ( {}, this.conf );
	if ( conf.storage )
		delete conf.storage;

	return conf;
}

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
}


Stream.prototype.matchPath = function ( filePath )
{
	
	filePath = String( filePath );
	var ret = this.path.match( filePath );

	return ret;
}

Stream.prototype.getFile = function ( path ) {
	path = Path(path);
	if ( path.wild )
		throw new Error ( "Path is wild" );

	var storage = this.storage || this.router.storage;
	var file = storage.file( path );
	file.stream = this;
	return file;
}

Stream.prototype.getMetaStream = function () {
	var stream = this;
	if ( stream.metaStream === undefined ) {
		for ( var otherName in stream.router.streams ) {
			var other = stream.router.streams[ otherName ];
			
			if ( other.metaFor == stream.name ) {
				stream.metaStream = other;
				break;
			}
		}
		stream.metaStream = stream.metaStream || false;
	}

	return stream.metaStream;
}

module.exports = Stream;