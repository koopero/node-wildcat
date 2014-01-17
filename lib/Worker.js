var
	async = require('async'),
	events = require('events'),
	util = require('util'),
	Job  = require( './Job.js' ),
	Path = require( './Path.js' ),
	Storage = require( './Storage.js' );

util.inherits( Worker, events.EventEmitter );


module.exports = Worker;

function Worker ( config )
{
	config = config || {};

	if ( config.constructor == Worker )
		return config;

	if ( this.constructor != Worker )
		return new Worker( config ); 

	var worker = this;
	
	worker.jobsByPath = {};
	worker.jobsRunning = [];
	worker.jobsQueue = [];
	worker.maxRunning = 1;

	worker.onTouchFile = function ( file, change ) {
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

				
				
				if ( inputPath.match( file.path ) ) {
					

					var outPath = Path.translate( file.path, inputPath, stream.path );
					if ( !outPath )
						continue;

					var outFile = worker.router.file( outPath )

					if ( outFile )
						worker.jobForFile( outFile );
				}
			}
		}
	}

	worker.tick = function () {
		if ( worker.jobsQueue.length == 0 ) {
			if ( !worker.flushed ) {
				worker.emit('flush');
				worker.flushed = true;
			}
			return;
		}

		if ( worker.jobsRunning.length >= worker.maxRunning )
			return;

		var job = worker.jobsQueue.shift();
		worker.jobsRunning.push( job );

		job.execute ( worker, function ( err, result ) {
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
		if ( worker.storage ) {
			worker.storage.init( callback );
		} else {
			callback();
		}
		
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
	
	process.nextTick ( worker.tick );
}

Worker.prototype.jobForFile = function ( file ) {
	var worker = this;
	path = String( file.path );
	
	var job;
	
	if ( worker.jobsByPath[path] ) {
		job = worker.jobsByPath[path];
	} else {
		job = Job.fromFile ( file );
		job.worker = worker;
		worker.jobsByPath[ path ] = job;
	}

	if ( worker.jobsQueue.indexOf ( job ) == -1 ) {
		worker.jobsQueue.push ( job );
	}

	worker.sortQueue = true;
	worker.flushed = false;

	process.nextTick ( worker.tick );

	return job;
}

Worker.prototype.expedite = function ( job ) {

}

Worker.prototype.log = function () {
	console.log( "JM ----- " );
	console.log.apply( console, arguments );
}