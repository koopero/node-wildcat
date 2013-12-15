var
	Context = require('./Context.js'),
	Errors = require('./Errors.js'), 
	Path = require('./Path.js'),
	Storage = require('./Storage.js');

var 
	async = require('async');

module.exports = Job;

Job.fromFile = function ( file ) {
	if ( !(file instanceof File ) )
		throw new Error ( "Input must be File" );

	var job = new Job ();
	job.file = file;

	return job;
}



var Result = Errors.List({
	Bug: true,
	UpToDate: true,
	BadInput: true,
	NoBuilder: true,
	BuildError: { log: true },
	CopyFail: true,
	StorageError: true
});

function Job () {

}

Job.prototype.init = function ()
{
	var job = this;
	job.router = job.router || job.file.router;
	job.stream = job.stream || job.file.stream;

	if ( !job.inputs ) {
		job.inputs = [];
		for ( var inputName in job.stream.inputs ) {
			var inputPath = Path.translate( job.file.path, job.stream.path, job.stream.inputs[inputName] );
			var inputFile = job.router.file( inputPath );
			job.inputs.push( inputFile );
		}
	}

}



Job.prototype.execute = function ( worker, callback )
{

	var job = this;

	job.init();

	async.series( [
		checkInputs,
		checkOutputs,
		checkTimes,
		getBuilder,
		initStorage,
		createContext,
		createOutputDirs,
		execute,
		checkOutput,
		copyOutput
	], function ( result ) {
		if ( !result )
			result = Result.Built();
		
		console.log ( "RESULT", result );
		cleanUp( function () {
			callback( result );
		} );
	} );

	var newestInput = 0,
		oldestOutput;

	function checkInputs( cb ) {
		async.each( job.inputs, function ( file, cb ) {
			file.getInfo( function ( err ) {
				if ( err ) {
					cb( Result.Bug() );
				} else if ( 
					!file.exists ||
					file.invalidPath ||
					 !file.mtime
				) {
					cb( Result.BadInput() );
				} else {

					var mtime = new Date( file.mtime ).getTime();
					newestInput = Math.max( mtime, newestInput );

					cb();
				}
			} );
		}, cb );		
	}

	function checkOutputs( cb ) {
		console.log( "OUTPUTS", job.file );
		job.file.getInfo( function ( err, info ) {
			var mtime = new Date( info.mtime ).getTime();
			oldestOutput = oldestOutput === undefined ? mtime : mtime < oldestOutput ? mtime : oldestOutput;
			cb();
		} );
	}

	function checkTimes ( cb ) {
		if ( newestInput < oldestOutput ) {
			cb( Result.UpToDate() );
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
		worker.storage.tempDir( function ( err, tempStorage ) {
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
		context = Context( {
			storage: storage,
			inputs: job.inputs,
			outputs: [ job.file ]
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
		console.log(  "EXECUTE" );

		builder.execute( context, function ( err ) {
			if ( err )
				cb( Result.BuildError( err ) );
			else
				cb();
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
		var router = worker.router;
		var outputs = context.outputs;

		async.eachSeries( outputs, function ( output, cb ) {
			var destination = router.file ( output.path );
			console.log ( "MOVE", output, "to", destination );
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
		console.log(  "cleanUp" );
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




}