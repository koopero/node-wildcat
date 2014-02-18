{
	streams: {
		"**": {
			"path": "**"
		},
		meta: {
			"input": "**/*",
			"tag": "meta",
			"path": "meta/**/*.meta.json",
			"build": [
				{"tool":"wildcat-meta"},
				{"input": true },
				">",
				{"output": true }		
			]
		}
	}
}