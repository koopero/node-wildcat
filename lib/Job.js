var
	Command = require('./Command.js'),
	Errors = require('./Errors.js'), 
	Filesystem = require('./Storage/Filesystem.js'),
	Log = require("./Log.js"),
	Path = require('./Path.js'),
	Storage = require('./Storage.js');

var 
	async = require('async'),
	util = require('util'),
	events = require('events');

util.inherits( Job, events.EventEmitter );

module.exports = Job;

Job.fromFile = function ( file ) {
	//console.log ( "Job.fromFile", file );

	if ( !(file instanceof File ) )
		throw new Error ( "Input must be File" );

	var job = new Job ();
	job.file = file;

	return job;
}



var Result = Errors.List({
	Built: {
		complete: true,
		check: true
	},
	Checked: {
		check: true
	},
	UpToDate: {
		complete: true,
		check: true
	},
	BadOutput: {
		error: true
	},
	Bug: true,

	UpToDate: {
		complete: true,
		check: true
	},
	CondtionNotMet: {

	},
	BadInput: true,
	NoBuilder: true,
	BuildError: { log: true },
	CopyFail: true,
	StorageError: true
});

Job.Result = Result;

Job.Errors = Result;

function Job () {
}

Job.prototype.init = function ()
{
	var job = this;
	job.router = job.router || job.file.router;
	job.stream = job.stream || job.file.stream;



	//Log("Job.init", job.stream.name, job.inputs );

}

Job.prototype.log = function () {
	console.warn.apply( console, arguments );
}

