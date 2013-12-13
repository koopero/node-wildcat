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

Storage.prototype.copy = function ( destination, options ) {
	var iterator = this.eachFile( )
}