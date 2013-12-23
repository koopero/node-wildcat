var pathlib = require('path'),
	path 	= function ( relativePath ) {
		return pathlib.resolve( __dirname, relativePath );
	};

module.exports = {
	"wildcat-meta": path( "../bin/meta.js" )
}