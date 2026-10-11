import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PlanSchema, ManifestSchema, LIMITS, validateSignature } from '../shared/schema.mjs';
import { readSafeZip } from '../shared/safe-zip.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export async function regularFile(filename) {
  const relative = path.relative(ROOT, path.resolve(filename));
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('작업 폴더 밖의 파일입니다.');
  let at = ROOT;
  for (const part of relative.split(path.sep)) {
    at = path.join(at, part);
    const stat = await fs.lstat(at);
    if (stat.isSymbolicLink()) throw new Error('심볼릭 링크는 허용하지 않습니다.');
  }
  const stat = await fs.lstat(filename);
  if (!stat.isFile()) throw new Error('일반 파일이 아닙니다.');
  return fs.readFile(filename);
}
export async function published() {
  const recordsDir = path.join(ROOT, 'records');
  await fs.mkdir(recordsDir, { recursive: true });
  const names = await fs.readdir(recordsDir);
  const records = [];
  const ids = new Set(), hashes = new Set();
  for (const name of names.filter(n => n.endsWith('.json'))) {
    const p = PlanSchema.parse(JSON.parse((await regularFile(path.join(recordsDir, name))).toString('utf8')));
    if (p.status !== 'approved' || name !== `${p.id}.json`) throw new Error(`${name}: 승인 상태 또는 파일명이 잘못되었습니다.`);
    if (ids.has(p.id) || hashes.has(p.sha256)) throw new Error(`${name}: 중복 ID 또는 해시입니다.`);
    const file = await regularFile(path.join(ROOT, 'public', p.filePath));
    if (file.length !== p.fileSize || hash(file) !== p.sha256) throw new Error(`${name}: 공개 원본 크기·해시 불일치입니다.`);
    validateSignature(file, p.fileFormat);
    ids.add(p.id); hashes.add(p.sha256); records.push(p);
  }
  const plansDir = path.join(ROOT, 'public', 'plans');
  await fs.mkdir(plansDir, { recursive: true });
  const referenced = new Set(records.map(p => path.basename(p.filePath)));
  for (const name of await fs.readdir(plansDir)) if (name !== '.gitkeep' && !referenced.has(name)) throw new Error(`메타데이터 없는 공개 파일: ${name}`);
  return records;
}
export function unpackSubmission(bytes) {
  const entries = readSafeZip(bytes, { maxInput: LIMITS.batch + 5 * 1024 ** 2 });
  const manifestRaw = entries.get('submission/manifest.json');
  if (!manifestRaw || manifestRaw.length > 256000) throw new Error('manifest.json 누락 또는 크기 초과입니다.');
  const manifest = ManifestSchema.parse(JSON.parse(new TextDecoder().decode(manifestRaw)));
  const allowed = new Set(['submission/manifest.json', 'submission/README.txt']);
  const hashes = new Set();
  const records = [];
  let total = 0;
  for (const entry of manifest.entries) {
    const recBytes = entries.get(`submission/${entry.record}`), file = entries.get(`submission/${entry.file}`);
    if (!recBytes || !file || recBytes.length > 2 * 1024 ** 2) throw new Error('메타데이터·원본 누락 또는 크기 초과입니다.');
    const p = PlanSchema.parse(JSON.parse(new TextDecoder().decode(recBytes)));
    if (p.status !== 'draft' || entry.record !== `records/${p.id}.json` || entry.file !== p.filePath || p.sha256 !== entry.sha256 || file.length !== entry.fileSize || p.fileSize !== file.length || hash(file) !== p.sha256) throw new Error('제출 파일 연결 또는 SHA-256 검증 실패입니다.');
    validateSignature(file, p.fileFormat);
    if (p.fileFormat === 'HWPX') {
      const inner = readSafeZip(file, { maxInput: LIMITS.file, maxExpanded: 64 * 1024 ** 2 });
      if (![...inner.keys()].some(n => /^Contents\/section\d+\.xml$/i.test(n))) throw new Error('HWPX 본문이 없습니다.');
    }
    if (hashes.has(p.sha256)) throw new Error('제출 패키지 안에 중복 원본이 있습니다.');
    total += file.length;
    if (total > LIMITS.batch) throw new Error('제출 원본 총 100MiB 제한을 초과했습니다.');
    hashes.add(p.sha256); allowed.add(`submission/${entry.record}`); allowed.add(`submission/${entry.file}`);
    records.push({ plan: p, file });
  }
  if ([...entries.keys()].some(name => !allowed.has(name))) throw new Error('제출 패키지에 허용되지 않은 파일이 있습니다.');
  return { manifest, records };
}
export function main(fn) { fn().catch(error => { console.error(`오류: ${error.message}`); process.exitCode = 1; }); }
