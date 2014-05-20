Preset.FileStream( function ( opt ) {
	return {
		"name": "jpeg",
		"if": {
			"meta": {
				"type": "image"
			},
			"opt": {
				"defaults": false,
				"magic": true,
				"identify": true
			}
		}, 
		"build": {
			"ifMeta": {
				subtype: "jpeg",

			},
			"then": {
				link: true
			},
			"else": [
				{ tool: "convert" },
				{ 
					input: true,
					prefix: {
						"metaArg": "ImageMagickPrefix"
					}
				},
				'-delete 1--1',
				{
					"prefix": "JPG:",
					output: true
				}
			]
		}		
	}
}, opt )

