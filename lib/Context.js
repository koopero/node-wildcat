var 
	async 	= require('async'),
	Router 	= require('./Router.js'),
	Path 	= require('./Path.js');

module.exports = Context;



function Context( src ) {
	if ( src.constructor == Context )
		return src;

	if ( this.constructor != Context )
		return new Context( src );


	var 
		storage 	= src.storage,
		inputs  	= src.inputs || [],
		outputs 	= src.outputs || [],
		inputHash 	= {},
		outputHash	= {};





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

	outputs.forEach( function ( output ) {
		var stream = output.stream;
		if ( stream ) {
			outputHash[stream.path] = output;
			outputHash[stream.name] = output;
		} else {
			outputHash["**"] = output;
		}
	});

	var context = {
		inputs: inputs,
		outputs: outputs,
		storage: storage
	};

	context.output = function ( src ) {
		if ( !src || src === true ){
			for ( src in outputs ) 
				break;
		}

		return outputs[ src ];
	} 

	context.input = function ( src ) {
		if ( !src || src === true ){
			for ( src in inputs ) 
				break;
		}

		return inputs[ src ];
	}

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

	return context;

}

