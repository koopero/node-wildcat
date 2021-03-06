var 
	Command = require('../Command.js'),
	child_process = require('child_process'),
	util 	= require('util'),
	pathlib = require('path'),
	fs 		= require('fs'),
	Errors  = require('../Errors.js'),
	Tools 	= require('../Tools.js'),
	Context = require('../Context.js');

util.inherits( Tool, Command );

Tool.Errors = Errors.List( {
	ToolNotFound: true
})

module.exports = Tool;

function Tool ( src ) {
	var cmd = this;

	cmd.tool = src.tool;

}

Tool.prototype.shell = function ( context, cb ) {
	var 
		cmd = this,
		tool = cmd.tool;

	if ( Tools[ tool ] ) {
		cb( null, Tools[ tool ] );
		return;
	}

	var envPath = process.env.PATH.split(':'),
		ret;

	for ( var i = 0; i < envPath.length; i ++ ) {
		var searchFile = pathlib.join ( envPath[i], tool );
		if ( fs.existsSync ( searchFile ) )
			ret = searchFile;
	}
	if ( !ret ) {
		cb( Tool.Errors.ToolNotFound() );
		return;
	};

	cb( null, ret );
}