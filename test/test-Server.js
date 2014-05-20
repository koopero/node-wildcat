var 
	assert  = require('assert'),
	express = require('express'),
	Context = require('../lib/Context.js'),
	HTTP    = require('../lib/Storage/HTTP.js'),
	Test 	= require('./lib/Test.js'),
	Shell 	= require('../lib/Command/Shell.js'),
	Wildcat = require('../lib/Wildcat.js'),
	async	= require('async');

//console.log = function () { throw new Error ( 'That trace you forgot is here' ); }


var serverUrl = "http://localhost:5555/";

//testData = Test.readJSONFile( Test.path( 'data/testData.json' ) );

describe( "Server", function () {
	var router,
		storage,

		server;

	it( "is added to a new Router and initialized", function( cb ) {
		Test.CloneTestDataStorage( "test-Server", function ( err, clonedStorage ) {
			storage = clonedStorage;
			var routerConfig = {
				"storage": storage,
				"streams": {
					"original": {
					},
					"meta": {
						"input": "**/*",
						"metaFor": "original",
						"path": "meta/**/*.meta.json"
					}
				},
				"server": {
					"post": {
						"path": {
							"/upload/multi/*": "/post/[base][#][ext]",
							"/upload/singleFile": "/post/singleFile"
						}
					}
				}
			}

			router = new Wildcat( routerConfig );
			router.init( function ( err ) {
				if ( err ) {
					cb( err );
					return;
				};

				server = router.server;
				cb();
			});
		});
	});

	it('listens to a url', function ( cb ) {
		server.listen( serverUrl, cb );
	});

	it('should properly create urls', function () {
		assert.equal( server.url(), serverUrl, "Base url does not match" );
		assert.equal( server.url( "foo.txt" ), serverUrl+"foo.txt", "Simple url does not match" );
		assert.equal( server.url( "/foo.txt" ), serverUrl+"foo.txt", "Problem with leading slash" );
		assert.equal( server.url( "/dir/" ), serverUrl+"dir/", "Problem with trailing slash" );
		assert.equal( server.url( "/dir/", '/foo.txt' ), serverUrl+"dir/foo.txt", "Problem with multiple arguments" );
	});

	it('should serve a file', function ( cb ) {

		Test.httpGet( server.url('text/foobar'), function ( err, status, headers, content ) {
			assert.equal( content, "foobar\n", "Error getting /text/foobar" );
			cb();
		});
		
	});

	it('serves a 404', function ( cb ) {
		Test.httpGet( server.url('Does/Not/Exist'), function ( err, status, headers, content ) {
			assert( status == 404, "Wrong status code" );
			cb();
		});
	});

	it('serves 301 from a directory to a file', function ( cb ) {
		Test.httpGet( server.url('emptyFile/'), function ( err, status, headers, content ) {
			assert( status == 301, "Wrong status code" );
			assert( headers['location'] == server.url('emptyFile'), "Wrong location" );
			cb();
		})
	})

	it('serves 301 from a file to a directory', function ( cb ) {
		Test.httpGet( server.url('audio'), function ( err, status, headers, content ) {
			assert( status == 301, "Wrong status code" );
			assert( headers['location'] == server.url('audio/'), "Wrong location" );
			cb();
		})
	})

	it('should serve a linked file as a redirect', function ( cb ) {
		var linkFrom = 'link/toGif',
			linkTo = 'image/gif';
		Test.httpGet( server.url(linkFrom), function ( err, status, headers, content ) {
			assert( status == 302, "Wrong status code for link ( check test/data/link/toGif, should be symlink )" );
			assert( headers['location'] == server.url(linkTo), "Wrong location of link" )
			cb();
		});
	});

	it('should serve headers based on meta streams', function ( cb ) {
		Test.httpGet( server.url('image/targa'), function ( err, status, headers, content ) {
			assert( Test.startsWith( headers['content-type'], 'image/x-targa' ), "Wrong mime type for targa ("+headers['content-type']+")" );
			cb();
		})
	});

	it('should serve a directory listing', function ( cb ) {
		Test.httpGet( server.url('/'), function ( err, status, headers, content ) {
			assert( Test.startsWith( headers['content-type'], 'application/json' ), "Wrong mime type for index" );
			var listing = JSON.parse( content );
			//assert( Test.sameList( listing, testData.rootFiles ) );
			cb();
		});
	});

	it('should PUT a file', function ( cb ) {
		var path = 'put/someText',
			data = 'Some Text Here';

		HTTP.request( 
			server.url( path ),
			{ 
				method: 'PUT', 
				write: data,
				json: true,
				headers: {
					'content-type': 'text/plain'
				}
			},
			onRequestComplete
		);

		function onRequestComplete ( err, status, header, content ) {
			if ( err ) throw err;

			console.log( "onRequestComplete", content );

			assert.equal( status, 201, "Wrong status" );
			assert.equal( content['url'], serverUrl+path );
			assert.equal( content['size'], data.length, "Size incorrect" );

			var wroteFile = storage.file( path );
			wroteFile.readString ( function ( err, str ) {
				if ( err ) throw err;
				assert.equal( str, data, "Data was written incorrectly" );
				cb();
			});
		}
	});

	it('should set the mtime for an uploaded file', function ( cb ) {
		var path = '/put/oldFile',
			data = 'Some Text Here',
			date = new Date( 'Jan 01 2010 12:13:00 GMT-0800');

		HTTP.request( 
			server.url( path ),
			{ 
				method: 'PUT', 
				write: data,
				json: true,
				headers: {
					'content-type': 'text/plain',
					'last-modified': date.toString()
				}
			},
			onRequestComplete
		);

		function onRequestComplete ( err, status, header, content ) {
			var wroteFile = storage.file( path );
			wroteFile.stat( function ( err, stat ) {
				if ( err ) throw err;
				assert.equal( String(stat.mtime), String(date) );
				cb();
			});
		}
	});

	it('should PUT a symlink', function ( cb ) {
		var path = '/put/linkToJpeg',
			src = '/image/jpeg';

		HTTP.request(
			server.url( path ),
			{ 
				method: 'PUT',
				write: src,
				headers: {
					'content-type': 'wildcat/symlink-abspath'
				}
			}, onRequestComplete
		);

		function onRequestComplete( err, status, header, content ) {
			var wroteFile = storage.file( path );
			wroteFile.stat( function ( err, stat ) {
				assert.equal( stat.type, 'link', 'Link not created' );
				assert.equal( stat.linkPath, src, 'Link is wrong path' );
				cb();
			});
		}
	});

	it('should return a nice error when the symlink target does not exist', function ( cb ) {
		var path = '/put/linkToNothing',
			src = '/not/really/a/file';

		HTTP.request(
			server.url( path ),
			{ 
				method: 'PUT',
				write: src,
				headers: {
					'content-type': 'wildcat/symlink-abspath'
				}
			}, onRequestComplete
		);

		function onRequestComplete( err, status, header, content ) {
			assert.equal( status, 400 );
			assert.equal( header['content-type'], 'application/json' );

			content = JSON.parse( content );
			assert( content.error, "Error not in JSON" );

			assert.equal( content.error.name, "LinkTargetNotFound" );
			cb();
		}
	});

	
	it('should POST a file twice', function ( cb ) {
		var uploadFrom = storage.file( '/image/targa' ),
			uploadTo = '/upload/multi/',
			expectPath = '/post/targa',
			shell = Shell( [
				{ "tool": "curl" },
				{ "prefix": "-F file=@", "input": true },
				{ "escape": server.url( uploadTo ) }
			] ),
			context = Context( {
				inputs: [ uploadFrom ]
			} );

		uploadTarga( function ( err, result ) {
			if ( err ) throw err;
			
			var output = context.stdout;
			try {
				output = JSON.parse( output )
			} catch ( e ) {
				console.log( "shell", context.shell );
				console.log( "out", output );
				throw new Error( 'Not json from curl' );
			}

			//console.log( "shell", context.shell );
			//console.log( "out", output );

			assert( Array.isArray( output.files ), "No files in response" );
			assert.equal( output.files[0]['content-location'], server.url( expectPath ) );
			var firstUrl = output.files[0]['content-location'];
			

			uploadTarga( function ( err, result ) {
				if ( err ) throw err;

				var output = context.stdout;

				//console.log( "shell", context.shell );
				//console.log( "out", output );

				
				output = JSON.parse( output );

				assert( Array.isArray( output.files ), "No files in second response" );
				assert.notEqual( output.files[0]['content-location'], firstUrl );

				cb();
			} );
		} );

		function uploadTarga ( cb ) {
			shell.execute( context, cb );
		}

	});

	it('should POST three files at once', function ( cb ) {
		var 
			uploadTo = '/upload/multi/foo',
			context = Context( {
				inputs: [
					storage.file( '/text/foobar' ),
					storage.file( '/json/test.json' ),
					storage.file( '/emptyFile' )
				]
			}),
			shell = Shell( [
				{ "tool": "curl" },
				{ "prefix": "-F file=@", "input": 0 },
				{ "prefix": "-F otherFile=@", "input": 1 },
				{ "prefix": "-F oneMore=@", "input": 2 },
				{ "escape": server.url( uploadTo ) }
			] );

		shell.execute( context, function ( err, result ) {
			if ( err ) throw err;

			var output = context.stdout;
			try {
				output = JSON.parse( output )
			} catch ( e ) {
				console.log( "shell", context.shell );
				console.log( "out", output );
				throw new Error( 'Not json from curl' );
			}

			var files = output.files;

			assert.equal( server.url( '/post/foo'), files[0]['content-location']);
			assert.equal( server.url( '/post/foo1'), files[1]['content-location'] );
			assert.equal( server.url( '/post/foo2'), files[2]['content-location']);
			
			cb();
		});
	});

	after( function ( cb ) {
		router.close( cb );
	});

});