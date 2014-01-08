var 
	Command = require('../Command.js'),
	child_process = require('child_process'),
	util 	= require('util'),
	pathlib = require('path'),
	fs 		= require('fs'),
	Errors  = require('../Errors.js'),
	Tools 	= require('../Tools.js'),
	Context = require('../Context.js');


module.exports = Shell;

util.inherits( Shell, Command );

Shell.Errors = Errors.List({

});

function Shell ( source ) {
	if ( this.constructor != Shell ) {
		return new Shell( source );
	}

	var shell = this;
	shell.src = source;

	if ( util.isArray ( source ) ) {
		shell.cmd = 'shell';
		shell.children = source.map ( function ( childSource ) {
			return new Command ( childSource );
		} );
	} 

	if ( 'string' == typeof source ) {
		shell.cmd = 'arg';
		shell.arg = source;
	} 
}

Shell.prototype.compileWrappers = function ( src ) {
	var cmd = this;

	if ( src.prefix )
		cmd.prefix = src;

}

Shell.prototype.shell = function ( context, callback )
{
	var shell = this;

	if ( this.children ) {

		var children = this.children.slice(),
			results = [];

		function nextChild () {
			

			if ( !children.length ) {
				lastChild();
			}
			var child = children.shift();
			

			var result = child.shell( context, function ( err, result ) {
				finishChild( result );
			} );

			if ( result !== undefined ) {
				finishChild( result );
			} 
		}

		function finishChild ( result ) {
			if ( result )
				results.push( result );

			if ( children.length ) 
				nextChild();
			else
				lastChild();
		}

		function lastChild () {
			callback ( null, results.join( ' ' ) );
		}

		nextChild();
		return;

	}

	switch ( shell.cmd ) {
		case 'arg':
			return shell.arg;
		break;
	}

}

Shell.prototype.execute = function ( context, callback ) 
{
	this.shell( context, function ( err, command ) {
		if ( err ) {
			callback( err );
			return;
		}

		context.cmd = command;

		var opt = {
			encoding: 'utf8'
		};
		if ( context.storage ) {
			opt.cwd = context.storage.localPath;
		}

		//context.log( "shell", command );

		context.childProcess = child_process.exec( command, opt, function ( err, stdout, stderr ) {

			context.stdout = stdout;
			
			delete context.childProcess;
			if ( err ) {
				callback ( err );
			} else {
				callback ( null, true );
			}
			
		});
	});
}



Shell.prototype.escape = function ( cmd ) {
	// From http://stackoverflow.com/a/7685469/1719643
	return cmd.replace(/(["\s'$`\\])/g,'\\$1');
}


