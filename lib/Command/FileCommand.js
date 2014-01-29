var
	Shell = require('./Shell.js');

require('util').inherits( FileCommand, Shell );

module.exports = FileCommand;

function FileCommand ( src ) {
	var cmd = this;
	
	cmd.name = src.name;
	cmd.mode = src.mode;
	cmd.url = src.url;
	
	cmd.compileWrappers( src );
}

FileCommand.prototype.file = function ( context, cb ) {
	var cmd = this,
		file;

	switch ( cmd.mode ) {
		case 'input':
			file = context.input( cmd.name );
		break;

		case 'output':
			file = context.output( cmd.name );
		break;
	}

	cb( null, file );
}

FileCommand.prototype.shell = function ( context, cb ) {
	var cmd = this;

	cmd.file ( context, function ( err, file ) {
		if ( err ) {
			cb( err );
		} else if ( file ) {
			if ( cmd.url ) {
				cmd.escape( String( file.url() ), context, cb );
			} else {
				cmd.escape( String( file.localPath ), context, cb );
			}
			
		} else {
			cb( null, '' );
		}
	});

	
}

