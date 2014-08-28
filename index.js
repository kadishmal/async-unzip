var async = require('async'),
		CentralDirectory = require('./CentralDirectoryFileHeader');

var ZipFile = module.exports.ZipFile = function(/*String*/filePath) {
	if (!(this instanceof ZipFile)) {
		return new ZipFile(filePath);
	}

	this.filePath = filePath;
};

ZipFile.prototype.getCentralDirectory = function (cb) {
	if (this._centralDirectory) {
		cb(null, this._centralDirectory);
	} else {
		var self = this;

		async.waterfall([
			function (cb) {
				CentralDirectory.initCentralDirectory(self, cb);
			},
			function (centralDirectory, cb) {
				self._centralDirectory = centralDirectory;

				cb(null, centralDirectory);
			}
		], cb);
	}
};

ZipFile.prototype.getNextEntry = function (cb) {
	var self = this;

	async.waterfall([
		function (cb) {
			self.getCentralDirectory(cb);
		},
		function (centralDirectory, cb) {
			centralDirectory.getNextEntry(cb);
		}
	], cb);
};

ZipFile.prototype.close = function (cb) {
	!cb && (cb = function () {});

	if (this._centralDirectory) {
		this._centralDirectory.close(cb);
	} else {
		cb();
	}
};
