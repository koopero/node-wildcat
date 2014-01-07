var 
	assert  = require('assert'),
	express = require('express'),
	Test 	= require('./Test.js'),
	Wildcat = require('../lib/Wildcat.js'),
	async	= require('async');

//console.log = function () { throw new Error ( 'That trace you forgot is here' ); }


var serverUrl = "http://localhost:5555/";

//testData = Test.readJSONFile( Test.path( 'data/testData.json' ) );

describe( "Server", function () {
	var router,
		storage,
		server,
		outsideServer;

	it( "is added to a new Router and initialized", function( cb ) {
		Test.CloneTestDataStorage( "test-Server", function ( err, clonedStorage ) {
			storage = clonedStorage;
			var routerConfig = {
				"storage": storage,
				"streams": {
					"original": {
						"meta": "meta"
					},
					"meta": {
						"input": "**/*",
						"metaFor": "original",
						"path": "meta/**/*.meta.json"
					}
				},
				"server": true
			}

			router = new Wildcat.Router ( routerConfig );
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
		Test.httpGet( server.url('link/toGif'), function ( err, status, headers, content ) {
			assert( status == 302, "Wrong status code for link" );
			assert( headers['location'] == server.url('image/gif'), "Wrong location of link" )
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
	})

	after( function ( cb ) {
		router.close( cb );
	});

});