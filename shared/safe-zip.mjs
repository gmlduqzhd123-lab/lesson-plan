import { Unzip, UnzipInflate } from 'fflate';
import { LIMITS } from './schema.mjs';

export function safePath(name) {
  if (!name || name.length > 300 || /[\\:\u0000-\u001f]/.test(name) || name.startsWith('/') || name.split('/').some(s => s === '..' || s === '.' || s === '')) throw new Error(`안전하지 않은 ZIP 경로: ${name.slice(0, 100)}`);
  return name;
}
// Stream inflate with actual output limits; central-directory sizes alone are not trusted.
export function readSafeZip(bytes, options = {}) {
  const maxInput = options.maxInput ?? LIMITS.batch;
  const maxExpanded = options.maxExpanded ?? LIMITS.expanded;
  const maxEntry = options.maxEntry ?? LIMITS.entry;
  if (bytes.length > maxInput || bytes.length < 22) throw new Error('ZIP 크기 제한 초과 또는 손상된 파일입니다.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  }
  if (end < 0 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) throw new Error('손상되거나 분할된 ZIP은 지원하지 않습니다.');
  const count = view.getUint16(end + 10, true);
  const centralSize = view.getUint32(end + 12, true);
  const centralOffset = view.getUint32(end + 16, true);
  if (!count || count > LIMITS.entries || count === 65535 || centralOffset + centralSize !== end) throw new Error('ZIP 항목 제한 초과 또는 비정상 디렉터리입니다.');
  const expected = new Map();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let cursor = centralOffset, declared = 0;
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || view.getUint32(cursor, true) !== 0x02014b50) throw new Error('손상된 ZIP 디렉터리입니다.');
    const flags = view.getUint16(cursor + 8, true), method = view.getUint16(cursor + 10, true);
    const size = view.getUint32(cursor + 24, true), nameLen = view.getUint16(cursor + 28, true);
    const extraLen = view.getUint16(cursor + 30, true), commentLen = view.getUint16(cursor + 32, true);
    const offset = view.getUint32(cursor + 42, true);
    if (cursor + 46 + nameLen + extraLen + commentLen > end || offset + 30 > centralOffset) throw new Error('ZIP 항목 경계가 잘못되었습니다.');
    const rawName = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLen));
    const dir = rawName.endsWith('/');
    safePath(dir ? rawName.slice(0, -1) : rawName);
    if (expected.has(rawName) || flags & 1 || ![0, 8].includes(method) || size > maxEntry || ((view.getUint32(cursor + 38, true) >>> 16) & 0xf000) === 0xa000) throw new Error('중복 경로, 암호화, 링크 또는 허용되지 않은 ZIP 항목입니다.');
    if (view.getUint32(offset, true) !== 0x04034b50) throw new Error('ZIP 로컬 헤더 오류입니다.');
    const localLen = view.getUint16(offset + 26, true), localExtra = view.getUint16(offset + 28, true);
    if (offset + 30 + localLen + localExtra > centralOffset || decoder.decode(bytes.subarray(offset + 30, offset + 30 + localLen)) !== rawName || view.getUint16(offset + 6, true) !== flags || view.getUint16(offset + 8, true) !== method) throw new Error('ZIP 경로 또는 헤더가 불일치합니다.');
    declared += size;
    if (declared > maxExpanded) throw new Error('ZIP 압축 해제 용량 제한을 초과했습니다.');
    expected.set(rawName, { size, crc: view.getUint32(cursor + 16, true), dir });
    cursor += 46 + nameLen + extraLen + commentLen;
  }
  if (cursor !== end) throw new Error('ZIP 디렉터리 길이가 잘못되었습니다.');
  const result = new Map(), completed = new Set();
  let total = 0;
  const unzip = new Unzip(file => {
    const spec = expected.get(file.name);
    if (!spec || result.has(file.name)) throw new Error('알 수 없거나 중복된 ZIP 항목입니다.');
    const chunks = [];
    let length = 0;
    file.ondata = (err, chunk, final) => {
      if (err) throw err;
      length += chunk.length; total += chunk.length;
      if (length > maxEntry || total > maxExpanded || length > spec.size) { file.terminate(); throw new Error('실제 ZIP 압축 해제 용량 제한 초과입니다.'); }
      chunks.push(chunk);
      if (final) {
        if (length !== spec.size) throw new Error('ZIP 항목 크기가 일치하지 않습니다.');
        const data = new Uint8Array(length);
        let at = 0;
        for (const part of chunks) { data.set(part, at); at += part.length; }
        if (crc32(data) !== spec.crc) throw new Error('ZIP CRC 검증 실패: 손상된 파일입니다.');
        completed.add(file.name);
        if (!spec.dir) result.set(file.name, data);
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  for (let i = 0; i < bytes.length; i += 16384) unzip.push(bytes.subarray(i, i + 16384), i + 16384 >= bytes.length);
  if (completed.size !== expected.size) throw new Error('일부 ZIP 항목이 누락되었습니다.');
  return result;
}
const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(data) {
  let c = 0xffffffff;
  for (const byte of data) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
