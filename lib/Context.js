var 
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
		inputHash[stream.path] = input;
		inputHash[stream.name] = input;
	});

	outputs = outputs.map( function ( file ) {
		var localFile = storage.file( file.path );
		localFile.stream = file.stream;
		return localFile;
	});

	outputs.forEach( function ( output ) {
		var stream = output.stream;
		outputHash[stream.path] = output;
		outputHash[stream.name] = output;
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

	return context;

}

