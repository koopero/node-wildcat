var 
	async 			= require('async'),
	pathlib 		= require('path'),
	urllib 			= require('url'),
	fs 				= require('fs'),
	os 				= require('os'),
	templib 		= require('temp'),
	rimraf  		= require('rimraf'),
	mkdirp  		= require('mkdirp'),
	util 			= require('util');

var 
	Path 				= require('../Path.js'),
	Storage 			= require('../Storage.js'),
	Errors		 		= require('../Errors.js'),
	LocalFile		= require('./LocalFile.js'),
	TreeWatcher	= require('./TreeWatcher.js');

Filesystem.File = LocalFile;
module.exports = Filesystem;

util.inherits( Filesystem, Storage );

Filesystem.Errors = Errors.List({
	MakeTempFail: { code: Errors.Code.FSFail },
	NoPath: 	  { code: Errors.Code.BadConfig }, 
	NoUniqueName: { code: Errors.Code.FSFail }
});

function Filesystem ( config ) {
	if ( 'string' == typeof config ) {
		config = { url: config };
	}
	var url = urllib.parse( config.url || config.localPath || '' ),
		localPath;


	switch ( url.protocol ) {
		case 'tmp:':
			this.isTemp 		= true;
			this.deleteOnExit 	= true;
		break;

		case null:
		case undefined:
			this.localPath = pathlib.resolve( url.pathname );
		break;

		case 'file:':
			this.localPath = url.pathname;
		break;

	}

	this.config = config;
	this.allowOutsideSymlinks = !!config.allowOutsideSymlinks;

	if ( !this.isTemp && !this.localPath )
		throw new Error( 'Invalid Filesystem init' );

}

Filesystem.prototype.init = function ( callback )
{
	var filesystem = this,
		config = this.config;

	async.series([
		makeTempDir,
		createDirectory,
		initWatcher
	], function( err ) {
		if ( err )
			callback( err );
		else
			callback( null, filesystem );
	} );

	function makeTempDir ( cb ) {
		if ( filesystem.isTemp && !filesystem.localPath ) {
			templib.mkdir( 'wildcat', function ( err, tempDir ) {
				if ( err ) {
					cb( Filesystem.Errors.MakeTempFail() );
					return;
				}

				filesystem.localPath = tempDir;
				cb();
			});			
		} else {
			cb();
		}
	}

	function createDirectory( cb ) {
		if ( !filesystem.localPath ) {
			cb( Filesystem.Errors.NoPath() );
			return;
		}

		mkdirp( filesystem.localPath, function ( err ) {
			if ( err )
				cb( Filesystem.Errors.MakeTempFail() )
			else
				cb();
		});
	}

	function initWatcher( cb ) {
		if ( config.watch ) {

			filesystem.watcher = new TreeWatcher( filesystem.localPath, config.watch );
			
			filesystem.watcher.on('change', function ( path, change ) {
				//filesystem.log( "fsChange", path );
				path = Path( path );
				filesystem.emit( 'change', path, change );
			});
			
			cb ();
		} else {
			cb ();
		}
	}

	
}



Filesystem.prototype.log = function ()
{
	var logOb = this.router || console,
		logFunc = logOb.log;

	logFunc.apply( logOb, arguments );
}

Filesystem.prototype.getFile = function ( path )
{
	var file = new LocalFile ( path );
	file.storage = this;
	file.localPath = this.pathToLocal ( path );

	return file;
}


Filesystem.prototype.pathToLocal = function ( path )
{
	path = String( path );
	return pathlib.join( this.localPath, path );
}

Filesystem.prototype.fileExists = function ( path, callback )
{
	path = String( path );
}

Filesystem.prototype.eachFile = function ( config, callback )
{
	var that = this,
		iterator = new FileIterator ( config, callback );



	if ( 'string' == typeof config ) {
		config = {

		};
	}

	// Delay starting until nextTick so caller has
	// opportunity to set filters, etc on iterator
	// before files start coming in.
	process.nextTick( function() {
		var root = that.getFile ( '/' );
		doFile( root, 0, function () {
			iterator.complete();
		} );
	} );

	return iterator;


	function doFile( file, level, cb ) {
		if ( iterator.cancelled ) 
			return;

		file.getInfo( function ( err, file ) {
			if ( iterator.cancelled )
				return;

			iterator.file( file );

			var recurse = file.isDir;
			if ( recurse ) {
				file.listDirectory ( function ( err, files ) {
					if ( err )
						return error( err );

					files.reverse();

					function next() {
						if ( iterator.cancelled )
							return;

						var subFile = files.pop();
						if ( !subFile ) {
							cb();
							return;
						}

						doFile( subFile, level - 1, next );
					}

					next();
				});
			} else {
				cb();
			}
		});
	};
}

Filesystem.prototype.tempDir = function ( callback )
{
	var
		filesystem = this,
		nameLength = 16,
		charSet = '923568qrpsgjcb'.split(''),
		tries = 16;

	iterate();

	function iterate ( ) {
		if ( tries <= 0 ) {
			callback ( Filesystem.Errors.NoUniqueName() );
			return;
		}

		tries -= 1;

		var path = '';
		for ( var i = 0; i < nameLength; i ++ ) {
			path += charSet[ Math.floor( Math.random() * charSet.length ) ];
		}

		path += '/';
		path = filesystem.pathToLocal ( path );

		fs.stat( path, function ( err, stat ) {
			if ( !err ) {
				iterate();
				return;
			}

			var temp = new Filesystem( {
				isTemp: true,
				localPath: path
			});

			temp.init ( callback );
		} );

	}



}

Filesystem.prototype.close = function ()
{
	if ( this.watcher ) {
		this.watcher.close();
		delete this.watcher;
	}
}

Filesystem.prototype.destroy = function ( callback )
{
	this.close();
	rimraf( this.localPath, function ( err ) {
		callback( err );
	});
}

Filesystem.prototype.inspect = function () {
	return "[FS:"+this.localPath+"]";
}



