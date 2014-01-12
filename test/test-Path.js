var Path = require('../lib/Path.js' );
require('should');
var assert = require('assert');

describe('Path', function() {

	it('should translate',function(){
		assert.equal(
			Path.translate( 'foo.txt', '**/*.txt', '**/*.json' ),
			'foo.json'
		);

		assert.equal(
			Path.translate( 'dir/foo.txt', '**/*.txt', '**/*.json' ),
			'dir/foo.json'
		);
	})

	it('should match', function () {
		assert( Path('/meta/**/*.meta.json').match( '/meta/file.jpg.meta.json' ) );
		assert( Path('/meta/**/*.meta.json').match( '/meta/dir/file.jpg.meta.json' ) );
		assert( Path( '/upload/**').match( '/upload/file.ext') );
	});
});
