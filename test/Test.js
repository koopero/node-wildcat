var
	_ 		= require('underscore'),
	assert 	= require('assert'),
	fs 		= require('fs'),
	pathlib = require('path'),
	testDir = pathlib.resolve( __dirname );

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

exports.startsWith = function ( haystack, needle ) {
	return haystack.substr( 0, needle.length) == needle;
}

exports.TestDataStorage = function ( cb ) {
	var storage = new (require( "../lib/Wildcat.js" ).Storage)( Test.path( 'data' ) );

	storage.init ( function ( err ) {
		if ( err ) throw err;
		assert( Test.isDir( storage.localPath ), "Can't mount ./data" );
		cb( null, storage );
	});
}

