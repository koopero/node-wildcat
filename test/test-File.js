var 
	async = require('async'),
	assert = require('assert'),
	fs = require('fs'),
	Router = require('../lib/Router'),
	Job = require('../lib/Job'),
	Path = require( '../lib/Path'),
	Preset = require('../lib/Preset'),
	Test = require('./lib/Test');


describe( "File", function () {

	describe('#walk', function ( cb ) {
		var router;
		before( function ( cb ) {
			var config = {
				storage: 'tmp:/./scratch/test-File-walk',
				streams: {
					def: { path: "**" }
				}
			}

			router = new Router( config );
			router.init( function ( err ) {
				if ( err ) {
					throw new Error("Error initializing test router")
					return;
				};
				cb();
			});
		} );

		before( function ( cb ) {
			var files = [
				'/',
				'/file1',
				'/file2',
				'/file3',
				'/dir1/',
				'/dir1/file1',
				'/dir1/file2',
				'/dir1/subdir1/',
				'/dir1/subdir1/file1',
				'/dir1/subdir1/file2',
				'/dir1/subdir2/',
				'/dir1/subdir2/file1',
				'/dir1/subdir2/file2',
				'/dir1/subdir2/file3',
				'/dir2/',
				'/dir2/file1',
				'/dir2/file2',
				'/dir3/'			
			]

			async.mapSeries( files, function ( path, cb ) {
				path = Path( path );
				var file = router.file( path );
				if ( path.isDir ) {
					file.mkdir( cb );
				} else {
					file.store( "This is the file at "+path, cb );
				}
			}, cb );

		});

		it("should work with default arguments", function ( cb ) {
			var file = router.file('/');
			var iter = file.walk( function ( err, result ) {
				result = flattenWalkResult( result );
				assert( !inArray ( result, '/' ), "default erroneously returning self" );
				assert( compareArray ( result, [
					'/file1',
					'/file2',
					'/file3',
					'/dir1/',
					'/dir1/file1',
					'/dir1/file2',
					'/dir1/subdir1/',
					'/dir1/subdir1/file1',
					'/dir1/subdir1/file2',
					'/dir1/subdir2/',
					'/dir1/subdir2/file1',
					'/dir1/subdir2/file2',
					'/dir1/subdir2/file3',
					'/dir2/',
					'/dir2/file1',
					'/dir2/file2',
					'/dir3/'						
				]));
				cb()
			});

			assert( iter instanceof require('../lib/FileIterator'), "return is not FileIterator" );
		});

		it("should exclude directories when asked", function ( cb ) {
			var file = router.file('/');
			var opt = {
				dirs: false
			}
			var iter = file.walk( opt, function ( err, result ) {
				result = flattenWalkResult( result );
				assert( compareArray ( result, [
					'/file1',
					'/file2',
					'/file3',
					'/dir1/file1',
					'/dir1/file2',
					'/dir1/subdir1/file1',
					'/dir1/subdir1/file2',
					'/dir1/subdir2/file1',
					'/dir1/subdir2/file2',
					'/dir1/subdir2/file3',
					'/dir2/file1',
					'/dir2/file2'
				]));
				cb()
			});
		});

		it("should exclude files when asked", function ( cb ) {
			var opt = {
				files: false
			}

			var file = router.file('/');
			var iter = file.walk( opt, function ( err, result ) {
				result = flattenWalkResult( result );
				assert( compareArray ( result, [
					'/dir1/',
					'/dir1/subdir1/',
					'/dir1/subdir2/',
					'/dir2/',
					'/dir3/'	
				]));
				cb()
			});
		});

		it("should limit to a depth of 1", function ( cb ) {
			var opt = {
				depth: 1
			}

			var file = router.file('/');
			var iter = file.walk( opt, function ( err, result ) {
				result = flattenWalkResult( result );
				assert( compareArray ( result, [
					'/file1',
					'/file2',
					'/file3',
					'/dir1/',
					'/dir2/',
					'/dir3/'						
				]));
				cb()
			});
		});

		it("should limit to a depth of 2", function ( cb ) {
			var opt = {
				depth: 2
			}

			var file = router.file('/');
			var iter = file.walk( opt, function ( err, result ) {
				result = flattenWalkResult( result );
				assert( compareArray ( result, [
					'/file1',
					'/file2',
					'/file3',
					'/dir1/',
					'/dir1/file1',
					'/dir1/file2',
					'/dir1/subdir1/',
					'/dir1/subdir2/',
					'/dir2/',
					'/dir2/file1',
					'/dir2/file2',
					'/dir3/'						
				]));
				cb()
			});
		});



		after( function ( cb ) {
			router.close( cb );
		})

		function compareArray( arr1, arr2 ) {
			if ( arr1.length != arr2.length )
				return false;

			for ( var i = 0; i < arr1.length; i ++ )
				if ( arr2.indexOf( arr1[i] ) == -1 )
					return false;

			 for ( var i = 0; i < arr1.length; i ++ )
				if ( arr1.indexOf( arr2[i] ) == -1 )
					return false;

			return true;
		}

		function inArray ( haystack, needle ) {
			return haystack.indexOf( needle ) != -1;
		}

		function flattenWalkResult ( result ) {
			return result.map( function ( file ) {
				return String( file.path );
			});
		}

	});

	return;


	describe( "#relatives", function () {
		var router;

		before( function ( cb ) {
			router = new Router ( {
				streams: {
					'meta': {
						"inputs": "**/*",
						"path": "/_meta/**/*.meta.json"
					},
					'raw': {
						'path': '/raw/**/*.dng',
						'output': [
							'/png/fromRaw/**/*.png',
							'/_log/rawLog.txt'
						]
					},
					'log': {
						'path': '/_log/**'
					},
					'png': {
						'path': '/png/**/*'
					},
					'gifmaker': {
						'input': '/png/**/*_gif/*',
						'output': '/gif/fromPng/**/*.gif'
					},
					'thumb': {
						path: "/_thumb/**/*",
						input: "**/*",
						optional: "/assets/matte.png",
						ignore: ["/_**","/raw/**"]
					},
					'**': false
				},
				storage: 'tmp:'+Test.path( 'scratch/test-Stream' )
			});

			router.init( cb );
		});


		it("should map to other stream's inputs", function () {
			var regularPng = router.file('/png/dir/name');

			assert.equal( regularPng.stream.name, 'png' );

			var relatives = regularPng.relatives();

			compare( relatives, {
				meta: '/_meta/png/dir/name.meta.json',
				thumb: '/_thumb/png/dir/name'
			} );

		});

		it('should do relatives output', function () {
			var raw = router.file('/raw/dir/file.dng');
			assert.equal( raw.stream.name, 'raw' )

			var rel = raw.relatives();

			assert( rel.png, 'Output not found' );
			assert.equal( rel.png.path, '/png/fromRaw/dir/file.png' );
			assert.equal( rel.log.path, '/_log/rawLog.txt');
			assert( !rel.thumb, "Ignore ignored" );
		});

		it('should do relatives inputs', function () {
			var file = router.file('/_meta/raw/dir/file.dng.meta.json');
			assert.equal( file.stream.name, 'meta' );

			var rel = file.relatives();
			compare( rel, {
				raw: '/raw/dir/file.dng'
			} );
		});


		it('should reverse outputs', function () {
			var png = router.file('/png/fromRaw/dir/file.png');
			assert.equal( png.stream.name, 'png' )

			var rel = png.relatives();

			assert( rel.raw, 'outputs not reversed' );
			assert.equal( rel.raw.path, '/raw/dir/file.dng' );
		});

		it('should return an array of outputs', function () {
			var raw = router.file('/raw/foo.dng' );
			assert.equal( raw.stream.name, 'raw', "Wrong stream" );

			var rel = raw.relatives( { outputs: true, asArray: true } );

			console.warn ( rel );

			assert( Array.isArray( rel ), "Not output as array" );
			assert.equal( rel.length, 1, "Wrong length" );

		});

		function compare ( rel, to ) {
			for ( var k in to ) {
				var a = rel[k];
				var b = to[k];
				if ( a != b ) {
					throw new Error ( "Key "+k+" expected "+b+" got "+a );
				}
			}
		}
		
		

	});

	if ( false )
	describe( "#build", function () {
		describe( "(without Worker)", function () {
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

			it('should check if a job is ready', function ( cb ) {
				var jpeg = router.file('image/jpeg'),
					meta = jpeg.relative( { tag: 'meta' } ),
					opt = { check: true };

				meta.build( opt, function ( err, result ) {
					if ( err ) {
						console.log ( 'check error', err );
						throw err;
					}

					assert( result.check );
					assert( !result.complete, "result says complete without building" );

					cb();
				});
			});

			it('should build meta for a jpg', function ( cb ) {
				var jpeg = router.file('image/jpeg'),
					meta = jpeg.relative({ tag: 'meta' }),
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
					meta = jpeg.relative({ tag: 'meta' }),
					opt = {};

				meta.build( opt, function ( err, result ) {
					assert( result instanceof Job.Result.UpToDate );
					cb();
				});
			});

			it('should fail to build an impossible file', function ( cb ) {
				var notARealFile = router.file('not/a/real/file'),
					meta = notARealFile.relative({ tag: 'meta' }),
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

		describe( "with Worker", function () {
			var router;

			it('should initialize the router', function ( cb ) {

				Test.CloneTestDataStorage( "test-FileWithWorker", function ( err, clonedStorage ) {
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

			it('should check if a job is ready', function ( cb ) {
				var jpeg = router.file('image/jpeg'),
					meta = jpeg.relative({ tag: 'meta' }),
					opt = { check: true };

				meta.build( opt, function ( err, result ) {
					if ( err ) {
						console.log ( 'check error', err );
						throw err;
					}

					assert( result.check );
					assert( !result.complete );

					cb();
				});
			});



			it('should build meta for a jpg', function ( cb ) {
				var jpeg = router.file('image/jpeg'),
					meta = jpeg.relative({ tag: 'meta' }),
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
					meta = jpeg.relative({ tag: 'meta' }),
					opt = {};

				meta.build( opt, function ( err, result ) {
					assert( result instanceof Job.Result.UpToDate );
					cb();
				});
			});

			it('should fail to build an impossible file', function ( cb ) {
				var notARealFile = router.file('not/a/real/file'),
					meta = notARealFile.relative({ tag: 'meta' }),
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
		

	});






});









		



