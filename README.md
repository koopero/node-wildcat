# Under Construction
`Wildcat` is under development. It should be ready soon. 


# Installation
In an ideal world, installation should be as simple as:

	npm install -g wildcat
	sudo wildcat-install
	
## Windows
`Wildcat` is built on OSX and steeped in Unix philosophy. At this point, the likelyhood of it running under Windows is slim to none. 

# Testing

	cd /usr/local/lib/node_modules/wildcat
	cd test
	./rebuildTestData.sh
	mocha -R nyan test-*.js