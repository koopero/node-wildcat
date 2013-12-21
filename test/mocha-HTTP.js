var
	express = require('express'),
	HTTP = require('../lib/Storage/HTTP.js');


describe( "HTTP Client", function () {
	before( function ( cb ) {
		var outsideServer = express();
		outsideServer.get('/redirect')
	});
});