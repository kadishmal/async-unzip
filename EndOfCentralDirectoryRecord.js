/*
 * End of central directory record (EOCD).
 * Refer to http://en.wikipedia.org/wiki/Zip_(file_format).
 Offset	Bytes	Description
  0	    4	    End of central directory signature = 0x06054b50
  4	    2	    Number of this disk
  6	    2	    Disk where central directory starts
  8	    2	    Number of central directory records on this disk
 10	    2	    Total number of central directory records
 12	    4	    Size of central directory (bytes)
 16	    4	    Offset of start of central directory, relative to start of archive
 20	    2	    Comment length (n)
 22	    n	    Comment
* */
var async = require('async'),
		fs = require('fs');

var CONSTANTS = {
	EOCD_HEADER_SIZE                        : 22, // END header size
	EOCD_SIGNATURE                          : 0x06054b50, // "PK\005\006"
	OFFSETS: {
		EOCD_SIGNATURE                        : 0,
		NUMBER_OF_THIS_DISK                   : 4,
		DISK_WHERE_CENTRAL_DIRECTORY_STARTS   : 6,
		NUMBER_OF_ENTRIES_ON_THIS_DISK        : 8,
		TOTAL_NUMBER_OF_ENTRIES_ON_THIS_DISK  : 10,
		CD_SIZE_IN_BYTES                      : 12,
		CD_START                              : 16,
		COMMENT_LENGTH                        : 20,
		COMMENT_START                         : 22
	},
	ERRORS: {
		INVALID_EOCD: 'Invalid end of central directory record.'
	}
};

var EOCD = module.exports = function (zipFile) {
	this._zipFile = zipFile;
};

EOCD.prototype.readHeader = function (cb) {
	if (this._buffer) {
		cb(null, this._buffer);
	} else {
		var self = this;

		async.waterfall([
			function (cb) {
				fs.open(self._zipFile.filePath, 'r', cb);
			},
			function (fd, cb) {
				self._fd = fd;

				fs.fstat(fd, cb);
			},
			function (stat, cb) {
				self._stat = stat;

				fs.read(self._fd, new Buffer(CONSTANTS.EOCD_HEADER_SIZE), 0, CONSTANTS.EOCD_HEADER_SIZE, stat.size - CONSTANTS.EOCD_HEADER_SIZE, cb);
			},
			function (bytesRead, buffer, cb) {
				if (bytesRead == CONSTANTS.EOCD_HEADER_SIZE) {
					self._buffer = buffer;

					cb(null, buffer);
				} else {
					cb(new Error(CONSTANTS.ERRORS.INVALID_EOCD));
				}
			}
		], cb);
	}
};

EOCD.prototype.getCentralDirectoryMeta = function (cb) {
	var self = this;

	async.waterfall([
		function (cb) {
			self.readHeader(cb);
		},
		function (buffer, cb) {
			cb(null, {
				fd: self._fd,
				numberOfEntries: buffer.readUInt16LE(CONSTANTS.OFFSETS.NUMBER_OF_ENTRIES_ON_THIS_DISK),
				offset: buffer.readUInt32LE(CONSTANTS.OFFSETS.CD_START),
				sizeInBytes: buffer.readUInt32LE(CONSTANTS.OFFSETS.CD_SIZE_IN_BYTES)
			});
		}
	], cb);
};
