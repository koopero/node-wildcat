
exports.query = query;
exports.parseNumber = parseNumber;
exports.uniquePath = uniquePath;
var Str = exports.Str = {};


Str.startsWith = function ( haystack, needle ) {
	return haystack.substr && needle.substr && haystack.substr( 0, needle.length ) == needle;
}

Str.endsWith = function ( haystack, needle ) {
	return haystack.substr && needle.substr && haystack.substr( -needle.length ) == needle;
}

Str.ltrim = function ( str, trim ) {
	if ( 'string' == typeof trim && trim.length )
		while ( str.substr( 0, trim.length ) == trim ) {
			str = substr( trim.length );
		}

	return str;
}

var File = exports.File = {};
File.isDirSync = function ( file ) {
	try { 
		var stat = require('fs').statSync( file );
		return stat.isDirectory();
	} catch ( err ) {
		return false;
	}

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

exports.loadYAML = function ( filename, cb ) {
	require('fs').readFile( filename, { encoding: 'utf8' }, onReadFile );
	function onReadFile ( err, fileData ) {
		if ( err ) {
			cb( err );
			return;
		}

		var yamllib = require('js-yaml');

		try {
			var data = yamllib.safeLoad( fileData );
		} catch ( err ) {
			cb( err );
			return;
		}

		cb( null, data );

	}
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
		
		if ( param.$sw != undefined && !Str.startsWith( subject, String( param.$sw ) ) )
			return false;

		if ( param.$ew != undefined && !Str.endsWith( subject, String( param.$ew ) ) )
			return false;
			 
	}

	return true;
}

function parseNumber ( str ) {
	if ( 'number' == typeof str ) 
		return str;

	if ( !str )
		return 0;


	var match, num;
	
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
		} else if ( match = str.match( /^(\-?\d+\.?\d*)(kb|mb|gb)?/i ) ) {
			num = parseFloat( match[1] );
			switch ( match[2] && match[2].toLowerCase() ) {
				case 'gb':
					num *= 1024;
				case 'mb':
					num *= 1024;
				case 'kb':
					num *= 1024;
				break
			}

			return num;

		} else {
			return NaN;
		}

	}

	throw new Error('Bad input');
}

var pathlib = require('path');


function uniquePath ( path, template, iteration ) {
	if ( !template )
		return path;

	path = path || '';

	var 
		ext = pathlib.extname( path ),
		base = pathlib.basename( path, ext ),
		dir = pathlib.dirname( path );

	if ( dir == '.' )
		dir = '';

	if ( dir && dir.substr( -1 ) != '/' )
		dir = dir + '/';
		


	return template.replace ( /\[([\w\#]+)(:\d+)?\]/g, function ( tag, cmd, digits ) {
		if ( digits )
			digits = digits.substr( 1 );
		digits = ( digits && parseInt( digits ) ) || 0;
		var date = new Date();

		switch ( cmd ) {
			case 'date':
				return date.toJSON();

			case 'F':
			case 'file':
				return trim( base + ext );

			case 'B':
			case 'base':
				return trim( base );

			case 'dir':
				return trim( dir );

			case 'E':
			case 'ext':
				return trim( ext )

			case '#':
				return digits ?	pad( iteration || 0 ) : iteration ? String( iteration ) : '';

			case '?':
			case 'rand':
				
				digits = digits || 4;

				var 
					//set = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
					// Less entropy, but prettier.
					set = 'BCDGJOPQRSUabcdefgjnopqrstuy0235689',
					i = 0,
					r = '';

				for ( ; i < digits; i ++ )
					r += set[ Math.floor( Math.random() * set.length ) ];

				return r;

		}

		digits = digits || 2;
		var date = new Date();

		switch ( cmd ) {
			case 'Y': return pad( date.getFullYear() );
			case 'M': return pad( date.getMonth() + 1 );
			case 'D': return pad( date.getDate() );
			case 'h': return pad( date.getHours() );
			case 'm': return pad( date.getMinutes() );
			case 's': return pad( date.getSeconds() );
		}

		function trim ( str ) {
			str = String(str);
			return digits ? str.substr( 0, digits ) : str;
		}

		function pad ( num ) {
			num = String( num );
			while ( num.length < digits ) {
				num = '0'+num;
			}
			if ( num.length > digits )
				num = num.substr( num.length - digits );

			return num;
		}
	});
}


