var
	assert = require('assert'),
	express = require('express'),
	urllib = require('url'),
	HTTP = require('../lib/Storage/HTTP.js');


describe( "HTTP Client", function () {

	var 
		hostname = require('os').hostname(),
		serverPort = 5001, 
		serverUrl = urllib.format( {
			protocol: "http:",
			hostname: hostname,
			port: serverPort,
			path: '/'
		}),
		outsideServerPort = 5002,
		outsideServerUrl = urllib.format( {
			protocol: 'http:',
			hostname: hostname,
			port: outsideServerPort,
			path: '/'
		}),
		outsideServer;





	before( function ( cb ) {
		var outside = express();
		outside.get('/redirectToServer', function ( req, res ) {
			res.redirect( serverUrl );
		});

		outside.get('/redirectLoop', function ( req, res ) {
			res.redirect( '/redirectLoop' );
		});

		outside.get('/foobar', function ( req, res ) {
			res.send('foobar');
		});

		outside.get('/redirectToFoobar', function ( req, res ) {
			res.redirect('/foobar');
		});

		outsideServer = outside.listen( outsideServerPort );
		setTimeout( cb, 100 );
	});

	describe( "HTTP.request", function () {
		it('will not follow a redirect by default', function ( cb ) {
			HTTP.request( outsideServerUrl+'/redirectToFoobar', function ( err, status, headers, content ) {
				if ( err ) throw err;
				assert.equal ( urllib.resolve( outsideServerUrl, headers['location'] ), outsideServerUrl+'/foobar' );
				cb();
			} );
		});

		it('will follow a redirect when asked nicely', function ( cb ) {
			HTTP.request( outsideServerUrl+'/redirectToFoobar', { followRedirect: true }, function ( err, status, headers, content ) {
				if ( err ) throw err;
				assert.equal ( content, 'foobar' );
				cb();
			} );
		});
		
		it('will detect a redirect loop', function ( cb ) {
			this.timeout( 20000 );
			HTTP.request( outsideServerUrl+'/redirectLoop', { followRedirect: true }, function ( err, status, headers, content ) {
				if ( !err ) throw new Error( "Didn't detect redirect loop");
				cb();
			} );
		});
	});

	after( function () {
		outsideServer.close();
	});

});