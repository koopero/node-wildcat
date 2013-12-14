var
	File = require('../File.js'),
	util = require('util');

module.exports = HTTPFile;

util.inherits( HTTPFile, File );

function HTTPFile ( path ) {

}

HTTPFile.prototype.readdir = function ( cb ) {
	var file = this;

	file.getInfo( function ( err ) {
		
	});
}