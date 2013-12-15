var 
	events 	= require('events'),
	urllib  = require('url'),
	util 	= require('util');


module.exports = Storage;

util.inherits( Storage, events.EventEmitter );

function Storage ( config ) {

	if ( 'string' == typeof config )
		config = {
			url: config
		};
	else if ( null == config ) 
		throw new Error ( "Invalid Storage configuration");

	if ( config instanceof Storage )
		return config;

	var urlParsed = urllib.parse( config.url || config.localPath );
	var storage;

	switch ( urlParsed.protocol ) {
		case 'file:':
		case 'tmp:':
		case null:
		case undefined:
			storage = new (require('./Storage/Filesystem.js'))( config );
		break;

		case 'http:':
		case 'https:':
			storage = new (require('./Storage/HTTP.js'))( config );
		break;

		default:
			throw new Error ( "Invalid Storage url" );
	}

	return storage;
}


Storage.prototype.touch = function ( path, method ) {
	var storage = this;
	path = String( path );
	storage.emit( 'change', path, method );
	return true;
}

Storage.prototype.touchAll = function ( options, cb ) {
	if ( 'function' == typeof options ) {
		cb = options;
		options = {};
	}

	var storage = this,
		root = storage.file('/'),
		iterator = root.walk( options, cb );
	
	iterator.process( function ( file, cb ) {
		file.touch();
		cb();
	});

	return iterator;
} 


Storage.prototype.clone = function ( source, options, callback ) {
	if ( 'function' == typeof options ) {
		callback = options;
		options = {};
	}
	var storage = this,
		iterator = source.eachFile( options, callback );

	iterator.process( function ( srcFile, cb ) {
		var destFile = storage.file ( srcFile );
		destFile.store( srcFile, { recurse: false }, cb );
	} );

	return iterator;
}