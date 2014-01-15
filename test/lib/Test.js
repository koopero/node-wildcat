var
	_ 		= require('underscore'),
	assert 	= require('assert'),
	http 	= require('http'),
	fs 		= require('fs'),
	pathlib = require('path'),
	testDir = pathlib.resolve( __dirname, '..' );

var Test = exports;

exports.path = function () {
	var ret = testDir;

	_.each( arguments, function ( path ) {
		path = String( path );
		ret = pathlib.join( ret, path );
	} );

	return ret;
}

exports.readJSONFile = function ( filename )
{
	return JSON.parse( fs.readFileSync( filename, { encoding: 'utf8' } ) );
}

exports.isDir = function ( filename ) {
	try {
		var stat = fs.statSync( filename );
		return stat.isDirectory();
	} catch ( e ) {
		return false;
	}
}

exports.httpGet = function ( options, cb ) {
	
	var data = '',
		req;

	req = http.request( options, function ( res ) {
		res.setEncoding( 'utf8' );
		res.on('data', function ( chunk ) {
			data += chunk;
		});
		res.on('end', function () {
			cb( null, res.statusCode, res.headers, data );
		})
	} );

	req.on( 'error', function ( err ) {
		cb(err);
	});

	req.end();
}

exports.sameList = function ( a, b ) {
	if ( a.length != b.length )
		return false;

	var i = 0, k = a.length;
	for ( ; i < k; i ++ )
		if ( a.indexOf( b[i] ) == -1 || b.indexOf( a[i] ) == -1 )
			return false;

	return true;
}


exports.startsWith = function ( haystack, needle ) {
	return haystack.substr( 0, needle.length) == needle;
}

exports.TestDataStorage = function ( cb ) {
	var storage = new (require( "../../lib/Wildcat.js" ).Storage)( Test.path( 'data' ) );

	storage.init ( function ( err ) {
		if ( err ) throw err;
		assert( Test.isDir( storage.localPath ), "Can't mount ./data" );
		cb( null, storage );
	});
}

exports.CloneTestDataStorage = function ( name, cb ) {
	exports.TestDataStorage( function ( err, testData ) {
		if ( err ) throw err;
		//assert( process.cwd() == Test.path(), "cwd is not wildcat/test" );
		var tempPath = 'tmp:'+exports.path( 'scratch/'+name ),
			clone;

		clone = new (require( "../../lib/Wildcat.js" ).Storage)( tempPath );
		clone.init( function ( err ) {
			if ( err ) throw err;
			clone.clone( testData, function ( err ) {
				if ( err ) throw err;
				cb( null, clone );
			} );
		});		
	});
}

