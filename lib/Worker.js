var
	async = require('async'),
	events = require('events'),
	util = require('util'),
	Job  = require( './Job.js' ),
	Log = require('./Log.js'),
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
		var stream = file.stream;

		var affectedFiles = file.relatives( { affected: true, asArray: true } );
		//console.log( "affected", file, affectedFiles );
		affectedFiles .map( function ( output ) {
			var job = worker.jobForFile( output );
		} );
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

		job.once( 'finish', function ( result ) {
			worker.jobResult( job, result );
		} );

		job.execute ( worker );
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
	if ( result.error ) {
		Log('Worker.jobResult.error', result );
	}
	//Log('result', result );
	
	var worker = this;
	
	while ( true ) {
		var ind = worker.jobsRunning.indexOf( job );
		if ( ind == -1 )
			break;
		worker.jobsRunning.splice ( ind, 1 );
	}
	
	setImmediate ( worker.tick );
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

	setImmediate ( worker.tick );

	return job;
}

Worker.prototype.expedite = function ( job ) {

}

Worker.prototype.log = function () {
	console.log( "JM ----- " );
	console.log.apply( console, arguments );
}