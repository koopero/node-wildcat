var assert = require('assert');

var Utils = require('../lib/Utils.js');

describe( 'Utils', function () {

	describe( '#parseNumber', function () {
		it('should do a loose parsing of numeric strings', function () {
			assert( Utils.parseNumber( 192 ) == 192 );
			assert( Utils.parseNumber( '192' ) == 192 );
			assert( Utils.parseNumber( '-192leftover string' ) == -192 );
			assert( Utils.parseNumber() == 0 );
			assert( Utils.parseNumber( false ) == 0 );
			assert( isNaN( Utils.parseNumber('foo') ) );
		});

		it('should do a bit of parsing of time-like strings', function () {
			assert.equal( Utils.parseNumber( '1:03' ), 63 );
			assert.equal( Utils.parseNumber( '2:04.5' ), 124.5 );
			assert.equal( Utils.parseNumber( '1:00:00' ), 3600 );
			assert.equal( Utils.parseNumber( '2:00:00:00' ), 3600 * 24 * 2);
			assert.equal( Utils.parseNumber( '-2:00:00:00' ), 3600 * 24 * -2 );
		});
	});

	describe( '#query', function () {
		var q = Utils.query;

		it('should query Strings', function () {
			assert(  q( "foo", "foo" ) );
			assert( !q( "foo", "foobar" ) );
			assert( !q( "foo", "fo" ) );
			assert( !q( "foo", "baz" ) );
		})

		it('should compare numbers and strings', function () {
			assert( q( "192kps", 192 ) );
			assert( q( 60, "1:00" ) );
			assert( q( 'foo', NaN ) );
			assert( q( NaN, 'foo' ) );
		})

		it('should compare numbers', function () {
			assert(  q( 192, { $gt: 191 } ) );
			assert(  q( 192, { $lt: 193 } ) );
			assert( !q( 192, { $lt: 192 } ) );
			assert(  q( 192, { $lte: 192 } ) );
			assert(  q( 192, { $gt: 191 } ) );

		})

		it('should compare strings', function () {
			assert(  q( "foobar", { $sw: "foo" } ) );
			assert(  q( "foobar", { $ew: "bar" } ) );
			assert(  q( "foobar", { $sw: "foob", $ew: "obar" } ) );
			assert( !q( "foobar", { $sw: "bar" } ) );
			assert( !q( "foobar", { $ew: "foo" } ) );
		})


		it('should query strings to arrays', function () {
			assert( !q( 'image', [] ) );
			assert(  q( 'image', [ 'image', 'video'] ) );
			assert( !q( 'audio', [ 'image', 'video'] ) );
		});

		it('should do meta-like comparisons', function () {
			var 
			bigMp3 = {
				type: 'audio',
				mimeType: 'audio/x-mpeg-3',
			};

			var 
			isMp3 = {
				type: 'audio',
				mimeType: ['audio/mpeg','audio/mpeg-3','audio/x-mpeg-3']
			},
			isVideo = {
				type: 'video'
			}

			assert(  q( bigMp3, isMp3 ) ); 
			assert(  !q( bigMp3, isVideo ) ); 
		});
	})
});