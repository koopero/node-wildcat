var Wildcat = require( "../lib/Wildcat.js" );
var storage = Wildcat.Storage( "/Users/samm/tmp/wsn");
console.log ( storage );
storage.initialize( function ( err ) {

	/*
	var file = storage.getFile( 'test' );
	file.store( new Buffer ( "Hey, I'm a file!" ), function ( err, file ) {
		if ( err )
			console.log ( err );
		else 
			console.log( "Stored" );
	} );
	*/


	var iterator = storage.eachFile();
	iterator.on('file', function ( file ) {
		console.log( "File", String ( file.path ) );
	});
	iterator.on('complete', function() {
		console.log( "Done!" );
	});

	/*
	console.log( "Doing listing" );
	storage.eachFile ( {}, function ( file ) {
		
	},
	function ( err ) {
		
	});*/

});


