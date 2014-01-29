var 
	Command = require('../Command.js'),
	async = require('async'),
	child_process = require('child_process'),
	util 	= require('util'),
	pathlib = require('path'),
	fs 		= require('fs'),
	Errors  = require('../Errors.js'),
	Tools 	= require('../Tools.js'),
	Context = require('../Context.js'),
	Log = require('../Log.js');


module.exports = Shell;

util.inherits( Shell, Command );

Shell.Errors = Errors.List({
	ExecFail: {
		global: true,
		error: true
	}
});

function Shell ( src ) {
	if ( this.constructor != Shell ) {
		return new Shell( src );
	}

	var shell = this;
	shell.src = src;

	if ( util.isArray ( src ) ) {
		shell.cmd = 'shell';
		shell.children = src.map ( function ( childSource ) {
			return new Command ( childSource );
		} );
	} 

	if ( 'number' == typeof src )
		src = String( src );

	if ( 'string' == typeof src ) {
		shell.cmd = 'arg';
		shell.arg = src;
	} 

	shell.compileWrappers( src );
}

Shell.prototype.compileWrappers = function ( src ) {
	var cmd = this;

	if ( src.prefix )
		cmd.prefix = Command( src.prefix );

}

Shell.prototype.shell = function ( context, cb )
{
	var shell = this;

	if ( shell.children ) {

		async.map( shell.children, function ( child, cb ) {
			child.shell( context, function ( err, result ) {
				cb( err, result );
			});
		}, function ( err, script ) {
			if ( err )
				cb( err );
			else
				shell.wrap( script.join( ' '), context, cb );
		});
	} else if ( shell.arg ) {
		shell.wrap( shell.arg, context, cb );
	} else {
		cb( Command.Errors.Invalid( shell.src ) );
	}

}

Shell.prototype.escape = function ( str, context, cb ) {
	var cmd = this;

	str = Shell.escape( str );

	cmd.wrap( str, context, cb );
}

Shell.prototype.wrap = function ( str, context, cb  ) {
	var cmd = this;

	async.series( [
		prefix
	], function ( err ) {
		cb( err, str );
	})

	function prefix ( cb ) {
		if ( !cmd.prefix  )
			cb();
		else {
			cmd.prefix.shell( context, function ( err, prefix ) {
				if ( 'string' == typeof prefix )
					str = prefix + str;
				cb( err );
			})
		}
	}
}


Shell.prototype.execute = function ( context, callback ) 
{
	var cmd = this,
		log = context.log; 

	//console.warn ( "shell.execute", cmd.src );

	cmd.shell( context, function ( err, command ) {
		//console.warn ( "shell.execute2", command );
		if ( err ) {
			callback( err );
			return;
		}

		context.shell = command;

		var opt = {
			encoding: 'utf8'
		};
		if ( context.storage ) {
			opt.cwd = context.storage.localPath;
		}

		if ( 'function' == typeof log ) {
			Log( 'shell', command );
		}

		context.childProcess = child_process.exec( command, opt, function ( err, stdout, stderr ) {

			context.stdout = stdout;
			context.stderr = stderr;

			delete context.childProcess;

			if ( err ) {
				callback ( Shell.Errors.ExecFail( command, err ) );
			} else {
				callback ( null, true );
			}
			
		});
	});
}








Shell.escape = function ( cmd ) {
	cmd = cmd || '';
	// From http://stackoverflow.com/a/7685469/1719643
	return cmd.replace(/(["\s'$`\\\(\)\[\]])/g,'\\$1');
}




