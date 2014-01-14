var
	extend = require('extend')
;



module.exports = List( {
	BadJSON: { status: 400 },
	NotFound: { status: 404 },
	NotAFile: { status: 404 },
	NotADir: { status: 404 },
	UnknownProtocol: { status: 400 },
	InvalidSource: { status: 400 }
} );

module.exports.List = List;

function makeErrorFunc( conf )
{

	var func = function WildcatError ( args )
	{
		var error = this;
		//console.log ( "new Error", conf );
		//var error = new Error ( conf.code || "Unnamed" );
		
		//error.prototype = conf;
		//error.constructor = func;
		
		//console.log ( 'ERROR2', error );
		//extend( error, conf );
		

		error.name = conf.name || conf.code;
		error.message = error.name;
		if ( args.length == 1 )
			error.detail = args[0];
		else if ( args.length > 1 )
			error.detail = args;

		return error;
	}

	func.prototype = conf;
	conf.constructor = func;

	//extend( func.prototype, conf );

	var n = function NewFoo () {
		return new func ( arguments );
	};
	n.prototype = conf;

	return n
}

function List ( conf ) {

	var list = {};
	
	for ( var key in conf ) {
		if ( !key || !conf.hasOwnProperty( key ) )
			continue;

		var errorConf = conf[key];
		if ( errorConf === true )
			errorConf = {};

		errorConf.status = parseInt( errorConf.status ) || 500;
		errorConf.name = key;
		errorConf.message = errorConf.message || '';

		list[key] = makeErrorFunc( errorConf );
	};

	return list;
};

