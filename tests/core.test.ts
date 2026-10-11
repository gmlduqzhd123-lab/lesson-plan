import { webcrypto } from 'node:crypto';
import JSZip from 'jszip';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { hwpxFixture, recordFixture } from './fixtures.mjs';
import { extractHwpx } from '../src/lib/parsers/hwpx';
import { classify } from '../src/lib/classifier';
import { analyzeFile } from '../src/lib/parsers/analyze';
import { readSafeZip, safePath } from '../shared/safe-zip.mjs';
import { PlanSchema, LIMITS } from '../shared/schema.mjs';
import { searchPlans } from '../src/lib/search';
import { createSubmission } from '../src/lib/submission';
import type { Plan } from '../src/types';
import { reconcileDuplicates } from '../src/lib/drafts';

beforeAll(() => vi.stubGlobal('crypto', webcrypto));
const makeFile = (bytes: Uint8Array, name: string) => ({ name, size: bytes.length, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }) as File;
describe('HWPX and classification', () => {
  it('keeps a valid image-only HWPX editable while malformed XML remains rejected', async () => {
    const zip = new JSZip(); zip.file('Contents/section0.xml', '<s><picture/></s>');
    const result = await analyzeFile(makeFile(await zip.generateAsync({ type: 'uint8array' }), '그림.hwpx'));
    expect(result.plan?.previewText).toBe(''); expect(result.warning).toContain('직접 입력');
    expect(result.confidence).toBe('확인 필요');
  });
  it('reads vertical header tables, numeric grades and split text runs', async () => {
    const zip = new JSZip();
    zip.file('Contents/section0.xml', '<s><tr><tc><p><t>학년</t></p></tc><tc><p><t>교과</t></p></tc><tc><p><t>단원</t></p></tc></tr><tr><tc><p><t>5</t></p></tc><tc><p><t>체</t><t>육</t></p></tc><tc><p><t>도전</t></p></tc></tr></s>');
    const r = classify(extractHwpx(await zip.generateAsync({ type: 'uint8array' })), '자료.hwpx');
    expect(r.values).toMatchObject({ grades: [5], subject: '체육', unit: '도전' });
    expect(r.confidence).toBe('높음');
  });
  it('preserves first-section metadata precedence', async () => {
    const zip = new JSZip();
    for (const [index, grade] of [3, 6].entries()) zip.file(`Contents/section${index}.xml`, `<s><tr><tc><p><t>학년</t></p></tc><tc><p><t>${grade}학년</t></p></tc></tr></s>`);
    expect(classify(extractHwpx(await zip.generateAsync({ type: 'uint8array' })), '자료.hwpx').values.grades).toEqual([3]);
  });
  it('recognizes spaced labels without giving filename guesses high confidence', () => {
    expect(classify('학 년: 4\n교 과: 국어\n단 원: 읽기', '자료.hwpx').values).toMatchObject({ grades: [4], subject: '국어', unit: '읽기' });
    expect(classify('학년: 미상\n교과: 미상\n단원: 읽기', '5학년_국어.hwpx').confidence).toBe('확인 필요');
  });
  it('extracts paragraphs and table label/value relationships', async () => { const text = extractHwpx(await hwpxFixture()); expect(text).toContain('학년\t5학년\t교과\t체육'); expect(text).toContain('함께 달리기'); });
  it('classifies explicit table fields, unit, lesson, objective and standard', async () => { const r = classify(extractHwpx(await hwpxFixture()), '자료.hwpx'); expect(r.values).toMatchObject({ grades: [5], subject: '체육', unit: '2. 도전', lessonNumber: '2/4', topic: '함께 달리기', curriculum: '' }); expect(r.values.standards).toEqual(['[6체02-08]']); expect(r.confidence).toBe('높음'); });
  it('does not equate a standard grade band with actual grade', () => { const r = classify('[6체02-08]', '수업.hwpx'); expect(r.values.grades).toEqual([]); expect(r.values.subject).toBe('체육'); expect(r.confidence).toBe('확인 필요'); });
  it('supports grade bands without inventing specific grade', () => { const r = classify('학년: 5~6학년군\n교과: 체육', '수업.hwpx'); expect(r.values.grades).toEqual([]); expect(r.values.gradeBand).toBe('5~6학년군'); });
  it('prefers explicit fields over filename and standard', () => { const r = classify('학년: 3학년\n교과: 수학\n단원: 나눗셈\n[6체02-08]', '5학년_체육.hwpx'); expect(r.values.grades).toEqual([3]); expect(r.values.subject).toBe('수학'); });
  it('uses filename fallback with low confidence for HWP 5', async () => { const bytes = new Uint8Array([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1,0]); const r = await analyzeFile(makeFile(bytes, '5학년_체육.hwp')); expect(r.plan?.grades).toEqual([5]); expect(r.warning).toContain('본문 분석은 지원하지'); expect(r.confidence).toBe('확인 필요'); });
  it('rejects fake extensions, oversized and empty files', async () => { await expect(analyzeFile(makeFile(new Uint8Array([1]), 'a.hwpx'))).rejects.toThrow('서명'); await expect(analyzeFile(makeFile(new Uint8Array(), 'a.hwp'))).rejects.toThrow('빈 파일'); await expect(analyzeFile({ name: 'a.hwpx', size: LIMITS.file + 1 } as File)).rejects.toThrow('20MiB'); await expect(analyzeFile(makeFile(new Uint8Array([1]), 'a.pdf'))).rejects.toThrow('HWP'); });
  it('handles malformed XML and missing body', async () => { const zip = new JSZip(); zip.file('Contents/section0.xml', '<x><oops></x>'); const b = await zip.generateAsync({ type: 'uint8array' }); expect(() => extractHwpx(b)).toThrow('XML'); zip.remove('Contents/section0.xml'); zip.file('mimetype', 'application/hwp+zip'); const empty = await zip.generateAsync({ type: 'uint8array' }); expect(() => extractHwpx(empty)).toThrow('본문'); });
  it('blocks external entity declarations', async () => { const zip = new JSZip(); zip.file('Contents/section0.xml', '<!DOCTYPE x SYSTEM "file:///private"><x/>'); const bytes = await zip.generateAsync({ type: 'uint8array' }); expect(() => extractHwpx(bytes)).toThrow('엔티티'); });
  it('isolates a broken document from a later valid document', async () => { const good = await hwpxFixture(); const r = await Promise.allSettled([analyzeFile(makeFile(new Uint8Array([0]), 'broken.hwpx')), analyzeFile(makeFile(good, 'good.hwpx'))]); expect(r.map(r => r.status)).toEqual(['rejected', 'fulfilled']); });
});
describe('ZIP safety and metadata', () => {
  it.each(['../x', '/absolute', 'a\\b', 'C:/x', 'a/./b', 'a//b', 'a/../b'])('blocks path %s', path => expect(() => safePath(path)).toThrow());
  it('enforces actual expanded size limits', async () => { const zip = new JSZip(); zip.file('large.txt', 'x'.repeat(20000)); const b = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }); expect(() => readSafeZip(b, { maxEntry: 1000 })).toThrow(); });
  it('rejects damaged ZIP and CRC mismatch', async () => { const zip = new JSZip(); zip.file('x.txt', 'hello'); const b = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' }); b[35] ^= 1; expect(() => readSafeZip(b)).toThrow('CRC'); expect(() => readSafeZip(b.subarray(0, 8))).toThrow(); });
  it('rejects unsafe catalog path and false hash identity', async () => { const p = recordFixture(await hwpxFixture()); expect(PlanSchema.safeParse({ ...p, filePath: '../private.hwp' }).success).toBe(false); expect(PlanSchema.safeParse({ ...p, sha256: 'f'.repeat(64) }).success).toBe(false); });
});
describe('search and submission', () => {
  it('promotes a duplicate when the original row is removed, but keeps published duplicates blocked', async () => {
    const p = recordFixture(await hwpxFixture()) as Plan;
    const d = { key: 'duplicate', file: makeFile(new Uint8Array(), 'duplicate.hwpx'), state: '중복' as const, plan: p };
    expect(reconcileDuplicates([d], [])[0].state).toBe('완료');
    expect(reconcileDuplicates([d], [p])[0].state).toBe('중복');
  });
  const f = { query: '', grade: '', subject: '', unit: '', sort: 'latest' };
  it('combines grade, subject, unit and whitespace-insensitive Korean query', async () => { const p = recordFixture(await hwpxFixture(), { status: 'approved', publishedAt: '2026-10-11T00:00:00Z' }) as Plan; expect(searchPlans([p], { ...f, grade: '5', subject: '체육', unit: '2.도전', query: '함께달리기' })).toHaveLength(1); expect(searchPlans([p], { ...f, grade: '4' })).toHaveLength(0); expect(searchPlans([p], { ...f, query: '[6체02-08]' })).toHaveLength(1); });
  it('sorts by title, grade, subject and date', async () => { const a = recordFixture(await hwpxFixture(), { title: '가 수업', grades: [5], publishedAt: '2026-10-10' }) as Plan; const b = { ...a, id: 'b', title: '나 수업', grades: [1], subject: '국어', publishedAt: '2026-10-11' }; expect(searchPlans([a,b], { ...f, sort: 'title' })[0]).toBe(a); for (const sort of ['grade','subject','latest']) expect(searchPlans([a,b], { ...f, sort })[0]).toBe(b); });
  it('creates a connected package with byte-preserved original and consent', async () => { const bytes = await hwpxFixture(); const p = recordFixture(bytes) as Plan; const file = makeFile(bytes, p.originalFileName); const { blob } = await createSubmission([{ key: '1', file, state: '완료', plan: p }], { privacy: true, copyright: true }); const ab = await new Promise<ArrayBuffer>(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result as ArrayBuffer); r.readAsArrayBuffer(blob); }); const entries = readSafeZip(new Uint8Array(ab)); expect(entries.get(`submission/${p.filePath}`)).toEqual(bytes); const manifest = JSON.parse(new TextDecoder().decode(entries.get('submission/manifest.json'))); expect(manifest.entries[0].sha256).toBe(p.sha256); });
  it('rejects missing consent, missing license and duplicates', async () => { const bytes = await hwpxFixture(); const p = recordFixture(bytes) as Plan; const d = { key: '1', file: makeFile(bytes, p.originalFileName), state: '완료' as const, plan: p }; await expect(createSubmission([d], { privacy: false, copyright: true })).rejects.toThrow(); await expect(createSubmission([d,d], { privacy: true, copyright: true })).rejects.toThrow('중복'); await expect(createSubmission([{ ...d, plan: { ...p, license: '' } }], { privacy: true, copyright: true })).rejects.toThrow('이용 조건'); });
});
