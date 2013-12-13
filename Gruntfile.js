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
			'test/Path-test.js',
		],

		pkg : pkg,
		uglifyFiles : {}
	};

	// Project configuration.
	grunt.initConfig({
		pkg : config.pkg,
		simplemocha: {
			options: {
				globals: ['should'],
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