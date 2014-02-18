var
	assert = require('assert'),
	express = require('express'),
	urllib = require('url'),
	HTTP = require('../lib/Storage/HTTP.js'),
	Test = require('./lib/Test.js'),
	Wildcat = require('../lib/Wildcat.js');


describe( "HTTP", function () {

	var 
		hostname = require('os').hostname(),
		serverPort = 5001, 
		serverUrl = urllib.format( {
			protocol: "http:",
			hostname: hostname,
			port: serverPort,
			path: '/'
		}),
		outsideServerPort = 5002,
		outsideServerUrl = urllib.format( {
			protocol: 'http:',
			hostname: hostname,
			port: outsideServerPort,
			path: '/'
		}),
		outsideServer;

	before( function ( cb ) {
		var outside = express();
		outside.get('/redirectToServer', function ( req, res ) {
			res.redirect( serverUrl );
		});

		outside.get('/redirectLoop', function ( req, res ) {
			res.redirect( '/redirectLoop' );
		});

		outside.get('/foobar', function ( req, res ) {
			res.send('foobar');
		});

		outside.get('/redirectToFoobar', function ( req, res ) {
			res.redirect('/foobar');
		});

		outsideServer = outside.listen( outsideServerPort );
		setTimeout( cb, 50 );
	});

	describe( "#request()", function () {
		it('will not follow a redirect by default', function ( cb ) {
			HTTP.request( outsideServerUrl+'/redirectToFoobar', function ( err, status, headers, content ) {
				if ( err ) throw err;
				assert.equal ( urllib.resolve( outsideServerUrl, headers['location'] ), outsideServerUrl+'/foobar' );
				cb();
			} );
		});

		it('will follow a redirect when asked nicely', function ( cb ) {
			HTTP.request( outsideServerUrl+'/redirectToFoobar', { followRedirect: true }, function ( err, status, headers, content ) {
				if ( err ) throw err;
				assert.equal ( content, 'foobar' );
				cb();
			} );
		});
		
		it('will detect a redirect loop', function ( cb ) {
			HTTP.request( outsideServerUrl+'/redirectLoop', { followRedirect: true }, function ( err, status, headers, content ) {
				if ( !err ) throw new Error( "Didn't detect redirect loop");
				cb();
			} );
		});
	});


	describe("Mirror server", function () {
		var router,
			server,
			http;

		before( function( cb ) {
			Test.CloneTestDataStorage( "server", function ( err, clonedStorage ) {
				var storage = clonedStorage;
				var routerConfig = {
					"storage": storage,
					"streams": {
						"original": {
							"meta": "meta"
						},
						"meta": {
							"input": "**/*",
							"path": "meta/**/*.meta.json"
						}
					},
					"server": { listen: serverUrl }
				}

				router = new Wildcat.Router ( routerConfig );
				router.init( function ( err ) {
					if ( err ) {
						cb( err );
						return;
					};

					server = router.server;
					//setTimeout( cb, 1000 );
					//console.log( 'serverUrl', serverUrl );
					cb();
				});
			});
		});


		it( 'will mount a url', function ( cb ) {
			http = new HTTP( { 
				url: serverUrl,
				localPath: 'tmp:/./scratch/client' 
			} );
			http.init( cb );
		} );

		it( 'will read from /text/foobar', function ( cb ) {
			var file = http.file('/text/foobar');
			file.readString( function ( err, data ) {
				if ( err ) throw err;
				assert.equal( 'foobar\n', data );
				cb();
			});
		})

		it( 'will write from a string', function ( cb ) {
			var 
				data = "barbarfoo",
				path = '/write/some/text',
				file = http.file( path );

			file.store( data, function ( err ) {
				if ( err ) throw err;
				var written = router.file( path );
				written.readString( function ( err, str ) {
					if ( err ) throw err;
					assert.equal( str, data );
					cb();
				} );
				
			});
		});

/*
		it( 'will be able to tell if a file is synced', function ( cb ) {
			var 
				data = "barbarfoo",
				path = '/write/some/text',
				file = http.file( path );

			file.store( data, function ( err ) {
				if ( err ) throw err;
				file.stat( function ( err, stat ) {
					if ( err ) throw err;

					assert( info.synced );
					cb();
				});
			});
		})
*/

		it( "will close its temp directory", function ( cb ) {
			var tempDir = http.localPath;
			http.close( function ( err ) {
				if ( err ) throw err;

				assert( !Test.isDir( tempDir  ), "Temporary directory wasn't deleted" );
				cb();
			});
		});


		after( function ( cb ) {
			router.close( cb );
		});
	});



	after( function () {
		outsideServer.close();
	});

});