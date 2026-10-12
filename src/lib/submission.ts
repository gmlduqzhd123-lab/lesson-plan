import JSZip from 'jszip';
import { ManifestSchema, PlanSchema, LIMITS } from '../../shared/schema.mjs';
import type { Draft } from '../types';
import { hashFile } from './parsers/analyze';
import { createUuid } from './uuid';

export async function createSubmission(drafts: Draft[], declarations: { privacy: boolean; copyright: boolean }) {
  if (!drafts.length || drafts.some(d => d.state !== '완료' || !d.plan)) throw new Error('실패·중복 파일을 제거하고 분석을 완료해주세요.');
  if (!declarations.privacy || !declarations.copyright) throw new Error('개인정보 및 저작권 확인이 필요합니다.');
  if (drafts.length > LIMITS.files || drafts.reduce((total, d) => total + d.file.size, 0) > LIMITS.batch) throw new Error('제출 개수 또는 전체 파일 크기 제한을 초과했습니다.');
  const submissionId = `submission-${createUuid()}`;
  const entries = [];
  const zip = new JSZip();
  const seen = new Set();
  for (const d of drafts) {
    const p = PlanSchema.parse({ ...d.plan, ...Object.fromEntries(['objectives', 'standards', 'keywords'].map(key => [key, d.plan![key as 'objectives' | 'standards' | 'keywords'].map(s => s.trim()).filter(Boolean)])) });
    if (!p.license.trim()) throw new Error(`${p.originalFileName}: 이용 조건을 입력해주세요.`);
    if (seen.has(p.sha256)) throw new Error('동일한 원본 파일이 중복되었습니다.');
    seen.add(p.sha256);
    if (await hashFile(d.file) !== p.sha256 || d.file.size !== p.fileSize) throw new Error('원본 파일 무결성 검증에 실패했습니다.');
    const record = `records/${p.id}.json`;
    zip.file(`submission/${record}`, JSON.stringify(p, null, 2));
    zip.file(`submission/${p.filePath}`, await d.file.arrayBuffer());
    entries.push({ record, file: p.filePath, sha256: p.sha256, fileSize: p.fileSize });
  }
  const manifest = ManifestSchema.parse({ version: 1, submissionId, createdAt: new Date().toISOString(), declarations, entries });
  zip.file('submission/manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('submission/README.txt', '관리자 제출용 자료입니다. 아직 공개 등록되지 않았습니다.\n원본·분류·개인정보·저작권을 검토한 후 별도 승인 명령으로 공개합니다.\n미리보기에는 문서에서 추출한 본문이 포함되므로 학생 이름 등 개인정보를 제거한 원본으로 다시 분석해주세요.\n');
  return { submissionId, blob: await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }) };
}
