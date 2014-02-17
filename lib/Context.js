var 
	async 	= require('async'),
	Router 	= require('./Router.js'),
	Path 	= require('./Path.js');

module.exports = Context;

var Argue = {
	asArray: function () {
		var 
			r = [],
			i = 0,
			k = arguments.length,
			a;

		for ( ; i < k; i ++ ) {
			a = arguments[i];
			if ( Array.isArray( a ) ) {
				r = r.concat( a );
			} else if ( 'function' == typeof a ) {
				
			} else if ( a !== undefined ) {
				r.push( a );
			}
		}

		return r;
	}
}


function Context( src ) {
	if ( src.constructor == Context )
		return src;

	if ( this.constructor != Context )
		return new Context( src );


	var 
		storage 	= src.storage,
		inputs  	= Argue.asArray( src.input, src.inputs ),
		outputs 	= Argue.asArray( src.outputs, src.output ),
		inputHash 	= {},
		outputHash	= {},
		tempStorage,
		temps 		= {};


	inputs.forEach( function ( input ) {
		var stream = input.stream;
		if ( stream ) {
			inputHash[stream.path] = input;
			inputHash[stream.name] = input;
		}

		if ( !inputHash['**'] )
			inputHash['**'] = input;
	});



	outputs = outputs.map( function ( file ) {
		if ( storage ) {
			var localFile = storage.file( file.path );
			localFile.stream = file.stream;
			return localFile;
		} else {
			return file;
		}
		
	});


	console.warn( "Context", inputs, outputs );


	outputs.forEach( function ( output ) {
		var stream = output.stream;
		if ( stream ) {
			outputHash[stream.path] = output;
			outputHash[stream.name] = output;
		} else {
			outputHash["**"] = output;
		}

		if ( !outputHash['**'] )
			outputHash['**'] = output;
	});

	var context = this;

	context.outputs = outputs;

	/*{
		inputs: inputs,
		outputs: outputs,
		storage: storage
	};
	*/

	context.output = function ( src ) {
		
		if ( !src || src === true ) {
			src = '**';
		}

		return outputHash[ src ];
	} 

	context.input = function ( src ) {

		if ( !src || src === true ){
			src = '**';
		}

		return inputHash[ src ];
	}

	context.temp = function ( name, ext )
	{
		if ( !temps[name] ) {
			var storage = context.storage,
				path = '/__temp' + name;

			if ( ext ) {
				if ( ext.substr( 0, 1 ) != '.' )
					ext = '.' + ext;

				path = path + ext; 
			}

			temps[name] = storage.file( path );
		}

		return temps[name];
	}

	/*
	context.temp = function ( name, ext, cb )
	{
		if ( temps[name] ) {
			cb( null, temps[name] );
			return;
		}

		if ( tempStorage ) {
			makeFile( cb );
		} else {
			var rootStorage = context.storage;
			rootStorage.temp( function ( err, storage ) {
				if ( err ) {
					cb( err );
				} else {
					tempStorage = storage;
					makeFile( cb );
				}
			} );
		}


		function makeFile ( cb ) {
			var path = name;
			if ( ext ) {
				if ( ext.substr( 0, 1 ) != '.' )
					ext = '.' + ext;

				path = path + ext; 
			}

			temps[name] = tempStorage.file( path );
			cb ( null, temps[name] );
		}
	}
	*/

	context.mkdir = function ( cb ) {
		async.each ( outputs, function ( output, cb ) {
			output.mkdir( function ( err ) {
				if ( err )
					cb( err );
				else
					cb();
			})
		}, cb );
	}

	context.log = console.warn;
}

