var 
	_ 				= require('underscore'),
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
	MakeTempFail: { status: 500 },
	NoPath: 	  { status: 500 }, 
	NoUniqueName: { status: 500 }
});

function Filesystem ( config ) {
	if ( 'string' == typeof config ) {
		config = { url: config };
	}
	var url = urllib.parse( config.localPath || config.url ||  '' ),
		localPath;


	switch ( url.protocol ) {
		case 'tmp:':
			this.isTemp 		= true;
			this.tempPath 		= url.pathname;
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

Filesystem.file = function ( path ) {
	if ( path instanceof LocalFile )
		return path;

	path = String( path );
	path = pathlib.resolve( path );

	var 
		storage = new Filesystem( { localPath: '/' } );

	return storage.file( path );
}


Filesystem.prototype.init = function ( callback )
{
	var filesystem = this,
		config = this.config;

	if ( filesystem.initialized ) {
		callback( null, filesystem );
		return;
	}

	async.series([
		makeTempDir,
		createDirectory,
		initWatcher
	], function( err ) {
		if ( err )
			callback( err );
		else {
			filesystem.initialized = true;
			callback( null, filesystem );
		}
	} );

	function makeTempDir ( cb ) {
		if ( filesystem.isTemp && !filesystem.localPath ) {
			var 
				temp = {},
				dir = filesystem.tempPath || '';

			if ( dir == '/' )
				dir = '';

			// url.parse tends to put a leading slash in
			// front of pathname, so compensate.
			if ( dir.substr( 0, 3 ) == '/./' )
				dir = dir.substr( 1 );

			if ( dir ) {

				if ( dir.substr( -1 ) != '/' ) {
					temp.prefix = pathlib.basename( dir );
					dir = pathlib.dirname( dir );
				} 
				temp.dir = pathlib.resolve( dir );
			}

			temp.prefix = temp.prefix || 'wildcat';



			if ( temp.dir ) {
				mkdirp( temp.dir, function ( err ) {
					if ( err ) {
						cb( Filesystem.Errors.MakeTempFail() )
					} else
						makeTemp( cb );
				});
			} else {
				makeTemp( cb );
			}


			function makeTemp ( cb ) {
				templib.mkdir( temp, function ( err, tempDir ) {
					if ( err ) {
						cb( Filesystem.Errors.MakeTempFail( err ) );
						return;
					}

					filesystem.localPath = tempDir;
					cb();
				});	
			}		
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
				filesystem.touch( path, change );
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

Filesystem.prototype.file = function ( path )
{
	if ( path instanceof File ) 
		path = path.path;

	var file = new LocalFile ( path );
	file.storage = this;
	file.localPath = this.pathToLocal ( path );

	return file;
}


Filesystem.prototype.pathToLocal = function ()
{
	var ret = this.localPath;

	_.each( arguments, function ( path ) {
		path = String( path );
		ret = pathlib.join( ret, path );
	} );

	return ret;
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
		var root = that.file ( '/' );
		doFile( root, 0, function () {
			iterator.end();
		} );
	} );

	return iterator;


	function doFile( file, level, cb ) {
		if ( iterator.cancelled ) 
			return;

		file.getInfo( function ( err, info ) {
			if ( iterator.cancelled )
				return;

			iterator.input( file );

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

Filesystem.prototype.close = function ( cb )
{
	var filesystem = this;

	//console.log( 'closing', filesystem.localPath, filesystem.isTemp );

	async.series([
		closeWatcher,
		destroyTemp
	], cb );

	function closeWatcher ( cb ) {
		if ( this.watcher ) {
			this.watcher.close();
			delete this.watcher;
		}
		cb();
	}

	function destroyTemp ( cb ) {
		if ( filesystem.isTemp ) {
			rimraf( filesystem.localPath, function ( err ) {
				filesystem.localPath = null;
				cb( err );
			});
		} else {
			cb();
		}
	}
	
}


Filesystem.prototype.inspect = function () {
	return "[FS:"+this.localPath+"]";
}




