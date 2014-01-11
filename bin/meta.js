#!/bin/sh
':' //; exec "`command -v nodejs || command -v node`" "$0" "$@"
// Credit to dancek (http://unix.stackexchange.com/a/65295) for shebang.

var argv = require('optimist')
	.usage('Usage: $0')
	.argv;

var 
	_ = require('underscore'),
	async = require('async'),
	fs = require('fs'),
	urllib = require('url'),
	temp = require('temp'),
	Meta = require('../lib/Meta.js'),
	HTTP = require('../lib/Storage/HTTP.js');

//temp.track();

var 
	opt = {},
	urls = _.toArray( argv._ );

async.mapSeries( urls, buildForUrl, function ( err, results ) {
	if ( results.length == 1 ) {
		results = results[0];
		delete results.url;
		delete results.path;
	}
		

	process.stdout.write( JSON.stringify( results, null, ' ' ) )
});


return;

function buildForUrl ( url, cb ) {
	switch ( urllib.parse(url).protocol ) {
		case 'http:':
		case 'https:':
			HTTP.request( url, 
				{ readStream: true, followRedirects: true }, 
				function ( err, status, headers, stream ) {
					if ( !stream ) {
						cb( "notfound" );
						return;
					}

					var tempfile = temp.openSync( 'wildcat-meta');
					fs.closeSync( tempfile.fd );

					var write = fs.createWriteStream( tempfile.path );

					write.on('finish', function () {
						Meta( tempfile.path, opt, function ( err, meta ) {
							if ( meta )
								meta.url = url;
							cb( err, meta );
						} );
					});
					stream.pipe( write );
					
				}
			);
		break;

		default:
			Meta( url, opt, cb );
		break;
	}
	
}