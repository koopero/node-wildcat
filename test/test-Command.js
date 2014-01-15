var
	assert = require('assert');

var
	Command = require('../lib/Command.js'),
	Context = require('../lib/Context.js'),
	Test = require('./lib/Test.js');


describe( "Command", function () {
	var scratch;

	before( function ( cb ) {
		Test.CloneTestDataStorage( "mocha-Command", function ( err, storage ) {
			if ( err ) throw err;
			scratch = storage;
			cb();
		});
	});

	it('will capture the output of a shell command', function ( cb ){
		var context = Context({
			stdout: true
		});

		var command = Command([ { tool: 'pwd'} ]);

		command.execute( context, function ( err, result ) {
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

		var command = Command( [
			{ tool: "convert" },
			{ input: true },
			{ 
				output: true,
				prefix: "PBM:" 
			}
		] );

		context.mkdir( function ( err ) {
			if ( err ) throw err;
			command .execute( context, function ( err, result ) {
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

		var command = Command( [
			{ tool: "ffmpeg" },
			'-i',
			{ input: true },
			'-y',
			'-f', 'flac',
			'-acodec', 'flac',
			{ output: true }
		] );

		context.mkdir( function ( err ) {
			if ( err ) throw err;
			command.execute( context, function ( err, result ) {
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