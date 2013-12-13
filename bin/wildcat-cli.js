#!/bin/sh
':' //; exec "`command -v nodejs || command -v node`" "$0" "$@"
// Credit to dancek (http://unix.stackexchange.com/a/65295) for the wicked shebang!

var ArgumentParser = require('argparse').ArgumentParser;
var parser = new ArgumentParser({
  version: '0.0.1',
  addHelp:true,
  description: 'Wildcat playground server.'
});

parser.addArgument(
  [ 'command' ],
  {
  	choices: [ 'init', 'build', 'mirror' ],
    help: 'Command',
    defaultValue: '.'
  }
);

var args = parser.parseArgs();

var Wildcat = require('../lib/Wildcat.js');
