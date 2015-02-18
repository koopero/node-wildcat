# Dead code

This project start with the loftiest of intentions. It was to be a media server,
distributed media transmutation engine, file database and high-level,
network-transparent API for dealing with media file. I'm proud of some of the
ideas that went into `wildcat`, and the system, while incomplete, proved useful
for some of my own projects.

Unfortunately, it's become much too weighty and monolithic. The configuration is
janky and somewhat cryptic, and even I find it hard to make `wildcat` do its
job.

The original goals of the project live on, but they will be better served by a
number of discrete, self-contained modules. I am currently, albeit slowly,
picking at the corpse of `wildcat` and modularizing its best features.

Development is happening at:
* [metamaster](https://github.com/koopero/metamaster)
* [node-unique-file-name](https://github.com/koopero/node-unique-file-name)
* [node-cache-path](https://github.com/koopero/node-cache-path)
