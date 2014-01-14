var 
	assert = require('assert'),
	fs = require('fs'),
	Router = require('../lib/Router.js'),
	Job = require('../lib/Job.js'),
	Preset = require('../lib/Preset.js'),
	Test = require('./Test.js');

describe( "File.build() without Worker", function () {
	var router;

	it('should initialize the router', function ( cb ) {

		Test.CloneTestDataStorage( "test-File", function ( err, clonedStorage ) {
			storage = clonedStorage;
			var config = Preset( 'test/standardRouter', { "storage": storage } );

			router = new Router( config );
			router.init( function ( err ) {
				if ( err ) {
					cb( err );
					return;
				};

				assert( fs.readdirSync( storage.pathToLocal( '/meta' ) ) );
				server = router.server;
				cb();
			});
		});
	});

	it('should delete the meta from the test data clone', function ( cb ) {
		var metaDir = router.file( '/meta/' );
		metaDir.unlink ( function ( err ) {
			var deletedDir = storage.pathToLocal( '/meta' );
			assert.throws( function () { fs.readdirSync( deletedDir ) } );
			cb();
		});
	});

	it('should build meta for a jpg', function ( cb ) {
		var jpeg = router.file('image/jpeg'),
			meta = jpeg.relative('meta'),
			opt = {};

		meta.build( opt, function ( err, result ) {
			if ( err ) {
				console.log ( 'build error', err );
				throw err;
			}

			meta.readData( function ( err, data ) {
				if ( err ) throw err;

				assert.equal(data.type, 'image');
				assert.equal(data.subtype, 'jpeg');
				cb();
			})
		});
	});


	it('should return an appropriate result when the file has already been built', function ( cb ) {
		var jpeg = router.file('image/jpeg'),
			meta = jpeg.relative('meta'),
			opt = {};

		meta.build( opt, function ( err, result ) {
			assert( result instanceof Job.Result.UpToDate );
			cb();
		});
	});

	it('should fail to build an impossible file', function ( cb ) {
		var notARealFile = router.file('not/a/real/file'),
			meta = notARealFile.relative('meta'),
			opt = {};

		meta.build( opt, function ( err, result ) {
			assert( err instanceof Job.Errors.BadInput, "err is wrong type" );
			cb();
		});
	});

	after( function ( cb ) {
		router.close( cb );
	});
});



describe( "File.build() with Worker", function () {
	var router;

	it('should initialize the router', function ( cb ) {

		Test.CloneTestDataStorage( "test-File", function ( err, clonedStorage ) {
			storage = clonedStorage;
			var config = Preset( 'test/standardRouter', { "storage": storage, "worker": true } );

			router = new Router( config );
			router.init( function ( err ) {
				if ( err ) {
					cb( err );
					return;
				};

				assert( fs.readdirSync( storage.pathToLocal( '/meta' ) ) );
				server = router.server;
				cb();
			});
		});
	});

	it('should delete the meta from the test data clone', function ( cb ) {
		var metaDir = router.file( '/meta/' );
		metaDir.unlink ( function ( err ) {
			var deletedDir = storage.pathToLocal( '/meta' );
			assert.throws( function () { fs.readdirSync( deletedDir ) } );
			cb();
		});
	});

	it('should build meta for a jpg', function ( cb ) {
		var jpeg = router.file('image/jpeg'),
			meta = jpeg.relative('meta'),
			opt = {};

		meta.build( opt, function ( err, result ) {
			if ( err ) {
				console.log ( 'build error', err );
				throw err;
			}

			meta.readData( function ( err, data ) {
				if ( err ) throw err;

				assert.equal(data.type, 'image');
				assert.equal(data.subtype, 'jpeg');
				cb();
			})
		});
	});


	it('should return an appropriate result when the file has already been built', function ( cb ) {
		var jpeg = router.file('image/jpeg'),
			meta = jpeg.relative('meta'),
			opt = {};

		meta.build( opt, function ( err, result ) {
			assert( result instanceof Job.Result.UpToDate );
			cb();
		});
	});

	it('should fail to build an impossible file', function ( cb ) {
		var notARealFile = router.file('not/a/real/file'),
			meta = notARealFile.relative('meta'),
			opt = {};

		meta.build( opt, function ( err, result ) {
			assert( err instanceof Job.Errors.BadInput, "err is wrong type" );
			cb();
		});
	});

	after( function ( cb ) {
		router.close( cb );
	});
});
