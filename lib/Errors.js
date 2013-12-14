var
	extend = require('extend')
;

var Code = {
	NotFound: 404,
	BadConfig: 	500,
	BadData: 	"value", 
	EnvFail: 	501,

	Undefined: 	503
};




module.exports = List( {
	BadJSON: { code: Code.BadData },
	NotFound: { code: Code.NotFound },
	NotAFile: { code: Code.NotFound },
	NotADir: { code: Code.NotFound }
} );

module.exports.Code = Code;
module.exports.List = List;

function makeErrorFunc( conf )
{

	var func = function ()
	{
		var ret = new Error ( func.type || "Unnamed");
		ret = extend( ret, func );
		if ( arguments.length == 1 )
			ret.detail = arguments[0];
		else if ( arguments.length > 1 )
			ret.detail = arguments.slice();

		return ret;
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

		errorConf.code = parseInt( errorConf.code ) || Code.Undefined;
		errorConf.type = key;

		list[key] = makeErrorFunc( errorConf );
	};

	return list;
};

