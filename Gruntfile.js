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
		banner : [
			'/**\n',
			' * <%= pkg.name %> v<%= pkg.version %> - <%= grunt.template.today("yyyy-mm-dd") %>\n',
			' * <%= pkg.description %>\n',
			' *\n',
			' * Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>\n',
			' * Licensed <%= pkg.license %>\n',
			' */\n',
		].join(''),

		tests : [
			'./test/mocha-Path.js',
			'./test/mocha-Utils.js',
			'./test/mocha-Storage.js',
			'./test/mocha-Server.js',
			'./test/mocha-HTTP.js',
			'./test/mocha-Builder.js'
		],

		pkg : pkg
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
		}
	});

	grunt.loadNpmTasks('grunt-simple-mocha');

	// Default task.
	grunt.registerTask('default', ['simplemocha']);


};