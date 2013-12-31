var 
	assert = require('assert'),
	Meta  = require('../lib/Meta.js'),
	Test = require('./Test.js'),
	Utils = require('../lib/Utils.js');


describe( "Meta", function () {
	var storage;
	before( function( cb ) {
		Test.TestDataStorage( function ( err, stor ) {
			if ( err ) throw err;

			storage = stor;
			cb();
		});
	});

	it( 'does meta for a text file.', function ( cb ) {
		Meta( storage.file('/text/foobar'), function ( err, meta ) {
			if ( err ) throw err;

			assert( Utils.query( meta, {
				type: 'text',
				subtype: 'plain'
			}));

			cb();
		});
	});

	it( 'does meta for a nonexistent file', function ( cb ) {
		Meta( storage.file('/notAFile'), function ( err, meta ) {
			if ( err ) throw err;

			assert( Utils.query( meta, {
				type: 'void'
			}));

			cb();
		});
	});

	it('does meta for a shitty video file', function ( cb ) {
		Meta( storage.file('/video/black.1080.mp4'), function ( err, meta ) {
			if ( err ) throw err;

			assert.equal( meta['content-type'], 'video/mp4' );
			assert.equal( meta['image-width'], 1920 );
			cb();
		});
	});


});