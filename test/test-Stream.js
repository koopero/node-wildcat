var
	assert = require('assert'),
	Test = require('./lib/Test.js'),
	Router = require('../lib/Router.js');

if( false )
describe( "A pretty standard Router", function () {
	var router;

	it('should initialize', function ( cb ) {
		router = new Router ( {
			streams: {
				'meta': {
					"inputs": "/upload/**/*",
					"path": "/meta/**/*",
				},
				'upload': {
					"path":"/upload/**"
				},
				'**': false
			},
			storage: 'tmp:'+Test.path( 'scratch/test-Stream' )
		});

		router.init( cb );
	});

	it('should get files in their appropriate streams', function ( ) {
		var file;
		file = router.file('/upload/dir/file.ext');
		assert.equal( file.stream.name, 'upload' );

		file = router.file('/upload/');
		assert.equal( file.stream.name, 'upload' );
		
		file = router.file('/upload/dir/');
		assert.equal( file.stream.name, 'upload' );

		file = router.file('/upload/file.ext');
		assert.equal( file.stream.name, 'upload' );

		file = router.file('/meta/file.ext');
		assert.equal( file.stream.name, 'meta' );

	});

	it('should not get files with no stream', function ( ) {
		var file;
		file = router.file('/');
		assert( file, undefined );

		file = router.file('/nope/notHere');
		assert( file, undefined );

		file = router.file('/meta/');
		assert( file, undefined );
	});

	it('should get a relative file', function ( ) {
		var file,
			relative;

		file = router.file('/upload/file.ext' );
		relative = file.relative('meta');

		assert.equal( String( relative.path ), "/meta/file.ext" );
		assert.equal( relative.stream.name, 'meta' );
		assert.equal( relative.stream, router.resolveStream( 'meta' ) );

		file = router.file('/meta/file.ext' );
		relative = file.relative('upload');

		assert.equal( String( relative.path ), "/upload/file.ext" );
		assert.equal( relative.stream.name, 'upload' );
		assert.equal( relative.stream, router.resolveStream( 'upload' ) );

	});
});

