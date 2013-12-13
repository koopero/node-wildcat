var util 	= require('util'),
	events 	= require('events');

util.inherits( FileIterator, events.EventEmitter );

function FileIterator ( options, onComplete ) 
{
	if ( 'function' == typeof options ) {
		callback = options;
		options = {};
	}

	
	this.onComplete = onComplete;
}

FileIterator.prototype.error = function ( err )
{

}

FileIterator.prototype.complete = function ()
{
	if ( this.completed )
		throw new Error ( "Iterator completed twice" );

	this.complete = true;

	this.emit('complete');
	this.removeAllListeners();

	return true;
}

FileIterator.prototype.file = function ( file )
{
	if ( this.cancelled )
		return false;

	this.emit('file', file );

	return true;
}

FileIterator.prototype.cancel = function ()
{
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
