import JSZip from 'jszip';
import { createHash } from 'node:crypto';
export async function hwpxFixture() {
  const zip = new JSZip();
  zip.file('mimetype', 'application/hwp+zip');
  zip.file('Contents/section0.xml', `<?xml version="1.0" encoding="UTF-8"?><hs:sec xmlns:hs="urn:hs" xmlns:hp="urn:hp"><hp:p><hp:run><hp:t>5학년 체육과 교수학습과정안</hp:t></hp:run></hp:p><hp:p><hp:run><hp:tbl><hp:tr><hp:tc><hp:p><hp:run><hp:t>학년</hp:t></hp:run></hp:p></hp:tc><hp:tc><hp:p><hp:run><hp:t>5학년</hp:t></hp:run></hp:p></hp:tc><hp:tc><hp:p><hp:run><hp:t>교과</hp:t></hp:run></hp:p></hp:tc><hp:tc><hp:p><hp:run><hp:t>체육</hp:t></hp:run></hp:p></hp:tc></hp:tr><hp:tr><hp:tc><hp:p><hp:run><hp:t>단원</hp:t></hp:run></hp:p></hp:tc><hp:tc><hp:p><hp:run><hp:t>2. 도전</hp:t></hp:run></hp:p></hp:tc></hp:tr><hp:tr><hp:tc><hp:p><hp:run><hp:t>학습 주제</hp:t></hp:run></hp:p></hp:tc><hp:tc><hp:p><hp:run><hp:t>함께 달리기</hp:t></hp:run></hp:p></hp:tc></hp:tr></hp:tbl></hp:run></hp:p><hp:p><hp:run><hp:t>학습 목표: 협력하며 달릴 수 있다.</hp:t></hp:run></hp:p><hp:p><hp:run><hp:t>차시: 2/4</hp:t></hp:run></hp:p><hp:p><hp:run><hp:t>[6체02-08]</hp:t></hp:run></hp:p></hs:sec>`);
  return new Uint8Array(await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }));
}
export function recordFixture(bytes, override = {}) {
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  return { id: `plan-${sha256}`, title: '협력 달리기 수업', grades: [5], gradeBand: '', subject: '체육', unit: '2. 도전', normalizedUnit: '2.도전', lessonNumber: '2/4', topic: '함께 달리기', objectives: ['협력하며 달린다.'], standards: ['[6체02-08]'], curriculum: '', teachingModel: '협동학습', duration: '40분', keywords: ['달리기'], fileFormat: 'HWPX', originalFileName: '5학년_체육_지도안.hwpx', filePath: `plans/${sha256}.hwpx`, fileSize: bytes.length, sha256, previewText: '공개 가능한 수업 본문', author: '테스트 작성자', license: '테스트 fixture 전용', source: '', publishedAt: '', status: 'draft', ...override };
}
export async function submissionFixture(override = {}) {
  const bytes = await hwpxFixture();
  const p = recordFixture(bytes, override);
  const id = 'submission-00000000-0000-4000-8000-000000000001';
  const manifest = { version: 1, submissionId: id, createdAt: '2026-10-11T00:00:00.000Z', declarations: { privacy: true, copyright: true }, entries: [{ record: `records/${p.id}.json`, file: p.filePath, sha256: p.sha256, fileSize: p.fileSize }] };
  const zip = new JSZip();
  zip.file('submission/manifest.json', JSON.stringify(manifest));
  zip.file(`submission/records/${p.id}.json`, JSON.stringify(p));
  zip.file(`submission/${p.filePath}`, bytes);
  zip.file('submission/README.txt', '테스트 fixture. 공개 교육 자료가 아닙니다.');
  return { zip, bytes: new Uint8Array(await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })), p, id };
}
