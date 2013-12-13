var Path = require('../lib/Path.js' );
require('should');
var assert = require('assert');

describe('Path', function() {

	it('should translate',function(){
		var p = Path('**/*.jpg');
		assert.equal(
			Path.translate( 'foo.txt', '**/*.txt', '**/*.json' ),
			'foo.json'
		);

		assert.equal(
			Path.translate( 'dir/foo.txt', '**/*.txt', '**/*.json' ),
			'dir/foo.json'
		);
	})
});
