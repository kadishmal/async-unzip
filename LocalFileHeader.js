/*
 *  Local file header
 * Refer to http://en.wikipedia.org/wiki/Zip_(file_format).
 Offset	Bytes	Description
  0	    4		  Local file header signature = 0x04034b50 (read as a little-endian number)
  4	  	2		  Version needed to extract (minimum)
  6		  2		  General purpose bit flag
  8		  2		  Compression method
 10		  2	  	File last modification time
 12		  2	  	File last modification date
 14		  4	  	CRC-32
 18		  4	  	Compressed size
 22		  4	  	Uncompressed size
 26		  2	  	File name length (n)
 28		  2	  	Extra field length (m)
 30		  n	  	File name
 30+n	  m	  	Extra field
 * */
var async = require('async'),
		fs = require('fs'),
		zlib = require('zlib');

var LocalFileHeader;

var CONSTANTS = {
	LOCAL_FILE_HEADER_SIZE          : 30,
	LOCAL_FILE_HEADER_SIGNATURE     : 0x04034b50,
	OFFSETS: {
		LOCAL_FILE_HEADER_SIGNATURE   : 0,
		MIN_VERSION_NEEDED_TO_EXTRACT : 4,
		GENERAL_PURPOSE_BIT_FLAG      : 6, // encrypt, decrypt flags
		COMPRESSION_METHOD            : 8,
		LAST_MODIFIED_TIME            : 10,
		LAST_MODIFIED_DATE            : 12,
		CRC32                         : 14,
		COMPRESSED_SIZE               : 18,
		UNCOMPRESSED_SIZE             : 22,
		FILENAME_LENGTH               : 26,
		EXTRA_FIELD_LENGTH            : 28,
		FILENAME                      : 30
	},
	ERRORS: {
		INVALID_COMPRESSION_METHOD: 'Invalid or unsupported file compression method.',
		INVALID_DATA_OFFSET: 'Invalid file data offset.',
		INVALID_LOCAL_HEADER_OFFSET: 'Invalid local header offset.',
		INVALID_FILE_HEADER_SIGNATURE: 'Invalid file header signature.'
	},
	COMPRESSION_METHODS: {
		STORED: 0,
		DEFLATED: 8
	},
	// In Zlib, this is the default amount for chunk size:
	// `#define CHUNK 16384`
	MIN_BYTES_TO_READ: 16*1024
};

LocalFileHeader = module.exports = function (entry) {
	if (!this instanceof LocalFileHeader) {
		return new LocalFileHeader(entry);
	}

	this._entry = entry;
};

LocalFileHeader.prototype.readLocalFileHeader = function (buffer, cb) {
	this.signature = buffer.readUInt32LE(CONSTANTS.OFFSETS.LOCAL_FILE_HEADER_SIGNATURE);

	if (this.signature !== CONSTANTS.LOCAL_FILE_HEADER_SIGNATURE) {
		cb(new Error(CONSTANTS.ERRORS.INVALID_FILE_HEADER_SIGNATURE));
	} else {
		this.filenameLength = buffer.readUInt16LE(CONSTANTS.OFFSETS.FILENAME_LENGTH);
		this.extraFieldLength = buffer.readUInt16LE(CONSTANTS.OFFSETS.EXTRA_FIELD_LENGTH);

		this.fileDataOffset = CONSTANTS.LOCAL_FILE_HEADER_SIZE + this.filenameLength + this.extraFieldLength;

		cb();
	}
};

LocalFileHeader.prototype.getData = function (size, cb) {
	var compressedReadSize,
			entry = this._entry,
			self = this;

	if (typeof size === 'function') {
		cb = size;
		size = entry.uncompressedSize;
		compressedReadSize = entry.compressedSize;
	} else {
		if (size > entry.compressedSize) {
			compressedReadSize = entry.compressedSize;

			size > entry.uncompressedSize && (size = entry.uncompressedSize);
		} else if (size < CONSTANTS.MIN_BYTES_TO_READ) {
			compressedReadSize = CONSTANTS.MIN_BYTES_TO_READ;

			size < 0 && (size = 0);
		} else {
			// Read twice more compressed data from the file system to avoid
			// [Error: invalid distance too far back] errno: -3, code: 'Z_DATA_ERROR' }
			// when inflating an incomplete compressed data chunks.
			compressedReadSize = size * 2;
		}
	}

	async.waterfall([
		function (cb) {
			// We first need to read the header to determine where the
			// file data starts, i.e. the file data offset.
			// The thing is it doesn't always start right after the
			// header data. There may be some other info in between.
			fs.read(entry._fd, new Buffer(CONSTANTS.LOCAL_FILE_HEADER_SIZE), 0, CONSTANTS.LOCAL_FILE_HEADER_SIZE, entry.localFileHeaderOffset, cb);
		},
		function (bytesRead, headBuffer, cb) {
			if (bytesRead == CONSTANTS.LOCAL_FILE_HEADER_SIZE) {
				self.readLocalFileHeader(headBuffer, cb);
			} else {
				cb(new Error(CONSTANTS.ERRORS.INVALID_LOCAL_HEADER_OFFSET));
			}
		},
		function (cb) {
			// Now read the actual data which can be either the compressed data
			// or already uncompressed, i.e. stored data.
			fs.read(entry._fd, new Buffer(compressedReadSize), 0, compressedReadSize, entry.localFileHeaderOffset + self.fileDataOffset, cb);
		},
		function (bytesRead, buffer, cb) {
			if (bytesRead == compressedReadSize) {
				if (entry.compressionMethod == CONSTANTS.COMPRESSION_METHODS.STORED) {
					cb(null, buffer);
				} else if (entry.compressionMethod == CONSTANTS.COMPRESSION_METHODS.DEFLATED) {
					var buff = new Buffer(size),
							inflator = zlib.createInflateRaw(),
							written = 0;

					inflator.once('end', onEnd);

					inflator.on('error', function (err) {
						inflator.removeListener('end', onEnd);
						inflator.removeListener('readable', processChunk);

						cb(err);
					});

					function onEnd() {
						cb(null, buff);
					}

					function processChunk() {
						var chunk;

						while (written < size && (chunk = inflator.read())) {
							var len = size - written;

							chunk.length < len && (len = chunk.length);
							chunk.copy(buff, written, 0, len);

							written += len;
						}

						if (written < size) {
							inflator.once('readable', processChunk);
						}
					}

					// Pass in the compressed data.
					inflator.end(buffer);

					processChunk();
				} else {
					cb(new Error(CONSTANTS.ERRORS.INVALID_COMPRESSION_METHOD));
				}
			} else {
				cb(new Error(CONSTANTS.ERRORS.INVALID_DATA_OFFSET));
			}
		}
	], cb);
};
