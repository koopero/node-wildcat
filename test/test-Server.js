var 
	assert  = require('assert'),
	Test 	= require('./Test.js'),
	Wildcat = require('../lib/Wildcat.js'),
	async	= require('async');

//console.log = function () { throw new Error ( 'That trace you forgot is here' ); }


var serverUrl = "http://localhost:5555/";

describe( "Server", function () {
	var router,
		storage,
		server;

	it( "is added to a new Router", function( cb ) {
		Test.CloneTestDataStorage( "test-Server", function ( err, clonedStorage ) {
			storage = clonedStorage;
			var routerConfig = {
				"storage": storage,
				"streams": {
					"original": true
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

		Test.httpGet( server.url('text/foobar'), function ( err, headers, content ) {
			assert.equal( content, "foobar", "Error getting /text/foobar" );
			cb();
		});
		
	});

	after( function ( cb ) {
		router.close( cb );
	});

});