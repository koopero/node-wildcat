var
	Command = require( './Command.js' );

module.exports = Builder;

function Builder ( config ) {
	if ( config.constructor == Builder )
		return config;

	if ( this.constructor != Builder )
		return new Builder ( config );

	this.cooldown = 1;

	this.command = new Command( config.command || config.shell || config );

}

Builder.prototype.execute = function ( context, callback )
{
	var builder = this;

	if ( builder.command ) {
		builder.command.execute( context, callback );
	} 


}