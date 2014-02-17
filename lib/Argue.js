var
	urlParse = require('url').parse,
	extend = require('util')._extend;

module.exports = Argue;


function Argue ( args ) {
	var 
		ret = {},
		i = 0, ci = 1;

	do {
		var 
			arg = args[i],
			conf = arguments[ci],
			type = typeof arg;

		//console.log( 'Argue', arg, conf );

		if ( 'object' == typeof conf ) {
			extend( ret, conf );
			ci++;
			continue;
		}

		i++;
		if ( arg == undefined )
			continue;

		if ( type == 'object' ) {
			extend( ret, arg );
		} else if ( type == 'function' ) {
			ret.callback = arg;
		} else if ( conf == '$url' ) {
			var url;
			if ( type == 'number' ) {
				url = {
					port: arg
				}
			} else if ( type == 'string' ) {
				url = urlParse( arg );
			}

			ret.url = url;

			ci++;
		} else if ( 'string' == typeof conf ) {
			ret[conf] = arg;
			ci++;
		}

		
	} while ( i < args.length );

	while ( (conf = arguments[ci]) !== undefined ) {
		if ( 'object' == typeof conf ) {
			extend( ret, conf );
		}
		ci++;
	}

	return ret;
}