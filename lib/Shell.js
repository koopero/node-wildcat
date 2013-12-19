var 
	child_process = require('child_process'),
	util 	= require('util'),
	pathlib = require('path'),
	fs 		= require('fs'),
	Errors  = require('./Errors.js'),
	Tools 	= require('./Tools.js'),
	Context = require('./Context.js');


module.exports = Shell;

Shell.Errors = Errors.List({

});

function Shell ( source ) {
	if ( source && source.constructor == Shell )
		return source;
	
	if ( this.constructor != Shell ) {
		return new Shell( source );
	}

	if ( source )
		this.compile ( source );

}

//	Build source 


Shell.prototype.compile = function ( source )
{
	var shell = this;

	if ( util.isArray ( source ) ) {
		shell.cmd = 'shell';
		shell.children = source.map ( function ( childSource ) {
			return new Shell ( childSource );
		} );
	} 

	if ( 'string' == typeof source ) {
		shell.cmd = 'arg';
		shell.shell = source;
	} 

	if ( source.tool ) {
		shell.cmd = 'tool';
		shell.tool = String( source.tool );
	}

	if ( source.input ) {
		shell.cmd = 'input';
		shell.file = source.input;
	} else if ( source.output ) {
		shell.cmd = 'output';
		shell.file = source.output;
	}

	if ( source.prefix )
		shell.prefix = source.prefix;
}

Shell.prototype.makeCommand = function ( context, callback )
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
			

			var result = child.makeCommand( context, function ( err, result ) {
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
			ret = shell.shell;
		break;

		case 'tool':
			var tool = shell.tool;

			if ( Tools[ tool ] )
				return Tools[ tool ];

			var envPath = process.env.PATH.split(':');

			for ( var i = 0; i < envPath.length; i ++ ) {
				var searchFile = pathlib.join ( envPath[i], tool );
				if ( fs.existsSync ( searchFile ) )
					ret = searchFile;
			}
			if ( !ret ) {
				callback( Shell.Errors.ToolNotFound() );
				return;
			};
		break;

		case 'output':
			// Resolve the file
			var output = context.output();
			ret = escapeshell( output.localPath );
		break;

		case 'input':
			var input = context.input();
			ret = escapeshell( input.localPath );
		break;
	}

	if ( shell.prefix ) {
		ret = String( shell.prefix ) + ret;
	}


	return ret;
}

Shell.prototype.execute = function ( context, callback ) 
{
	this.makeCommand( context, function ( err, command ) {
		if ( err ) {
			callback( err );
			return;
		}

		context.cmd = command;

		var opt = {};
		if ( context.storage ) {
			opt.cwd = context.storage.localPath;
		}

		context.childProcess = child_process.exec( command, opt, function ( err, stdout, stderr ) {
			delete context.childProcess;
			if ( err ) {
				callback ( err );
			} else {
				callback ( null, true );
			}
			
		});
	});
}

// From http://stackoverflow.com/a/7685469/1719643
function escapeshell (cmd) {
	return cmd.replace(/(["\s'$`\\])/g,'\\$1');
};

