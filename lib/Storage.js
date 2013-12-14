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

	var urlParsed = urllib.parse( config.localPath || config.url );
	var storage;

	switch ( urlParsed.protocol ) {
		case 'file:':
		case 'tmp:':
		case null:
		case undefined:
			storage = new (require('./Storage/Filesystem.js'))( config );
		break;

		default:
			throw new Error ( "Invalid Storage url" );
	}

	return storage;
}

Storage.prototype.clone = function ( source, options, callback ) {
	if ( 'function' == typeof options ) {
		callback = options;
		options = {};
	}
	var storage = this,
		iterator = source.eachFile( options, callback );

	iterator.process( function ( srcFile, cb ) {
		var destFile = storage.getFile ( srcFile );
		destFile.store( srcFile, { recurse: false }, cb );
	} );

	return iterator;
}