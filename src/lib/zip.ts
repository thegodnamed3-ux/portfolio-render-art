/**
 * Minimal streaming ZIP writer (stored entries, no compression — photos are
 * already compressed). Each entry is added whole, so sizes and CRC are known
 * before its header is written; the archive itself is emitted chunk by chunk,
 * which lets the caller stream it straight to disk. Switches to ZIP64 records
 * only when the archive grows past 4 GB.
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosTime(d: Date) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const date = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

const MAX32 = 0xffffffff;
const enc = new TextEncoder();

type Entry = { name: Uint8Array; crc: number; size: number; offset: number; time: number; date: number };

export class ZipWriter {
  private offset = 0;
  private entries: Entry[] = [];
  private used = new Set<string>();

  constructor(private write: (chunk: Uint8Array) => Promise<void>) {}

  /** Keeps names unique inside the archive ("a.jpg", "a (2).jpg"). */
  private uniqueName(name: string) {
    const clean = name.replace(/[\\/:*?"<>|]+/g, "_").trim() || "file";
    let out = clean;
    const dot = clean.lastIndexOf(".");
    const base = dot > 0 ? clean.slice(0, dot) : clean;
    const ext = dot > 0 ? clean.slice(dot) : "";
    for (let i = 2; this.used.has(out.toLowerCase()); i++) out = `${base} (${i})${ext}`;
    this.used.add(out.toLowerCase());
    return out;
  }

  async add(fileName: string, data: Uint8Array, modified = new Date()) {
    const name = enc.encode(this.uniqueName(fileName));
    const crc = crc32(data);
    const { time, date } = dosTime(modified);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true); // version needed
    h.setUint16(6, 0x0800, true); // UTF-8 names
    h.setUint16(8, 0, true); // stored
    h.setUint16(10, time, true);
    h.setUint16(12, date, true);
    h.setUint32(14, crc, true);
    h.setUint32(18, data.length, true);
    h.setUint32(22, data.length, true);
    h.setUint16(26, name.length, true);
    h.setUint16(28, 0, true);
    this.entries.push({ name, crc, size: data.length, offset: this.offset, time, date });
    await this.emit(new Uint8Array(h.buffer));
    await this.emit(name);
    await this.emit(data);
  }

  private async emit(chunk: Uint8Array) {
    await this.write(chunk);
    this.offset += chunk.length;
  }

  async finish() {
    const cdStart = this.offset;
    for (const e of this.entries) {
      const big = e.offset > MAX32;
      const extra = big ? 12 : 0;
      const c = new DataView(new ArrayBuffer(46 + extra));
      c.setUint32(0, 0x02014b50, true);
      c.setUint16(4, big ? 45 : 20, true); // version made by
      c.setUint16(6, big ? 45 : 20, true); // version needed
      c.setUint16(8, 0x0800, true);
      c.setUint16(10, 0, true);
      c.setUint16(12, e.time, true);
      c.setUint16(14, e.date, true);
      c.setUint32(16, e.crc, true);
      c.setUint32(20, e.size, true);
      c.setUint32(24, e.size, true);
      c.setUint16(28, e.name.length, true);
      c.setUint16(30, extra, true);
      c.setUint16(32, 0, true);
      c.setUint16(34, 0, true);
      c.setUint16(36, 0, true);
      c.setUint32(38, 0, true);
      c.setUint32(42, big ? MAX32 : e.offset, true);
      const head = new Uint8Array(c.buffer, 0, 46);
      await this.emit(head);
      await this.emit(e.name);
      if (big) {
        const x = new DataView(new ArrayBuffer(12));
        x.setUint16(0, 0x0001, true);
        x.setUint16(2, 8, true);
        x.setBigUint64(4, BigInt(e.offset), true);
        await this.emit(new Uint8Array(x.buffer));
      }
    }
    const cdSize = this.offset - cdStart;
    const n = this.entries.length;
    const zip64 = cdStart > MAX32 || cdSize > MAX32 || n > 0xffff;

    if (zip64) {
      const eocd64At = this.offset;
      const z = new DataView(new ArrayBuffer(56));
      z.setUint32(0, 0x06064b50, true);
      z.setBigUint64(4, 44n, true);
      z.setUint16(12, 45, true);
      z.setUint16(14, 45, true);
      z.setUint32(16, 0, true);
      z.setUint32(20, 0, true);
      z.setBigUint64(24, BigInt(n), true);
      z.setBigUint64(32, BigInt(n), true);
      z.setBigUint64(40, BigInt(cdSize), true);
      z.setBigUint64(48, BigInt(cdStart), true);
      await this.emit(new Uint8Array(z.buffer));
      const l = new DataView(new ArrayBuffer(20));
      l.setUint32(0, 0x07064b50, true);
      l.setUint32(4, 0, true);
      l.setBigUint64(8, BigInt(eocd64At), true);
      l.setUint32(16, 1, true);
      await this.emit(new Uint8Array(l.buffer));
    }

    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true);
    e.setUint16(4, 0, true);
    e.setUint16(6, 0, true);
    e.setUint16(8, Math.min(n, 0xffff), true);
    e.setUint16(10, Math.min(n, 0xffff), true);
    e.setUint32(12, Math.min(cdSize, MAX32), true);
    e.setUint32(16, zip64 ? MAX32 : cdStart, true);
    e.setUint16(20, 0, true);
    await this.emit(new Uint8Array(e.buffer));
  }
}
