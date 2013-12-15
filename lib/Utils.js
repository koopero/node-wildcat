exports.stringStartsWith = function ( haystack, needle ) {
	return haystack.substr( 0, needle.length ) == needle;
}