var 
	async	= require('async'),
	fs 		= require('fs'),
	pathlib = require('path'),
	join 	= pathlib.join,
	util 	= require('util'),
	events	= require('events'),
	_ 		= require('underscore'),
	Tree 	= require('../Tree.js');

module.exports = TreeWatcher;
util.inherits ( TreeWatcher, events.EventEmitter );



function TreeWatcher ( root, options ) {

	var that = this;

	this.tree = new Tree ();
	this.tree.path = '';
	this.path = pathlib.resolve( root );
	
	this.persistent = true;
	this.ignoreDotFiles = true;
	this.rememberFiles = true;
	this.emitInitial = true;
	this.delay = 0;
	
	//	-----------------------
	//	Declare bound functions
	//	-----------------------

	that.onChange = function ( event, filename ) {
		var node = this.__tree,
			unspecific = false;
		
		if ( filename && filename.length ) {
			file( filename );
		} else {
			console.log ( "No fucking filename :P", that.fullPath( node.path ) );
			unspecific = true;
			fs.readdir ( that.fullPath( node.path ), function ( err, listing ) {
				console.log ( err, listing );
				
				if ( err ) {
					return;
				}

				if ( node.files )
					listing = _.union( listing, node.files );

				listing.forEach ( file );
			});
		}


		function file ( filename ) {
			if ( that.ignoreDotFiles && filename.substr( 0, 1 ) == '.' )
				return;

			var 
				filePath = join ( node.path, filename );
				fullPath = that.fullPath( filePath );


			fs.stat( fullPath, function ( err, stat ) {
				var fileInd = node.files ? node.files.indexOf ( filename ) : -1,
					wasFile = fileInd != -1,
					wasDir	= !!node.children && ( filename in node.children ),
					isFile	= !err && stat.isFile(),
					isDir 	= !err && stat.isDirectory(),
					slashPath = filePath + ( wasDir || isDir ? '/' : '' ),
					change 	= {};

				//console.log( 'stat', filePath, wasFile, isFile, wasDir, isDir );

				if ( unspecific && wasDir == isDir && wasFile == isFile ) {
					console.log ( "bail on same");
					return;
				}
				
				if ( that.rememberFiles ) {
					if ( !wasFile && isFile ) {
						if ( !node.files )
							node.files = [ filename ];
						else 
							node.files.push( filename );
						change.create = true;
					} else if ( wasFile && !isFile ) {
						if ( fileInd != -1 )
							node.files.splice ( fileInd, 1 );
						change.remove = true;
					}
				}

				if ( wasDir && !isDir ) {
					that.removeDirectory ( filePath, true );
				} else if ( !wasDir && isDir ) {
					that.addDirectory ( filePath, true );
				}

				if ( change ) {
					that.delayEmit( slashPath, change );
				}
			});
		}
	}

	that.flush = function () {
		var leftover = {},
			time = now();
		for ( var filePath in that.queue ) {
			var change = that.queue[filePath];
			if ( change.time > time + that.delay ) {
				leftover[filePath] = change;
				continue;
			}

			if ( change.create )
				that.emit( 'create', filePath );

			if ( change.remove )
				that.emit( 'remove', filePath );

			//console.log ( "Emiting", filePath );
			that.emit('change', filePath, change.create ? 'create' : change.remove ? 'remove' : 'update' );
		}

		that.queue = leftover;
	}

	//	----------
	//	Initialize
	//	----------

	if ( that.emitInitial && !that.delay ) {
		// Wait for nextTick to give creator
		// chance to add listeners, etc.
		process.nextTick( function () {
			that.addDirectory( '', true );
		});
	} else {
		that.addDirectory( '', that.emitInitial );
	}
	
}

TreeWatcher.prototype.delayEmit = function ( path, change ) {
	if ( !this.queue )
		this.queue = {};

	var existingChange = this.queue[path];
	if ( existingChange ) {
		existingChange.remove = existingChange.remove || change.remove;
		existingChange.create = existingChange.create || change.create;
		change = existingChange;
		if ( change.remove && change.create ) {
			change.remove = false;
			change.create = false;
		}
	} else {
		this.queue[ path ] = change; 
	}

	
	if ( this.delay > 0 ) {
		change.time = now();
		setTimeout( this.flush, this.delay );
	} else {
		this.flush();
	}
}

TreeWatcher.prototype.fullPath = function ( relativePath )
{
	if ( !relativePath )
		return this.path;

	return pathlib.join ( this.path, relativePath );
}

TreeWatcher.prototype.addDirectory = function ( path, emit )
{
	//console.log( "addDirectory", path );
	var that = this,
		dirPath = that.fullPath( path );

	var node = path == '' ? that.tree : that.tree.walk( path, true );

	fs.readdir( dirPath, function ( err, listing ) {
		if ( err ) {
			that.removeDirectory( path, emit );
			return;
		}

		
		async.each( listing, function ( filename, callback ) {
			if ( that.ignoreDotFiles && filename.substr( 0, 1 ) == '.' ) {
				callback( null );
				return;
			}

			var filePath = join( path, filename ) ;
			fs.stat( that.fullPath( filePath ), function ( err, stat ) {
				if ( stat.isDirectory() ) {
					if ( emit ) {
						that.delayEmit( filePath + '/', {
							create: true
						} );
					}
					that.addDirectory( join( path, filename ), emit );
				} else if ( stat.isFile () && that.rememberFiles ) {
					if ( node.files )
						node.files.push( filename );
					else 
						node.files = [ filename ];

					if ( emit ) {
						that.delayEmit( filePath, {
							create: true
						} );
					}
				} 

				callback( null );
			});
		});

		var watcher = fs.watch( dirPath, { persistent: true } );
		watcher.on('change', that.onChange );
		watcher.__tree = node;
		node.watcher = watcher;

	});
}

TreeWatcher.prototype.removeDirectory = function ( node, emit )
{
	var that = this;

	if ( 'string' == typeof node ) {
		path = node;
		node = path == '' ? that.tree : that.tree.walk ( node );
	} else {
		path = node.path;
	}

	if ( node ) {
		if ( node.children ) {
			for ( var k in node.children ) {
				that.removeDirectory( node.children[k], emit );
			}
		}

		if ( node.watcher ) {
			node.watcher.close();
			delete node.watcher;
		}

		if ( emit ) {
			if ( node.files )
				node.files.forEach ( function ( filename ) {
					that.delayEmit ( join( node.path, filename ), {
						remove: true
					})
				} );

			that.delayEmit( node.path + '/', {
				remove: true
			});
		}

		node.delete();
	}
}

TreeWatcher.prototype.close = function ()
{
	var that = this;

	that.removeDirectory( '', false );
	that.removeAllEventListeners();
}

function now()
{
	return new Date().getTime();
}

