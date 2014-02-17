Preset.FileStream( {
	"name": "meta",
	"priority": -1,
	"tag": "meta",
	"cascade": true,
	"build": [
		{"tool":"wildcat-meta"},
		{"input": true },
		">",
		{"output": true }		
	],
	"meta": {
		"content-type": "application/json"
	}
}, opt )