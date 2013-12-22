var 
	_		= require( 'underscore' ),
	assert 	= require( 'assert' ),
	async 	= require( 'async' ),
	FileIterator = require('../lib/FileIterator'),
	Wildcat = require( "../lib/Wildcat.js" ),
	Test    = require( "./Test.js");


var lastCwd = process.cwd();
process.chdir ( Test.path() );

//testData = Test.readJSONFile( Test.path( 'data/testData.json' ) );

describe('Filesystem', function() {
	describe( "new Storage( './data' )", function () {
		var storage;

		before( function ( cb ) {
			Test.TestDataStorage ( function ( err, testDataStorage ) {
				storage = testDataStorage;
				cb( err );
			});
		})

		it('should read data from a file', function ( cb ) {
			var file = storage.file ( '/json/test.json' );
			file.readData( function ( err, data ) {
				if ( err )
					throw new Error( "Couldn't readData from ./data/json/test.json" );
				
				assert.deepEqual( data, {"bool":true,"number":4.0,"string":"foobar","null":null}, "Data read from File doesn't match" );

				testDataJson = data;
				cb();
			});
		});

		it('should read a path mismatch', function ( cb ) {
			var file = storage.file ('/emptyFile/');
			file.getInfo( function ( err ) {
				if ( err ) throw err;
				assert( String(file.path) == '/emptyFile', "Trailing slash not stripped" );
				assert( file.isFile, "File not found under wrong path" );
				cb();
			});
		});

		it('should read a directory', function ( cb ) {
			var dir = storage.file ( '/' );
			dir.readdir ( function ( err, listing ) {
				if ( err )
					throw err;

				//assert( Test.sameList( listing, testData.rootFiles ), "Directory listing of ./data/ doesn't match ./data/testData.json" );
				cb();
			});
		});

		it('should read an internal link', function ( cb ) {
			var link = storage.file ( '/link/toGif' );
			link.getInfo( function ( err ) {
				assert( link.isLink, "Link is not a link");
				assert.equal ( link.linkPath, '/image/gif' );
				cb();
			});
		});

		after( function ( cb ) {
			storage.close( cb );
		});
	});

	describe( "new Storage( 'tmp:/' )", function () {
		var storage,
			storagePath;

		it( "should mount", function ( cb ) {
			var tempPath = 'tmp:'+Test.path( 'scratch/'+'Filesystem-test' );
			storage = new Wildcat.Storage( tempPath );
			storage.init( function ( err ) {
				if ( err ) throw err;

				var storagePath = storage.localPath;
				assert( Test.isDir( storagePath ), "Directory doesn't exist" );
				assert( Test.startsWith( storagePath, Test.path()), "Directory in wrong place" );
				cb();
			});	
		});

		it('should clone from testData', function ( cb ) {
			Test.TestDataStorage ( function ( err, testDataStorage ) {
				if ( err ) throw err;
				var iterator = storage.clone( testDataStorage, {}, cb );
			});
		});

		it('should read data from a file', function ( cb ) {
			var file = storage.file ( '/json/test.json' );
			file.readData( function ( err, data ) {
				if ( err )
					throw new Error( "Couldn't readData from ./data/json/test.json" );
				
				assert.deepEqual( data, {"bool":true,"number":4.0,"string":"foobar","null":null}, "Data read from File doesn't match" );

				testDataJson = data;
				cb();
			});
		});

		it('should have properly cloned a link', function ( cb ) {
			var link = storage.file ( '/link/toGif' );
			link.getInfo( function ( err ) {
				assert( link.isLink, "Link is not a link");
				assert.equal ( link.linkPath, '/image/gif' );
				cb();
			});
		});

		/*
		it('should mount ./scratch/[TMP], clone from ./data, read and write', function ( cb ) {
			async.series( [
				createTempStorage,
				cloneFromTestData
			], cb );

			function createTempStorage ( cb ) {
				assert( process.cwd() == Test.path(), "cwd is not wildcat/test" );

				storage = new Wildcat.Storage( 'tmp:/./scratch/Filesystem-test' );
				storage.init( function ( err ) {
					if ( err ) throw err;

					storagePath = storage.localPath;
					assert( Test.isDir( storagePath ), "Directory doesn't exist" );
					assert( Test.startsWith( storagePath, Test.path()), "Directory in wrong place" );

					cb();
				});				
			}

			function cloneFromTestData ( cb ) {
				Test.TestDataStorage ( function ( err, testDataStorage ) {
					if ( err ) throw err;

					var iterator = storage.clone( testDataStorage, {}, cb );
				});
			}

		});
		*/


		after( function ( cb ) {
			storage.close( function ( err ) { 
				if ( err ) throw err;

				assert( !Test.isDir( storagePath ), "Temporary directory wasn't deleted" );
				cb();
			});
		});

	});





	/*
	it('should load a file from test data', function ( cb ) {
		console.log( "Doing data test")
		var descriptionFile = testData.file ( '/testData.json' );
		descriptionFile.readData( function ( err, data ) {
			if ( err ) throw new Error( "Error loading ./data/testData.json");
			cb();
		});
	});

	it('creates a temporary directory',function( cb ){
		storage = new Wildcat.Storage( 'tmp:/./scratch/Filesystem-test' );
		storage.init( function ( err ) {
			if ( err ) {
				console.log( err );
				cb( err );
				return;
			}

			console.log( "Storage lives at", storage.localPath );

			cb();
		});
	})
	*/

	after( function () {
		process.chdir( lastCwd );
	});
});
