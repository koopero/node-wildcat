var 
	child_process = require('child_process'),
	util 	= require('util'),
	pathlib = require('path'),
	fs 		= require('fs'),
	Tools 	= require('./Tools.js'),
	Context = require('./Context.js');


module.exports = Shell;

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
	if ( util.isArray ( source ) ) {
		this.cmd = 'shell';
		this.children = source.map ( function ( childSource ) {
			return new Shell ( childSource );
		} );
	} 

	if ( 'string' == typeof source ) {
		this.cmd = 'arg';
		this.shell = source;
	} 

	if ( source.tool ) {
		this.cmd = 'tool';
		this.tool = String( source.tool );
	}

	if ( source.input ) {
		this.cmd = 'input';
		this.file = source.input;
	} else if ( source.output ) {
		this.cmd = 'output';
		this.file = source.output;
	}
}

Shell.prototype.makeCommand = function ( context, callback )
{
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

	if ( 'arg' == this.cmd ) {
		return this.shell;
	}

	if ( 'tool' == this.cmd ) {
		var tool = this.tool;

		if ( Tools[ tool ] )
			return Tools[ tool ];

		var envPath = process.env.PATH.split(':');

		for ( var i = 0; i < envPath.length; i ++ ) {
			var searchFile = pathlib.join ( envPath[i], tool );
			if ( fs.existsSync ( searchFile ) )
				return searchFile;
		}

		callback( {
			"error": "toolNotFound"
		});
		return;
	}

	if ( 'output' == this.cmd ) {
		// Resolve the file
		var output = context.output();
		return escapeshell( output.localPath );
	}

	if ( 'input' == this.cmd ) {
		// Resolve the file
		var input = context.input();
		return escapeshell( input.localPath );
	}

	return false;
}

Shell.prototype.execute = function ( context, callback ) 
{
	this.makeCommand( context, function ( err, command ) {
		console.log( "CMD", command );
		context.childProcess = child_process.exec( command, {
			cwd: context.storage.localPath
		}, function ( err, stdout, stderr ) {
			delete context.childProcess;
			callback ( err );
		});
	});
}

// From http://stackoverflow.com/a/7685469/1719643
function escapeshell (cmd) {
	return '"'+cmd.replace(/(["\s'$`\\])/g,'\\$1')+'"';
};

