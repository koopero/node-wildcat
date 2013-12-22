var
	assert = require('assert');

var
	Builder = require('../lib/Builder.js'),
	Context = require('../lib/Context.js'),
	Test = require('./Test.js');


describe( "Builder", function () {
	var scratch;

	before( function ( cb ) {
		Test.CloneTestDataStorage( "mocha-Builder", function ( err, storage ) {
			if ( err ) throw err;
			scratch = storage;
			cb();
		});
	});

	it('will capture the output of a shell command', function ( cb ){
		var context = Context({
			stdout: true
		});

		var builder = Builder({
			shell: [ { tool: 'pwd'} ]
		});

		builder.execute( context, function ( err, result ) {
			assert.equal( context.stdout.trim(), process.cwd() );
			cb();
		});
	});

	it('will convert an image convert using ImageMagick', function ( cb ) {
		this.timeout(5000);

		var gif = scratch.file( '/image/gif' ),
			toPBM = scratch.file( '/converted/toPBM');


		var context = Context( {
			inputs: [ gif ],
			outputs: [ toPBM ]
		})

		var builder = Builder( {
			shell: [
				{ tool: "convert" },
				{ input: true },
				{ 
					output: true,
					prefix: "PBM:" 
				}
			]
		} );

		context.mkdir( function ( err ) {
			if ( err ) throw err;
			builder.execute( context, function ( err, result ) {
				toPBM.getInfo ( function ( err, info ) {
					if ( !info.exists ) {
						cb( "Output doesn't exist" );
						return
					}

					cb();
				});
			});
		});

	});

	it('will convert an audio file using ffmpeg', function ( cb ) {
		this.timeout(5000);
		
		var wav = scratch.file( '/audio/silence.wav' ),
			toFlac = scratch.file( '/converted/toFlac');


		var context = Context( {
			inputs: [ wav ],
			outputs: [ toFlac ]
		})

		var builder = Builder( {
			shell: [
				{ tool: "ffmpeg" },
				'-i',
				{ input: true },
				'-y',
				'-f', 'flac',
				'-acodec', 'flac',
				{ output: true }
			]
		} );
		/*
		var check = Builder( {
			{ tool: "file" },
			"--mime",
			"-b",
			{ output: true },
			">",

		})
		*/
		context.mkdir( function ( err ) {
			if ( err ) throw err;
			builder.execute( context, function ( err, result ) {
				if ( err ) throw err;

				toFlac.getInfo ( function ( err, info ) {
					if ( !info.exists ) {
						cb( "Output doesn't exist" );
						return;
					}
					cb();
				});
			});
		});

	});


	after( function ( cb ) {
		scratch.close( cb );
	});

});