var 
	_ = require('underscore'),
	events 	= require('events'),
	urllib  = require('url'),
	util 	= require('util');

var 
	Config  = require('./Config.js'),
	Log = require('./Log.js');

module.exports = Storage;

util.inherits( Storage, events.EventEmitter );

function Storage ( config ) {

	config = require('./Config.js').normalize.storage( config );

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

	storage.conf = config;

	return storage;
}


Storage.prototype.touch = function ( path, method ) {
	var storage = this;
	path = String( path );
	storage.emit( 'change', path, method );
	return true;
}

Storage.prototype.touchAll = function ( opt, cb ) {
	if ( 'function' == typeof opt ) {
		cb = opt;
		opt = {};
	}

	opt = opt || {};
	opt.includeSelf = opt.includeSelf != false;



	//Log( "Storage.touchAll" );

	var storage = this,
		root = storage.file('/'),
		iterator = root.walk( opt, cb );
	
	iterator.process( function ( file, cb ) {
		//console.warn( "TouchAll", file );
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

Storage.prototype.configLocal = function () {
	var storage = this,
		conf = storage.conf;

	conf = _.clone( conf );
	conf.localPath = storage.localPath;
	conf.url = storage.url;
	conf.protocol = storage.protocol;

	return conf;

}