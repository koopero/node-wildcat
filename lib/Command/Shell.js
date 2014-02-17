var 
	Command = require('../Command.js'),
	Context = require('../Context.js'),
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

	if ( src.postfix )
		cmd.postfix = Command ( src.postfix );

}

Shell.prototype.shell = function ( context, cb )
{
	context = Context( context );

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

	//str = Shell.escape( str );

	cmd.wrap( str, context, function ( err, wrapped ) {
		cb( err, Shell.escape( wrapped ) );
	} );
}

Shell.prototype.wrap = function ( str, context, cb  ) {
	var cmd = this;

	async.series( [
		prefix,
		postfix
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

	function postfix ( cb ) {
		if ( !cmd.postfix  )
			cb();
		else {
			cmd.postfix.shell( context, function ( err, postfix ) {
				if ( 'string' == typeof postfix )
					str = str + postfix;
				cb( err );
			})
		}
	}
}


Shell.prototype.execute = function ( context, callback ) 
{
	context = Context( context );
	
	var cmd = this,
		log = context.log;

	async.series( [
		getShell,
		mkdir,
		execute
	], callback );
	//console.warn ( "shell.execute", cmd.src );

	function getShell ( cb ) {
		cmd.shell( context, function ( err, command ) {
			if ( err ) {
				callback( err );
			} else {
				context.shell = command;
				cb();
			}
		});
	}

	function mkdir ( cb ) {
		context.mkdir( cb );
	}

	function execute ( cb ) {
		var command = context.shell,
			opt = {
				encoding: 'utf8'
			};
		
		if ( context.storage ) {
			opt.cwd = context.storage.localPath;
		}

		Log( 'shell', command );
		
		context.childProcess = child_process.exec( command, opt, function ( err, stdout, stderr ) {

			context.stdout = stdout;
			context.stderr = stderr;

			delete context.childProcess;

			if ( err ) {
				cb ( Shell.Errors.ExecFail( command, err ) );
			} else {
				cb ( null, true );
			}
			
		});
	}
}








Shell.escape = function ( cmd ) {
	cmd = cmd || '';
	var ret = '';

	// From http://phpjs.org/functions/escapeshellarg/
	ret = cmd.replace(/[^\\]"/g, function (m, i, s) {
		return m.slice(0, 1) + '\\\"';
	});

	return '"' + ret + '"';


	//// From http://stackoverflow.com/a/7685469/1719643
	//return cmd.replace(/(["\s'$`\\\(\)\[\]])/g,'\\$1');
}




