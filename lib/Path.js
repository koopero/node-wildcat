Token.ANY = 3;
Token.ANYDIR = 2;
Token.ANYFILE = 1;

function Token ( str ) {

	// Merge slashes together
	var delimIndex = 0;
	while ( str.substr( delimIndex, 1 ) == '/' ) {
		delimIndex++;
	}

	if ( delimIndex ) {
		this.str = str.substr( 0, delimIndex );
		this.length = delimIndex;
		this.delim = true;
		return;
	}

	if ( str.substr( 0, 3 ) == '**/' ) {
		this.str = '**/';
		this.length = 3;
		this.wild = Token.ANYDIR;
		return;
	}

	if ( str.substr( 0, 2 ) == '**' ) {
		this.str = '**';
		this.length = 2;
		this.wild = Token.ANY;
		return;
	}

	if ( str.substr( 0, 1 ) == '*' ) {
		this.str = '*';
		this.length = 1;
		this.wild = Token.ANYFILE;
		return;
	}


	var nextIndex = str.search( /(\*|\/)/ ) ;
	if ( nextIndex == -1 ) {
		this.str = str;
		this.length = str.length;
	} else {
		this.str = str.substr( 0, nextIndex );
		this.length = nextIndex;
	}

}

Token.prototype.regexStr = function () {
	if ( this.delim ) 
		return '\\/';
		//return '(\\/)';

	switch ( this.wild ) {
		case Token.ANY:
			return "(.*)";

		case Token.ANYDIR:
			return "(.+\/|^\/|)";

		case Token.ANYFILE:
			return "([^\/]+)"
	}

	return escape ( this.str );
	//return '('+escape ( this.str )+')';


	function escape ( s ) {
		return s.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&" );
	}
}


function Path ( parse ) {
	if ( !parse ) 
		throw new Error ( "Cannot create null path" );

	if ( parse && parse.constructor == Path )
		return parse;
	
	if ( this.constructor != Path ) {
		return new Path( parse );
	}

	this.str = parse;
	this.length = parse.length;

	//	Parse enough to determine if the path is wild or not.
	if ( Path.isWild( parse ) ) {
		this.parse();
	} else {
		this.wild = false;
	}

	this.isDir = parse.substr( parse.length - 1 ) == '/';
}

Path.prototype.leadingSlash = function ()
{
	if ( this.str.substr ( 0, 1 ) == '/' )
		return this;

	return Path( '/'+ this.str );
}

Path.prototype.trailingSlash = function ()
{
	if ( this.str.substr ( -1 ) == '/' )
		return this;

	return Path( this.str + '/' );
}

Path.prototype.stripTrailingSlash = function ()
{
	if ( this.str.substr ( -1 ) != '/' )
		return this;

	var str = this.str;
	while ( str.substr( -1 ) == '/' )
		str = str.substr( 0, str.length - 1 );

	return Path( str );
}

Path.prototype.parse = function () {
	if ( this.tokens )
		return false;

	var parse = this.str,
		out = this;

	out.numDelims = 0;
	out.numWilds = 0;
	out.wild = false;
	out.greedy = false;

	var tokens = [];
	do {
		var token = new Token ( parse );
		parse = parse.substr( token.length );
		tokens.push( token );

		if ( token.delim )
			out.numDelims ++;

		if ( token.wild ) {
			out.wild = true;
			out.numWilds ++;
		}

		if ( token.greedy )
			out.greedy = true;

	} while ( parse.length );

	out.tokens = tokens;

	return true;
}

Path.prototype.match = function ( str ) {
	str = String( str );
	this.parse();

	if ( !this.wild ) {
		return str == this.str ? [] : false; 
	}

	if ( !this.regex ) {
		var reg = this.regexStr();
		//console.log( 'reg=',reg);
		this.regex = new RegExp( reg );
	}

	var result = this.regex.exec( str );
	if ( result === null )
		return false;

	return result.slice( 1 );
}

Path.prototype.fill = function ( data ) {
	this.parse();

	var tokenIndex,
		dataIndex = 0,
		tokenLength = this.tokens.length,
		result = '';

	if ( this.numWilds != data.length ) {
		return;
	}

	for ( tokenIndex = 0; tokenIndex < tokenLength; tokenIndex++ ) {
		var token = this.tokens[tokenIndex];
		if ( !token.wild ) {
			result += token.str;
			continue;
		}

		var d = data[dataIndex];
		result += d;

		dataIndex ++;
	}

	return result;
}

Path.prototype.append = function ( appendPath ) {
	var str = String ( this );
	var appendPath = String ( appendPath );

	if ( str.substr( str.length - 1 ) != '/' )
		str += '/';

	while ( appendPath.substr( 0, 1 ) == '/' )
		appendPath = appendPath.substr( 1 );

	return str + appendPath;
}

Path.prototype.regexStr = function () {
	return '^'+this.tokens.map( function ( v ) {
		return v.regexStr();
	}).join('')+"$";
}

Path.prototype.toString = function () {
	return this.str;
}

Path.prototype.inspect = function ()
{
	return '[Path:'+this.str+']';
}

Path.translate = function ( path, inSpace, outSpace ) {

		
	inSpace = Path( inSpace );
	outSpace = Path( outSpace );

	var d = inSpace.match( path );
	if ( !d )
		return;

	var str = outSpace.fill( d );
	if ( !str )
		return;

	
	str = str.replace ( '//', '/');
	return str;
}

Path.isWild = function ( path ) {
	if ( !path )
		return;

	if ( Path == path.constructor )
		return path.wild;
	else if ( 'string' == typeof path )
		return path.match ( /\*/ );

}

Path.trailingSlash = function ( path ) {
	path = String( path );
	return path.substr( -1 ) == '/' ? path : path + '/';	
}

Path.leadingSlash = function ( path ) {
	path = String( path );
	return path.substr( 0, 1 ) == '/' ? path : '/' + path;
}

Path.stripTrailingSlash = function ( path ) {
	path = String( path );
	while ( path.substr( -1 ) == '/' )
		path = path.substr( 0, path.length - 1 );

	return path;
}

module.exports = Path;
