
exports.query = query;
exports.parseNumber = parseNumber;
exports.Str = {};


exports.Str.startsWith = function ( haystack, needle ) {
	return haystack.substr && needle.substr && haystack.substr( 0, needle.length ) == needle;
}

exports.Str.endsWith = function ( haystack, needle ) {
	return haystack.substr && needle.substr && haystack.substr( -needle.length ) == needle;
}


/*
	Load a local file as JSON, return undefined on failure.
*/

exports.loadJSONSync = function ( filename ) {
	var content;
	try {
		content = require('fs').readFileSync( filename, { encoding: 'utf8' } );
		content = JSON.parse( content );
		return content;
	} catch ( e ) {

		return;
	}
}

exports.loadJSON = function ( filename, cb ) {
	require('fs').readFile( filename, { encoding: 'utf8'}, function ( err, json ) {

	});
}



function query ( subject, param ) {

	if ( subject === undefined && param )
		return false;

	if ( 'object' == typeof subject) {
		if ( 'object' == typeof param ) {
			for ( var k in param ) {
				if ( !query( subject[k], param[k]) )
					return false;
			}
			return true;
		}
	}

	if ( 'string' == typeof subject && 'string' == typeof param ) 
		return subject == param;


	if ( Array.isArray ( param ) ) {
		for ( var i = 0; i < param.length; i++) 
			if ( query( subject, param[i] ) )
				return true;

		return false;
	}

	var num = 'number' == typeof subject ? subject : parseNumber ( subject );

	if ( 'number' == typeof param ) 
		return ( isNaN( param ) && isNaN( num ) ) || num == param;

	if ( 'object' == typeof param ) {



		if ( param.$gt  != undefined && ( parseNumber( param.$gt ) >= num || isNaN( num ) ) )
			return false;

		if ( param.$gte != undefined && ( parseNumber( param.$gte ) > num || isNaN( num ) ) )
			return false;
		
		if ( param.$lt  != undefined && ( parseNumber( param.$lt ) <= num || isNaN( num ) ) )
			return false;
		
		if ( param.$lte != undefined && ( parseNumber( param.$lte ) < num || isNaN( num ) ) )
			return false;
		
		if ( param.$sw != undefined && !stringStartsWith( subject, String( param.$sw ) ) )
			return false;

		if ( param.$ew != undefined && !stringEndsWith( subject, String( param.$ew ) ) )
			return false;
			 
	}

	return true;
}

function parseNumber ( str ) {
	if ( 'number' == typeof str ) 
		return str;

	if ( !str )
		return 0;

	if ( 'string' == typeof str ) {
		if ( str.match( /^\-?\d+:/ ) ) {
			match = str.match ( /^(\-?)(\d+:)?(\d+:)?(\d+:)?([\d\.]+)/ );

			if ( match ) {
				var sign = match[1] == '-' ? -1 : 1,
					seconds = parseFloat( match[5] );

				if ( match[3] === undefined ) {
					seconds += parseInt( match[2] ) * 60;
				} else if ( match[4] === undefined ) {
					seconds += parseInt( match[2] ) * 60 * 60;
					seconds += parseInt( match[3] ) * 60;
				} else {
					seconds += parseInt( match[2] ) * 60 * 60 * 24;
					seconds += parseInt( match[3] ) * 60 * 60;
					seconds += parseInt( match[4] ) * 60;
				}
				
				return sign * seconds;
			}
		}

		var num = parseFloat( str );

		if ( !isNaN( num ) )
			return num;

		var match;

		match = str.match ( /^\-?\d+\.?\d?/ );

		if ( match && match.length ) 
			return parseFloat( match[0] );

		return NaN;
	}

	throw new Error('Bad input');
}