Preset.FileStream( function ( opt ) {

	var time = 2,
		size = '640x640';

	return {
		"name": "thumbnail",
		"if": {
			"meta": {
				"type": ["image","video"]
			},
			"opt": {
				"defaults": false,
				"magic": true,
				"exiftool": true,
				"ffprobe": true
			}
		}, 
		"excludeInputs": [ '/_**' ],
		"build": {
			"ifMeta": {
				type: "video"
			},
			"then": [
				{ tool: "ffmpeg" },
				'-y',
				'-i', { input: true },
				{ "metaArg": "ffmpegSeek" },
				'-vframes 1',
				'-f', 'image2',
				{ temp: "InterImage", "ext": "png" },

				"&&",

				{ tool: "convert" },
				{ temp: "InterImage" },
				{ "metaArg": "ImageMagickOrientation" },
				"-resize", { escape: size },
				{
					"prefix": "JPG:",
					output: true
				}
			],
			"else": [
				{ tool: "convert" },
				{ 
					input: true,
					prefix: {
						"metaArg": "ImageMagickPrefix"
					}
				},
				'-delete 1--1',
				{ "metaArg": "ImageMagickOrientation" },
				"-resize", { escape: size },		
				{
					"prefix": "JPG:",
					output: true
				}
			]
		}		
	}
}, opt )

