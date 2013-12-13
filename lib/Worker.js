var
	async = require('async'),
	Job  = require( './Job.js' ),
	Path = require( './Path.js' ),
	Storage = require( './Storage.js' );

module.exports = Worker;

function Worker ( config )
{
	config = config || {};

	if ( config.constructor == Worker )
		return config;

	if ( this.constructor != Worker )
		return new Worker( config ); 

	var worker = this;
	worker.storage = Storage( config.storage || "tmp:/" );
	worker.jobsByPath = {};
	worker.jobsRunning = [];
	worker.jobsQueue = [];
	worker.maxRunning = 1;

	worker.onFileChange = function ( file, change ) {
		var streams = worker.router.streams;

		for ( var streamName in streams ) {
			var stream = streams[streamName];

			

			if ( stream === file.stream ) 
				continue;

			var inputs = stream.inputs;
			if ( !inputs )
				continue;

						


			for ( var inputName in inputs ) {
				var inputPath = inputs[inputName];

				console.log ( "File", file, "input to ", stream.name, inputPath );
				
				if ( inputPath.match( file.path ) ) {
					

					var output = Path.translate( file.path, inputPath, stream.path );

					if ( output )
						worker.queuePath( output );
				}
			}
		}
	}

	worker.tick = function () {
		if ( worker.jobsQueue.length == 0 )
			return;

		if ( worker.maxRunning && worker.jobsRunning.length >= worker.maxRunning )
			return;

		var job = worker.jobsQueue.shift();
		worker.jobsRunning.push( job );
		job.execute ( worker, function ( result ) {
			worker.jobResult( job, result );
		} );
	}

	return worker;
}

Worker.prototype.init = function ( callback ) {
	var worker = this;


	async.series( [
		initStorage
	], callback );

	function initStorage ( callback ) {
		worker.storage.init( callback );
	}
}

Worker.prototype.jobResult = function ( job, result )
{
	var worker = this;

	
	while ( true ) {
		var ind = worker.jobsRunning.indexOf( job );
		if ( ind == -1 )
			break;
		worker.jobsRunning.splice ( ind, 1 );
	}
		

	console.log ( "RESULT", result );
	
	process.nextTick ( worker.tick );
}

Worker.prototype.queuePath = function ( path ) {

	path = String( path );

	var worker = this;

	
	var job;
	
	if ( path in worker.jobsByPath ) {
		job = worker.jobsByPath;
	} else {
		var file = worker.router.getFile( path );
		if ( !file )
			return;

		job = Job.fromFile ( file );

	}

	if ( worker.jobsQueue.indexOf ( job ) == -1 ) {
		worker.jobsQueue.push ( job );
	}

	worker.sortQueue = true;

	process.nextTick ( worker.tick );

	return job;
}

Worker.prototype.log = function () {
	console.log( "JM ----- " );
	console.log.apply( console, arguments );
}