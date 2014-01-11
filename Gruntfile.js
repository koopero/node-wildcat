/*global module:false*/

/**
 * Javascript Project Boilerplate
 * Version 0.1.0
 */
module.exports = function(grunt) {
	"use strict";
	var pkg, config;

	pkg = grunt.file.readJSON('package.json');

	config = {
		tests : [
			'./test/mocha-Path.js',
			'./test/mocha-Utils.js',
			'./test/mocha-Storage.js',
			'./test/mocha-Server.js',
			'./test/mocha-HTTP.js',
			'./test/mocha-Meta.js',
			'./test/mocha-Builder.js'
		]
	};

	// Project configuration.
	grunt.initConfig({
		pkg : config.pkg,
		simplemocha: {
			options: {
				timeout: 3000,
				ignoreLeaks: false,
				ui: 'bdd'
			},
			all: { src: config.tests }
		},
		markdox: {
			fs: {
				src: 'lib/Storage/Filesystem.js',
				dest: 'docs/Filesystem.md'
			}
		}
	});

	grunt.loadNpmTasks('grunt-simple-mocha');
	grunt.loadNpmTasks('grunt-markdox');

	// Default task.
	grunt.registerTask('default', ['simplemocha']);


};