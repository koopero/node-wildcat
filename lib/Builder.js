var
	Shell = require( './Shell.js' );

module.exports = Builder;

function Builder ( config ) {
	if ( Array.isArray( config ) ) {
		config = {
			shell: config
		}
	}

	this.cooldown = 1;

	if ( config.shell ) {
		this.shell = Shell( config.shell );
	}
}

Builder.prototype.execute = function ( context, callback )
{
	var builder = this;

	if ( builder.shell ) {
		builder.shell.execute( context, callback );
	} 


}