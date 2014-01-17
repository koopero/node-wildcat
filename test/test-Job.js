var 
	assert = require('assert'),
	fs = require('fs'),
	Router = require('../lib/Router.js'),
	Job = require('../lib/Job.js'),
	Preset = require('../lib/Preset.js'),
	Test = require('./lib/Test.js');

describe( "Do some Preset jobs on data", function () {
	var router;

	it('should initialize the router', function ( cb ) {

		Test.CloneTestDataStorage( "test-Job", function ( err, clonedStorage ) {
			storage = clonedStorage;
			var config = Preset( 
				"stream/jpeg",
				"test/data",
				{ "storage": storage } 
			);

//			console.log( "config", JSON.stringify( config, null, 2 ) );

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

	it('should refuse to build a jpeg for an audio file', function( cb ) {
		var mp3 = router.file('/audio/silence.mp3'),
			jpeg = mp3.relative('jpeg');

		assert( jpeg, "file didn't translate" );
		assert.equal( String( jpeg.path ), '/_jpeg/audio/silence.mp3' );

		jpeg.build( function ( result ) {
			assert( result instanceof Job.Result.CondtionNotMet, "result wrong class" );
			cb();
		});
	} );

	var targa,
		targaMeta;

	it('should get the meta from a targa', function( cb ) {
		targa = router.file('/image/targa'),
		
		assert( targa, "file didn't translate" );
		assert.equal( String( targa.path ), '/image/targa' );

		targa.meta( function ( err, meta ) {
			assert.equal( meta.type, "image" );
			assert( meta['image-width'] > 15, "src isn't big enough" );
			targaMeta = meta;
			cb();
		});
	} );

	var jpegFromTarga;
	it('should build a jpeg for that targa', function ( cb ) {
		jpegFromTarga = targa.relative('jpeg');

		assert ( jpegFromTarga, "destination didn't translate" );
		assert ( String ( jpegFromTarga.path ), '/_jpeg/image/targa' );
		jpegFromTarga.build( function ( err, result ) {
			//console.log( 'result', err, result );
			assert( result instanceof Job.Result.Built, "wrong class for result" );
			cb();
		});
	});

	it('should match meta for targa to jpeg', function ( cb ) {
		jpegFromTarga.meta( function ( err, jpegMeta ) {
			['image-width', 'image-height'].forEach ( function ( k ) {
				assert( targaMeta[k], jpegMeta[k], "wrong meta field " + k );
			});

			cb();
		});
	});


	after( function ( cb ) {
		router.close( cb );
	});
});
