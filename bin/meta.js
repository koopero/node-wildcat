#!/bin/sh
':' //; exec "`command -v nodejs || command -v node`" "$0" "$@"
// Credit to dancek (http://unix.stackexchange.com/a/65295) for shebang.

var argv = require('optimist')
	.usage('Usage: $0')
	.argv;

var Meta = require('../lib/Meta.js');


var file = argv._[0];
Meta( file, {}, function ( err, meta ) {
	console.log(meta);
});