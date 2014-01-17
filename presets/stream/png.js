Preset.FileStream( function ( opt ) {
	return {
		"name": "png",
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
				subtype: "png"
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
					"prefix": "PNG:",
					output: true
				}
			]
		}		
	}
}, opt )

