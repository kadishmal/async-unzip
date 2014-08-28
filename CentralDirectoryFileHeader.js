/*
 * Central directory file header
 * Refer to http://en.wikipedia.org/wiki/Zip_(file_format).
 Offset	Bytes	Description
  0   	4   	Central directory file header signature = 0x02014b50
  4   	2   	Version made by
  6   	2   	Version needed to extract (minimum)
  8   	2   	General purpose bit flag
 10   	2   	Compression method
 12   	2   	File last modification time
 14   	2   	File last modification date
 16   	4   	CRC-32
 20   	4   	Compressed size
 24   	4   	Uncompressed size
 28   	2   	File name length (n)
 30   	2   	Extra field length (m)
 32   	2   	File comment length (k)
 34   	2   	Disk number where file starts
 36   	2   	Internal file attributes
 38   	4   	External file attributes
 42   	4   	Relative offset of local file header. This is the number of bytes between the start of the first disk on which the file occurs, and the start of the local file header. This allows software reading the central directory to locate the position of the file inside the .ZIP file.
 46   	n   	File name
 46+n   m   	Extra field
 46+n+m	k   	File comment
* */
var async = require('async'),
		fs = require('fs'),
		EndOfCentralDirectory = require('./EndOfCentralDirectoryRecord'),
		ZipEntry = require('./ZipEntry');

var CONSTANTS = {
	CD_HEADER_SIZE                         : 46,
	CD_SIGNATURE                           : 0x02014b50,
	OFFSETS: {
		CD_SIGNATURE                         : 0,
		VERSION_MADE_BY                      : 4,
		MIN_VERSION_NEEDED_TO_EXTRACT        : 6,
		GENERAL_PURPOSE_BIT_FLAG             : 8, // encrypt, decrypt flags
		COMPRESSION_METHOD                   : 10,
		LAST_MODIFIED_TIME                   : 12,
		LAST_MODIFIED_DATE                   : 14,
		CRC32                                : 16,
		COMPRESSED_SIZE                      : 20, // compressed size
		UNCOMPRESSED_SIZE                    : 24, // uncompressed size
		FILENAME_LENGTH                      : 28, // filename length
		EXTRA_FIELD_LENGTH                   : 30, // extra field length
		FILE_COMMENT_LENGTH                  : 32, // file comment length
		DISK_NUMBER_WHERE_FILE_STARTS        : 34, // volume number start
		INTERNAL_FILE_ATTRIBUTES             : 36, // internal file attributes
		EXTERNAL_FILE_ATTRIBUTES             : 38, // external file attributes (host system dependent)
		RELATIVE_OFFSET_OF_LOCAL_FILE_HEADER : 42 // LOC header offset
	},
	ERRORS: {
		INVALID_CD: 'Invalid Central Directory Record.',
		INCOMPLETE_CD: 'Incomplete Central Directory Record.'
	}
};

module.exports.initCentralDirectory = function (zipFile, cb) {
	var self = new CentralDirectory(),
			eocd = new EndOfCentralDirectory(zipFile);

	async.waterfall([
		function (cb) {
			eocd.getCentralDirectoryMeta(cb);
		},
		function (meta, cb) {
			self._sizeInBytes = meta.sizeInBytes;
			self._numberOfEntries = meta.numberOfEntries;
			self._fd = meta.fd;

			if (meta.offset + meta.sizeInBytes > eocd._stat.size) {
				cb(new Error(CONSTANTS.ERRORS.INCOMPLETE_CD));
			} else {
				fs.read(eocd._fd, new Buffer(meta.sizeInBytes), 0, meta.sizeInBytes, meta.offset, cb);
			}
		},
		function (bytesRead, buffer, cb) {
			if (bytesRead == self._sizeInBytes) {
				self._buffer = buffer;

				cb(null, self);
			} else {
				cb(new Error(CONSTANTS.ERRORS.INVALID_CD));
			}
		}
	], cb);
};

var CentralDirectory = function () {
	this._offset = 0;
};

CentralDirectory.prototype.getNextEntry = function (cb) {
	var entry;

	if (this._offset < this._sizeInBytes) {
		entry = new ZipEntry(this);
		this._offset += entry.entrySize;
	}

	cb(null, entry);
};

CentralDirectory.prototype.close = function (cb) {
	fs.close(this._fd, cb);
};
