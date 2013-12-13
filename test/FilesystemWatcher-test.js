var FilesystemWatcher = require('../lib/storage/FilesystemWatcher.js');

var watcher = new FilesystemWatcher ( '.' );
watcher.on('change', function ( path ) {
	console.log ( "change", path );
});
watcher.on('create', function ( path ) {
	console.log ( "create", path );
});
watcher.on('remove', function ( path ) {
	console.log ( "remove", path );
});

