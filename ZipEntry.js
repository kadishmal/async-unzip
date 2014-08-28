var async = require('async'),
		fs = require('fs'),
		LocalFileHeader = require('./LocalFileHeader');

var ZipEntry;

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
		INVALID_DATA_OFFSET: 'Invalid file data offset.'
	},
	COMPRESSION_METHODS: {
		DEFLATE: 8
	}
};

ZipEntry = module.exports = function (centralDirectory) {
	var buffer = centralDirectory._buffer,
			offset = centralDirectory._offset;

	this._fd = centralDirectory._fd;
	this.bitFlag = buffer.readUInt16LE(offset + CONSTANTS.OFFSETS.GENERAL_PURPOSE_BIT_FLAG);

	// When compression method is 8, `Deflate` compression is used.
	this.compressionMethod = buffer.readUInt16LE(offset + CONSTANTS.OFFSETS.COMPRESSION_METHOD);

	this.compressedSize = buffer.readUInt32LE(offset + CONSTANTS.OFFSETS.COMPRESSED_SIZE);
	this.uncompressedSize = buffer.readUInt32LE(offset + CONSTANTS.OFFSETS.UNCOMPRESSED_SIZE);
	this.filenameLength = buffer.readUInt16LE(offset + CONSTANTS.OFFSETS.FILENAME_LENGTH);
	this.extraFieldLength = buffer.readUInt16LE(offset + CONSTANTS.OFFSETS.EXTRA_FIELD_LENGTH);
	this.fileCommentLength = buffer.readUInt16LE(offset + CONSTANTS.OFFSETS.FILE_COMMENT_LENGTH);
	this.localFileHeaderOffset = buffer.readUInt32LE(offset + CONSTANTS.OFFSETS.RELATIVE_OFFSET_OF_LOCAL_FILE_HEADER);

	offset += CONSTANTS.CD_HEADER_SIZE;

	this.filename = buffer.toString('utf8', offset, offset += this.filenameLength);

	this.entrySize = CONSTANTS.CD_HEADER_SIZE + this.filenameLength + this.extraFieldLength + this.fileCommentLength;

	// According Open JDK source code at
	// http://grepcode.com/file/repository.grepcode.com/java/root/jdk/openjdk/6-b14/java/util/zip/ZipEntry.java#ZipEntry.isDirectory%28%29
	// this is the way to determine if a ZIP entry a file or directory.
	this.isFile = this.filename.slice(-1) != '/';
};

ZipEntry.prototype.getData = function (size, cb) {
	var localFileHeader = new LocalFileHeader(this);

	localFileHeader.getData(size, cb);
};
