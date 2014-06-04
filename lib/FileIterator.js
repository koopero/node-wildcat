var 
	_ 	 	= require('underscore'),
	async 	= require('async'),
	util 	= require('util'),
	events 	= require('events');

util.inherits( FileIterator, events.EventEmitter );

function FileIterator ( options, callback ) 
{
	if ( 'function' == typeof options ) {
		callback = options;
		options = {};
	}

	var it = this,
		proc = [],
		getInfo = false,
		procInd = 0,
		procCur = -1,
		inputFinished = false,
		error = null;

	it.options = options;
	it.files = [];
	it.cancelled = false;
	it.finished = false;

	it.process = function ()
	{
		_.each( arguments, function ( func ) {
			if ( 'function' != typeof func )
				throw new Error( "Process must be function" );

			proc.push( func );
		});
	}

	it.input = function () {
		if ( it.cancelled )
			return false;



		_.each( arguments, function ( input ) {
			it.files.push( input );
			it.emit( 'input', input );
		});

		setTimeout( tick, 100 );
		//process.nextTick( tick );
		return it;
	};

	it.end = function () {
		if ( it.finished || it.cancelled )
			return false;

		inputFinished = true;

		setImmediate( tick );
		return it;
	}

	it.cancel = function () {
		if ( it.finished || it.cancelled )
			return false;

		it.cancelled = true;
		it.emit('cancel');
		it.emit('complete');

		if ( callback )
			callback( "cancel" );

		it.removeAllListeners();

		return it;
	}

	function tick () {
		if ( it.finished || it.cancelled )
			return;

		if ( inputFinished && procInd == it.files.length ) {
			it.finished = true;


			it.emit('complete', it.files );
			
			if ( callback )
				callback( error, it.files );

			it.removeAllListeners();
			return;
		}

		if ( procCur == -1 && procInd < it.files.length ) {
			procCur = procInd;
			var file = it.files[procCur];

			async.eachSeries( proc, 
				function ( func, cb ) {
					func.call( file, file, function ( err ) {
						if ( err ) {
							console.warn ( "FileIterator Process Error", err );
							//throw "Not implemented";
						}

						cb();
					});
				}, 
				function ( err ) {
					//if ( err ) {
					//	console.warn ( "FileIterator Process Error", err );
					//	throw "Not implemented";
					//}
					it.emit('output', file );
					procCur = -1;
					procInd ++;

					setImmediate( tick );
				}
			);
		}

	}

}

FileIterator.prototype.error = function ( err )
{
	var iterator = this;
}

FileIterator.prototype.complete = function ()
{
	var iterator = this;

	if ( this.completed )
		throw new Error ( "Iterator completed twice" );

	this.complete = true;

	this.emit('complete');
	this.removeAllListeners();

	return true;
}

FileIterator.prototype.cancel = function ()
{
	var iterator = this;

	// Already cancelled, nothing to do, don't want to
	// send events twice.
	if ( this.cancelled || this.completed )
		return false;

	this.cancelled = true;

	this.emit('cancel');
	this.emit('complete');
	this.removeAllListeners();

	return true;
}

module.exports = FileIterator;
