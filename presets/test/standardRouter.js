{
	streams: {
		"**": {
			"path": "**"
		},
		meta: {
			"input": "**/*",
			"metaFor": "original",
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