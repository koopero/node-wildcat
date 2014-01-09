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

	var func = function ()
	{
		var error = new Error ( func.type || "Unnamed");

		error = extend( error, func );
		if ( arguments.length == 1 )
			error.detail = arguments[0];
		else if ( arguments.length > 1 )
			error.detail = arguments.slice();

		return error;
	}

	extend( func, conf );
	return func;
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
		errorConf.code = key;
		errorConf.message = errorConf.message || '';

		list[key] = makeErrorFunc( errorConf );
	};

	return list;
};

