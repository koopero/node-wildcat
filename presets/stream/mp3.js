Preset.FileStream( {
	"name": "mp3",
	"if": {
		"meta": { "type": "audio" }
	},
	"build": {
		"meta": {
			"type": "audio",
			"subtype": ["mp3","mpeg"],
			"bitrate": { "$lt": "200kbps" }
		},
		"then": {
			"link": true
		},
		"else": [
			{ "tool": "ffmpeg" },
			"-i", { "input": true },
			"-codec:a libmp3lame -qscale:a 3",
			"-f mp3",
			{ "output": true }
		]
	}	
}, opt )