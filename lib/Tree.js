
module.exports = Tree;

function joinPath ( path, append )
{
	return path == '' ? append : path + '/' + append;
}

function Tree () {
	
}

Tree.prototype.delete = function ()
{
	if ( this.parent ) {
		delete this.parent.children[ this.name ];
	}
}

Tree.prototype.each = function( callback, prefix ) {
	if ( !prefix )
		prefix = '';

	callback( prefix, this );
	if ( this.children ) {
		for ( var k in this.children ) {
			var child = this.children[k];
			child.each( callback, joinPath( prefix, k ));
		}
	}
}

Tree.prototype.walk = function( path, create ) {
	if ( 'string' == typeof path ) {
		path = path.split('/');
	}

	var p = path.shift(),
		child = this.children && this.children[p];

	if ( !child ) {
		if ( !create )
			return undefined;

		if ( !this.children )
			this.children = {};

		child = new Tree ();
		child.name = p;
		child.path = joinPath ( this.path, p );
		child.parent = this;
		this.children[p] = child;
	}

	if ( path.length )
		return child.walk ( path, create );
	else 
		return child;
}