Job.prototype.execute = function ( opt, callback )
{
	if ( 'function' == typeof opt ) {
		callback = opt;
		opt = {};
	}

	opt = opt || {};

	var job = this,
		worker = job.worker,
		router = job.router || job.file.router;

	job.init();
	job.emit('execute');
	Log("Job.execute", job );

	async.series( [
		getBuilder,
		checkInputs,
		checkOptionals,
		checkOutputs,
		checkTimes,
		checkConditional,

		bailOnCheck,

		initStorage,
		createContext,
		createOutputDirs,
		execute,
		checkOutput,
		copyOutput
	], finish );




	var inputs, outputs;
	var newestInput = 0,
		oldestOutput;

	function checkInputs ( cb ) {
		inputs = [];

		async.map( job.stream.inputs, function ( wildcard, cb ) {
			var inputPath = Path.translate( job.file.path, job.stream.path, wildcard );
			if ( !inputPath ) {
				cb( Result.BadInputPath( wildcard ) )
				return;
			}

			var inputFile = router.file ( inputPath );
			if ( !inputPath ) {
				cb( Result.BadInputPath( inputPath ) )
				return;
			}	
			
			inputFile.getInfo( function ( err, info ) {
				if ( err ) {
					cb( Result.Bug() );
				} else if ( 
					!info.exists ||
					info.invalidPath ||
					 !info.mtime
				) {
					cb( Result.BadInput( inputFile ) );
				} else {

					var mtime = new Date( info.mtime ).getTime();
					newestInput = Math.max( mtime, newestInput );

					inputs.push( inputFile );

					cb();
				}
			} );
		}, cb );
	}

	function checkOptionals ( cb ) {

		async.map( job.stream.optional, function ( wildcard, cb ) {
			var inputPath = Path.translate( job.file.path, job.stream.path, wildcard );
			if ( !inputPath ) {
				cb()
				return;
			}

			var inputFile = router.file ( inputPath );
			if ( !inputPath ) {
				cb()
				return;
			}	
			
			inputFile.getInfo( function ( err, info ) {
				if ( err ) {
					cb( Result.Bug() );
				} else if ( 
					!info.exists ||
					info.invalidPath ||
					 !info.mtime
				) {
					cb();
				} else {

					var mtime = new Date( info.mtime ).getTime();
					newestInput = Math.max( mtime, newestInput );

					inputs.push( inputFile );

					cb();
				}
			} );
		}, cb );
	}

	function checkOutputs( cb ) {
		outputs = [];

		async.map( [ job.file ], function ( output, cb ) {
			output.getInfo( function ( err, info ) {
				var mtime = new Date( info.mtime ).getTime();
				oldestOutput = oldestOutput === undefined ? mtime : mtime < oldestOutput ? mtime : oldestOutput;

				outputs.push( output );

				cb();
			} );
		}, cb );
	}



	function checkTimes ( cb ) {
		if ( job.stream && job.stream.refresh ) {
			cb();
		} else if ( newestInput < oldestOutput ) {
			cb( Result.UpToDate() );
		} else {
			cb();
		}
	}

	function checkConditional( cb ) {
		var stream = job.stream;


		if ( stream['if'] ) {
			var cmd = stream['if'];
			cmd = Command( cmd );
			
			var context = require('./Context.js')( {
				inputs: inputs
			});

			cmd.execute( context, function ( err, result ) {
				if ( err ) {
					cb( err );
					return;
				}

				if ( !result ) {
					cb( Result.CondtionNotMet() );
					return;
				}

				cb()

			});
		} else {
			cb();
		}
	}	

	function bailOnCheck( cb ) {
		if ( opt.check ) {
			cb( Result.Checked() );
		} else {
			cb();
		}
	}

	var builder;
	function getBuilder( cb ) {
		builder = job.stream.builder;

		if ( builder )
			cb ();
		else
			cb ( Result.NoBuilder() );
	}

	var storage;
	function initStorage ( cb ) {
		var rootStorage = ( worker && worker.storage ) || Filesystem;

		rootStorage = Filesystem;

		rootStorage.temp( function ( err, tempStorage ) {
			if ( err ) {
				cb( Result.StorageError( err ) );
				return;
			}
			storage = tempStorage;
			cb();
		});
	}

	var context;
	function createContext ( cb ) {
		context = require('./Context.js')( {
			storage: storage,
			inputs: inputs,
			outputs: outputs,
			log: job.log
		});
		cb();
	}

	function createOutputDirs ( cb ) {
		async.each( context.outputs, function ( output, cb ) {
			output.mkdir( cb );
		}, function ( err ) {
			if ( err )
				cb ( Result.StorageError( err ) );
			else
				cb();
		} );
	}

	function execute ( cb ) {
		builder.execute( context, function ( err, result ) {
			cb( err, result );
		});
	}

	function checkOutput ( cb ) {
		var outputs = context.outputs;
		async.each( outputs, function ( output, cb ) {
			output.getInfo( function ( err ) {
				if ( err ) {
					cb( Result.Bug() );
					return;
				}

				if ( !output.exists ) {
					cb( Result.BadOutput() )
					return;
				}

				cb()
			});
		}, cb );
	}

	function copyOutput ( cb ) {
		var outputs = context.outputs;

		async.eachSeries( outputs, function ( output, cb ) {
			var destination = router.file ( output.path );
			destination.store( 
				output, 
				{
					keepSource: false
				},
				function ( err ) {
					if ( err )
						cb ( Result.CopyFail( err ) );
					else
						cb();
				} 
			);
		}, cb );
	}

	function cleanUp ( cb ) {
		async.parallel( [
			function ( cb ) {
				if ( storage ) {
					storage.close( cb );
				} else {
					cb();
				}
			}
		], function ( err ) {

			cb();
		} );
	}

	function finish ( result ) {
		cleanUp( function () {

			if ( !result )
				result = Result.Built();


			Log("Job.finish", result );
			job.emit('finish', result );
			
			if ( result.complete ) {
				job.emit('complete', result );
			} else if ( !callback ) {
				job.emit('err', result );
			}




			if ( 'function' == typeof callback ) {
				if ( result.error ) {
					callback ( result );
				} else {
					callback ( null, result );
				}
			}
		});
	}
}

Job.prototype.inspect = function () {
	var job = this,
		ret = '[Job:';

	if ( job.inputs ) 
		ret += job.inputs.map( function ( input ) { return String(input.path)} ).join(',');

	ret += ' -> ';

	if ( job.file )
		ret += String( job.file.path );

	ret += ']';

	return ret;
}