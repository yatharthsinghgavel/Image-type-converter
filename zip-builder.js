/**
 * zip-builder.js
 * A minimal, zero-dependency ZIP file generator for browser environments.
 * Creates an uncompressed ZIP archive (Store only, compression method 0).
 */

export class ZipBuilder {
  constructor() {
    this.files = [];
  }

  /**
   * Adds a file to the zip.
   * @param {string} name - The file name.
   * @param {Uint8Array} data - The file data as bytes.
   */
  addFile(name, data) {
    this.files.push({ name, data });
  }

  /**
   * Generates the ZIP blob.
   * @returns {Blob}
   */
  generate() {
    let localDataSize = 0;
    let centralDataSize = 0;

    const utf8Encoder = new TextEncoder();

    // Pre-calculate sizes and encode names
    for (const f of this.files) {
      f.nameBytes = utf8Encoder.encode(f.name);
      f.localHeaderSize = 30 + f.nameBytes.length;
      f.centralHeaderSize = 46 + f.nameBytes.length;
      f.offset = localDataSize;

      localDataSize += f.localHeaderSize + f.data.length;
      centralDataSize += f.centralHeaderSize;
    }

    const endOfCentralSize = 22;
    const totalSize = localDataSize + centralDataSize + endOfCentralSize;
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const array = new Uint8Array(buffer);

    let pos = 0;

    // Write Local File Headers and Data
    for (const f of this.files) {
      // Local file header signature
      view.setUint32(pos, 0x04034b50, true); pos += 4;
      // Version needed to extract (10 = v1.0)
      view.setUint16(pos, 10, true); pos += 2;
      // General purpose bit flag (Bit 11 = Language encoding flag UTF8)
      view.setUint16(pos, 0x0800, true); pos += 2;
      // Compression method (0 = store)
      view.setUint16(pos, 0, true); pos += 2;
      // Last mod file time & date (dummy)
      view.setUint16(pos, 0, true); pos += 2;
      view.setUint16(pos, 0, true); pos += 2;
      
      // CRC-32 (0 for store is wrong, but since we don't have CRC32, we use data descriptor trick or just skip)
      // Actually, for store without data descriptor, CRC must be correct. Let's compute CRC32.
      const crc = this.crc32(f.data);
      view.setUint32(pos, crc, true); pos += 4;
      // Compressed size
      view.setUint32(pos, f.data.length, true); pos += 4;
      // Uncompressed size
      view.setUint32(pos, f.data.length, true); pos += 4;
      // File name length
      view.setUint16(pos, f.nameBytes.length, true); pos += 2;
      // Extra field length
      view.setUint16(pos, 0, true); pos += 2;
      
      // File name
      array.set(f.nameBytes, pos); pos += f.nameBytes.length;
      
      // File data
      array.set(f.data, pos); pos += f.data.length;
    }

    const centralDirOffset = pos;

    // Write Central Directory Headers
    for (const f of this.files) {
      // Central file header signature
      view.setUint32(pos, 0x02014b50, true); pos += 4;
      // Version made by
      view.setUint16(pos, 20, true); pos += 2;
      // Version needed to extract
      view.setUint16(pos, 10, true); pos += 2;
      // General purpose bit flag
      view.setUint16(pos, 0x0800, true); pos += 2;
      // Compression method
      view.setUint16(pos, 0, true); pos += 2;
      // Last mod time & date
      view.setUint16(pos, 0, true); pos += 2;
      view.setUint16(pos, 0, true); pos += 2;
      
      // CRC-32
      const crc = this.crc32(f.data);
      view.setUint32(pos, crc, true); pos += 4;
      // Compressed size
      view.setUint32(pos, f.data.length, true); pos += 4;
      // Uncompressed size
      view.setUint32(pos, f.data.length, true); pos += 4;
      // File name length
      view.setUint16(pos, f.nameBytes.length, true); pos += 2;
      // Extra field length
      view.setUint16(pos, 0, true); pos += 2;
      // File comment length
      view.setUint16(pos, 0, true); pos += 2;
      // Disk number start
      view.setUint16(pos, 0, true); pos += 2;
      // Internal file attributes
      view.setUint16(pos, 0, true); pos += 2;
      // External file attributes
      view.setUint32(pos, 0, true); pos += 4;
      // Relative offset of local header
      view.setUint32(pos, f.offset, true); pos += 4;
      
      // File name
      array.set(f.nameBytes, pos); pos += f.nameBytes.length;
    }

    // Write End of Central Directory Record
    // Signature
    view.setUint32(pos, 0x06054b50, true); pos += 4;
    // Disk number
    view.setUint16(pos, 0, true); pos += 2;
    // Disk with central dir
    view.setUint16(pos, 0, true); pos += 2;
    // Num central dir records on this disk
    view.setUint16(pos, this.files.length, true); pos += 2;
    // Total num central dir records
    view.setUint16(pos, this.files.length, true); pos += 2;
    // Size of central dir
    view.setUint32(pos, centralDataSize, true); pos += 4;
    // Offset of start of central dir
    view.setUint32(pos, centralDirOffset, true); pos += 4;
    // Zip file comment length
    view.setUint16(pos, 0, true); pos += 2;

    return new Blob([buffer], { type: 'application/zip' });
  }

  /**
   * Calculates CRC-32 for data.
   */
  crc32(data) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
      }
    }
    return crc ^ 0xFFFFFFFF;
  }
}
