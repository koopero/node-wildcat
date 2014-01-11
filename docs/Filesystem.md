

<!-- Start lib/Storage/Filesystem.js -->

# Filesystem

## file(path)

Get a `File` object for a system path.

### Params: 

* **String** *path* An absolute path

### Return:

* **File** A File object for the path.

## FileSystem.setDefaultTempDir(directory)

Set the default temporary directory.

By default, `Filesystem` will use the os&#39;s default temp directory as the root for
temporary storage. `setDefaultTempDir` sets the default to an arbitrary directory.

If the directory does not exist, it will be created.

If there is trouble creating the directory, an Error will be thrown.

The directory will *NOT* be deleted on exit.

### Params: 

* **String** *directory* path to directory

### Return:

* **Boolean** True on success.

<!-- End lib/Storage/Filesystem.js -->

