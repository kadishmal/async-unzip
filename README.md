# async-unzip

Efficient, fast, asynchronous, in-memory unzip module for Node.js.

## Sample Example

	var async = require('async'),
			path = require('path'),
			ZipFile = require('async-unzip').ZipFile,
			zipFile = new ZipFile('/home/user/Name.app.dSYM.zip'),
			noMoreFiles = false;
	
	async.whilst(function () {
		return !noMoreFiles;
	}, function (cb) {
		async.waterfall([
			function (cb) {
				zipFile.getNextEntry(cb);
			},
			function (entry, cb) {
				if (entry) {
					if (entry.isFile) {
						var match = entry.filename.match(/^[^\/]+\.dSYM\/Contents\/Resources\/DWARF\/(.+)/);
	
						if (match) {
							console.log(match);
							console.log(entry);
	
							async.waterfall([
								function (cb) {
									entry.getData(cb);
								},
								function (data, cb) {
									// `data` is a binary data of the entry.
									console.log(data.length);
	
									cb();
								}
							], cb);
						}
					}
				} else {
					noMoreFiles = true;
				}
	
				cb();
			}
		], cb);
	}, function () {
		// DO NOT FORGET to call `close()` to release the open file descriptor,
		// otherwise, you will quickly run out of file descriptors.
		zipFile.close();
		console.log(arguments);
	});
